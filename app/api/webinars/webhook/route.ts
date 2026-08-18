import { NextRequest, NextResponse } from 'next/server'
import { WebhookReceiver } from 'livekit-server-sdk'
import { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, parseIdentityFromWebhook } from '../_shared'
import { applyEgressResult } from '../_recording'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/webinars/webhook — LiveKit server webhooks.
 *
 * Register this URL in the LiveKit Cloud project settings:
 *   https://<site>/api/webinars/webhook
 *
 * Everything here is server-to-server and signature-verified. This is the only
 * trustworthy source of attendance data — a client can close a tab without
 * firing anything.
 */
export async function POST(request: NextRequest) {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return NextResponse.json({ error: 'LiveKit is not configured' }, { status: 503 })
  }

  // The signature is computed over the raw bytes — read text(), never json().
  const body = await request.text()
  const authHeader = request.headers.get('authorization')

  let event: any
  try {
    const receiver = new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    event = await receiver.receive(body, authHeader ?? undefined)
  } catch (err: any) {
    console.error('[webinar webhook] signature verification failed', err?.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const supabase = getSupabase()

  try {
    switch (event.event) {
      case 'participant_joined':
        await onParticipantJoined(supabase, event)
        break
      case 'participant_left':
        await onParticipantLeft(supabase, event)
        break
      case 'room_finished':
        await onRoomFinished(supabase, event)
        break
      case 'egress_started':
        await onEgressStarted(supabase, event)
        break
      case 'egress_ended':
        await onEgressEnded(supabase, event)
        break
      default:
        break
    }
  } catch (err: any) {
    // Never 500 back at LiveKit — it retries, and a retry storm on a bad row
    // helps nobody. Log and acknowledge.
    console.error(`[webinar webhook] handler for ${event.event} failed`, err)
  }

  return NextResponse.json({ received: true })
}

async function sessionForRoom(supabase: SupabaseClient, roomName: string | undefined) {
  if (!roomName) return null
  const { data } = await supabase
    .from('webinar_sessions')
    .select('id, event_id, status, peak_attendees, recording_path')
    .eq('room_name', roomName)
    .maybeSingle()
  return data
}

async function onParticipantJoined(supabase: SupabaseClient, event: any) {
  const session = await sessionForRoom(supabase, event.room?.name)
  if (!session) return

  const identity: string = event.participant?.identity || ''
  const parsed = parseIdentityFromWebhook(identity)

  // Only members get an attendance row — guests are speakers, and the egress
  // recorder joins as a participant too.
  if (parsed.kind === 'member' && parsed.id) {
    await supabase
      .from('webinar_attendance')
      .upsert(
        {
          session_id: session.id,
          user_id: parsed.id,
          joined_at: new Date().toISOString(),
          left_at: null,
        },
        { onConflict: 'session_id,user_id' }
      )
  }

  const live = Number(event.room?.numParticipants ?? 0)
  if (live > (session.peak_attendees ?? 0)) {
    await supabase
      .from('webinar_sessions')
      .update({ peak_attendees: live })
      .eq('id', session.id)
  }
}

async function onParticipantLeft(supabase: SupabaseClient, event: any) {
  const session = await sessionForRoom(supabase, event.room?.name)
  if (!session) return

  const parsed = parseIdentityFromWebhook(event.participant?.identity || '')
  if (parsed.kind !== 'member' || !parsed.id) return

  const { data: row } = await supabase
    .from('webinar_attendance')
    .select('id, joined_at, seconds_watched')
    .eq('session_id', session.id)
    .eq('user_id', parsed.id)
    .maybeSingle()

  if (!row) return

  const extra = Math.max(
    0,
    Math.floor((Date.now() - new Date(row.joined_at).getTime()) / 1000)
  )

  await supabase
    .from('webinar_attendance')
    .update({
      left_at: new Date().toISOString(),
      seconds_watched: (row.seconds_watched ?? 0) + extra,
    })
    .eq('id', row.id)
}

async function onRoomFinished(supabase: SupabaseClient, event: any) {
  const session = await sessionForRoom(supabase, event.room?.name)
  if (!session) return

  await supabase
    .from('webinar_attendance')
    .update({ left_at: new Date().toISOString() })
    .eq('session_id', session.id)
    .is('left_at', null)

  // Defensive: if the host's browser died mid-session, close the session out.
  if (session.status === 'live') {
    await supabase
      .from('webinar_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', session.id)
  }
}

async function onEgressStarted(supabase: SupabaseClient, event: any) {
  const egressId = event.egressInfo?.egressId
  if (!egressId) return

  await supabase
    .from('webinar_sessions')
    .update({ recording_status: 'recording', recording_error: null })
    .eq('egress_id', egressId)
}

/**
 * The recording is finished and uploaded to storage.
 *
 * The Vimeo handoff is attempted inline, because the cron behind
 * /api/webinars/recordings/poll only runs daily — Vercel's Hobby plan rejects
 * any schedule more frequent than that, and this project is on Hobby. Waiting
 * for the cron would leave a recording sitting unpublished for up to 24 hours.
 *
 * The pull upload only queues the job with Vimeo, so this stays fast. If it
 * fails the row is left at 'uploaded', which is exactly the state the cron and
 * the admin "Check recordings" button retry from — a Vimeo outage delays the
 * recording, it never loses it.
 */
async function onEgressEnded(supabase: SupabaseClient, event: any) {
  const info = event.egressInfo
  const egressId = info?.egressId
  if (!egressId) return

  const { data: session } = await supabase
    .from('webinar_sessions')
    .select('id')
    .eq('egress_id', egressId)
    .maybeSingle()

  if (!session) return

  const file = info.fileResults?.[0] ?? info.file
  // EGRESS_COMPLETE is 3 in the egress status enum.
  const complete = (info.status === undefined || info.status === 3) && !!file?.filename

  await supabase
    .from('webinar_sessions')
    .update({ status: 'processing' })
    .eq('id', session.id)

  await applyEgressResult(supabase, session.id, {
    complete,
    filename: file?.filename ?? null,
    error: info.error || null,
  })
}
