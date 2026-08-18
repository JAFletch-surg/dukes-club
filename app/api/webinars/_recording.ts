import { SupabaseClient } from '@supabase/supabase-js'
import {
  EncodedFileOutput,
  EncodedFileType,
  EncodingOptionsPreset,
  S3Upload,
} from 'livekit-server-sdk'
import { egressClient, livekitConfigured, VIMEO_API, VIMEO_HEADERS } from './_shared'

// ── Storage config ──────────────────────────────────────────────────
// Deliberately vendor-neutral: nothing here says "Supabase". Supabase Storage
// exposes an S3-compatible endpoint, but if its S3 shim ever chokes on a
// multipart upload, pointing these five env vars at Cloudflare R2 (or any S3)
// is the entire migration — no code change.

export const S3_ENDPOINT = process.env.WEBINAR_S3_ENDPOINT
export const S3_REGION = process.env.WEBINAR_S3_REGION
export const S3_BUCKET = process.env.WEBINAR_S3_BUCKET || 'webinar-recordings'
export const S3_ACCESS_KEY = process.env.WEBINAR_S3_ACCESS_KEY_ID
export const S3_SECRET = process.env.WEBINAR_S3_SECRET_ACCESS_KEY

export function recordingStorageConfigured(): boolean {
  return !!(S3_ENDPOINT && S3_REGION && S3_BUCKET && S3_ACCESS_KEY && S3_SECRET)
}

export type RecordingResult =
  | { ok: true; egressId: string; filepath: string }
  | { ok: false; error: string }

/**
 * Starts a room-composite recording.
 *
 * The 'speaker' layout puts whoever is screen-sharing full-frame with the
 * presenter as a picture-in-picture tile — exactly right for a slide-driven
 * webinar, with no custom egress template to maintain.
 */
export async function startSessionRecording(
  supabase: SupabaseClient,
  session: { id: string; room_name: string }
): Promise<RecordingResult> {
  if (!livekitConfigured()) return { ok: false, error: 'LiveKit is not configured' }
  if (!recordingStorageConfigured()) {
    return { ok: false, error: 'Recording storage (WEBINAR_S3_*) is not configured' }
  }

  const filepath = `${session.id}/${Date.now()}.mp4`

  const output = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath,
    output: {
      case: 's3',
      value: new S3Upload({
        endpoint: S3_ENDPOINT!,
        region: S3_REGION!,
        bucket: S3_BUCKET,
        accessKey: S3_ACCESS_KEY!,
        secret: S3_SECRET!,
        // Required for Supabase Storage and most non-AWS S3 implementations,
        // which do not support virtual-host-style bucket addressing.
        forcePathStyle: true,
      }),
    },
  })

  try {
    const info = await egressClient().startRoomCompositeEgress(session.room_name, output, {
      layout: 'speaker',
      encodingOptions: EncodingOptionsPreset.H264_1080P_30,
    })

    await supabase
      .from('webinar_sessions')
      .update({ recording_path: filepath })
      .eq('id', session.id)

    return { ok: true, egressId: info.egressId, filepath }
  } catch (err: any) {
    console.error('[webinar] startRoomCompositeEgress failed', err)
    return { ok: false, error: err?.message || 'Failed to start recording' }
  }
}

export async function stopSessionRecording(
  egressId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!livekitConfigured()) return { ok: false, error: 'LiveKit is not configured' }
  try {
    await egressClient().stopEgress(egressId)
    return { ok: true }
  } catch (err: any) {
    // Egress that already stopped on its own (room emptied) is not an error.
    if (/not found|already/i.test(err?.message || '')) return { ok: true }
    console.error('[webinar] stopEgress failed', err)
    return { ok: false, error: err?.message || 'Failed to stop recording' }
  }
}

// ── Vimeo transfer ──────────────────────────────────────────────────

export const VIMEO_RECORDINGS_FOLDER_ID = process.env.VIMEO_RECORDINGS_FOLDER_ID

/**
 * Hands the recording to Vimeo as a "pull" upload: we mint a signed URL for
 * the object and Vimeo fetches it itself. The bucket stays private.
 *
 * The signed URL is deliberately long-lived (24h) — Vimeo queues pull uploads
 * rather than fetching immediately, and a one-hour expiry will bite on a busy
 * day.
 */
export async function transferRecordingToVimeo(
  supabase: SupabaseClient,
  session: {
    id: string
    event_id: string
    recording_path: string | null
  }
): Promise<{ ok: true; vimeoId: string } | { ok: false; error: string }> {
  if (!process.env.VIMEO_ACCESS_TOKEN) return { ok: false, error: 'VIMEO_ACCESS_TOKEN is not set' }
  if (!session.recording_path) return { ok: false, error: 'No recording file for this session' }

  const { data: event } = await supabase
    .from('events')
    .select('title, description_plain, starts_at')
    .eq('id', session.event_id)
    .maybeSingle()

  const { data: signed, error: signError } = await supabase.storage
    .from(S3_BUCKET)
    .createSignedUrl(session.recording_path, 60 * 60 * 24)

  if (signError || !signed?.signedUrl) {
    return { ok: false, error: signError?.message || 'Could not sign the recording URL' }
  }

  const payload: Record<string, any> = {
    upload: { approach: 'pull', link: signed.signedUrl },
    name: event?.title || 'Dukes’ Club webinar',
    description: event?.description_plain || undefined,
    privacy: { view: 'unlisted', embed: 'whitelist' },
  }

  if (VIMEO_RECORDINGS_FOLDER_ID) {
    payload.folder_uri = `/me/projects/${VIMEO_RECORDINGS_FOLDER_ID}`
  }

  try {
    const res = await fetch(`${VIMEO_API}/me/videos`, {
      method: 'POST',
      headers: { ...VIMEO_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text()
      // The most common cause here is a read-only Vimeo token. The existing
      // integration only ever does GETs, so the token in use may well lack the
      // upload/edit/private scopes this needs.
      return {
        ok: false,
        error: `Vimeo rejected the upload (${res.status}): ${text.slice(0, 300)}`,
      }
    }

    const data = await res.json()
    const vimeoId = String(data.uri || '').split('/').pop()?.split(':')[0]
    if (!vimeoId) return { ok: false, error: 'Vimeo did not return a video id' }

    return { ok: true, vimeoId }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Vimeo upload request failed' }
  }
}

/** Polls Vimeo for transcode completion. Pull uploads give no callback. */
export async function checkVimeoTranscode(
  vimeoId: string
): Promise<{ state: 'pending' | 'complete' | 'error'; detail?: string }> {
  try {
    const res = await fetch(
      `${VIMEO_API}/videos/${vimeoId}?fields=upload.status,transcode.status`,
      { headers: VIMEO_HEADERS }
    )
    if (!res.ok) return { state: 'pending', detail: `Vimeo returned ${res.status}` }

    const data = await res.json()
    if (data.upload?.status === 'error') return { state: 'error', detail: 'Vimeo upload failed' }
    if (data.transcode?.status === 'error') return { state: 'error', detail: 'Vimeo transcode failed' }
    if (data.transcode?.status === 'complete') return { state: 'complete' }
    return { state: 'pending' }
  } catch (err: any) {
    return { state: 'pending', detail: err?.message }
  }
}
