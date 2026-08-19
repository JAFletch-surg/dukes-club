import { NextRequest, NextResponse } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase, requireAdmin, VIMEO_API, VIMEO_HEADERS } from '../../_shared'
import {
  transferRecordingToVimeo,
  checkVimeoTranscode,
  settleEgress,
  S3_BUCKET,
} from '../../_recording'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/webinars/recordings/poll
 *
 * Drives the recording pipeline forward one step for every session that needs
 * it. Vimeo's pull upload is asynchronous and gives no callback, so polling is
 * the only way to know when a transcode has finished.
 *
 * Called by the Vercel cron (see vercel.json), and also by the "Check status"
 * button in the admin studio — Vercel Hobby plans only allow daily crons, so
 * the manual trigger is not optional.
 *
 * Auth: CRON_SECRET / INTERNAL_API_SECRET bearer, or an admin session.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET
  const authHeader = request.headers.get('authorization')
  const viaCron = secret && authHeader === `Bearer ${secret}`

  if (!viaCron) {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response
  }

  const supabase = getSupabase()
  const steps: string[] = []

  // ── 0. Finish off recordings LiveKit was still writing ────────────
  // A recording that was stopped but had not finished finalising when the
  // request returned sits here with its egress id still set. Without this it
  // would wait for a webhook that may never have been registered.
  const { data: stopping } = await supabase
    .from('webinar_sessions')
    .select('id, egress_id')
    .eq('recording_status', 'recording')
    .not('egress_id', 'is', null)
    .limit(5)

  for (const session of stopping ?? []) {
    const state = await settleEgress(supabase, session.id, session.egress_id!)
    if (state === 'settled') steps.push(`session ${session.id}: recording finalised`)
  }

  // ── 1. Hand freshly-uploaded recordings to Vimeo ──────────────────
  const { data: uploaded } = await supabase
    .from('webinar_sessions')
    .select('id, event_id, recording_path')
    .eq('recording_status', 'uploaded')
    .limit(5)

  for (const session of uploaded ?? []) {
    const result = await transferRecordingToVimeo(supabase, session)
    if (result.ok) {
      await supabase
        .from('webinar_sessions')
        .update({
          vimeo_id: result.vimeoId,
          recording_status: 'transferring',
          // A folder problem is a warning, not a failure — the recording is
          // safely on Vimeo either way. Surfacing it on the admin card is how
          // anyone finds out the sync will not be managing this video.
          recording_error: result.folderError,
        })
        .eq('id', session.id)
      steps.push(
        `session ${session.id}: handed to Vimeo as ${result.vimeoId}` +
          (result.folderError ? ` (warning: ${result.folderError})` : '')
      )
    } else {
      await supabase
        .from('webinar_sessions')
        .update({ recording_status: 'failed', recording_error: result.error })
        .eq('id', session.id)
      steps.push(`session ${session.id}: transfer FAILED — ${result.error}`)
    }
  }

  // ── 2. Poll transcodes, then publish ──────────────────────────────
  const { data: transferring } = await supabase
    .from('webinar_sessions')
    .select('id, event_id, vimeo_id, recording_path')
    .eq('recording_status', 'transferring')
    .not('vimeo_id', 'is', null)
    .limit(10)

  for (const session of transferring ?? []) {
    const check = await checkVimeoTranscode(session.vimeo_id!)

    if (check.state === 'error') {
      await supabase
        .from('webinar_sessions')
        .update({ recording_status: 'failed', recording_error: check.detail || 'Vimeo processing failed' })
        .eq('id', session.id)
      steps.push(`session ${session.id}: Vimeo processing FAILED`)
      continue
    }

    if (check.state !== 'complete') {
      steps.push(`session ${session.id}: still transcoding`)
      continue
    }

    const videoId = await publishRecording(supabase, session)
    if (!videoId) {
      steps.push(`session ${session.id}: could not create the videos row`)
      continue
    }

    await supabase
      .from('webinar_sessions')
      .update({
        recording_status: 'done',
        status: 'published',
        recording_video_id: videoId,
        recording_error: null,
      })
      .eq('id', session.id)

    // The MP4 has served its purpose — Vimeo has its own copy and is the
    // playback path. Leaving multi-GB files in storage forever is a slow leak.
    if (session.recording_path) {
      await supabase.storage.from(S3_BUCKET).remove([session.recording_path])
    }

    steps.push(`session ${session.id}: published as video ${videoId}`)
  }

  return NextResponse.json({ ok: true, steps })
}

/**
 * Creates (or updates) the `videos` row for a finished recording and links it
 * to its event.
 *
 * Note: the recording must live in a Vimeo folder that is registered in
 * `vimeo_folders`, otherwise the next run of /api/vimeo/sync will archive it
 * for not belonging to any synced folder. That is what
 * VIMEO_RECORDINGS_FOLDER_ID is for.
 */
async function publishRecording(
  supabase: SupabaseClient,
  session: { id: string; event_id: string; vimeo_id: string | null }
): Promise<string | null> {
  if (!session.vimeo_id) return null

  const { data: event } = await supabase
    .from('events')
    .select('title, slug, description_plain, subspecialties')
    .eq('id', session.event_id)
    .maybeSingle()

  // Pull the canonical metadata Vimeo generated during transcode.
  let duration = 0
  let thumbnail: string | null = null
  try {
    const res = await fetch(
      `${VIMEO_API}/videos/${session.vimeo_id}?fields=duration,pictures.sizes,privacy.view`,
      { headers: VIMEO_HEADERS }
    )
    if (res.ok) {
      const data = await res.json()
      duration = data.duration ?? 0
      const sizes = data.pictures?.sizes ?? []
      thumbnail = sizes[sizes.length - 1]?.link ?? null
    }
  } catch {
    // Metadata is a nicety — /api/vimeo/sync will fill it in on its next run.
  }

  const { data: existing } = await supabase
    .from('videos')
    .select('id')
    .eq('vimeo_id', session.vimeo_id)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('videos')
      .update({ event_id: session.event_id, category: 'Webinar' })
      .eq('id', existing.id)
    return existing.id
  }

  const { data: created, error } = await supabase
    .from('videos')
    .insert({
      vimeo_id: session.vimeo_id,
      title: event?.title || 'Webinar recording',
      slug: `${(event?.slug || 'webinar')}-recording`,
      description: event?.description_plain || null,
      duration_seconds: duration,
      thumbnail_url: thumbnail,
      category: 'Webinar',
      tags: event?.subspecialties ?? null,
      event_id: session.event_id,
      is_members_only: true,
      status: 'published',
      published_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('[webinar] failed to create videos row', error)
    return null
  }
  return created.id
}
