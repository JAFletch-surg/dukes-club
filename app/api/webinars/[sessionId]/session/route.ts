import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, roomService, livekitConfigured } from '../../_shared'
import { startSessionRecording, stopSessionRecording, settleEgress } from '../../_recording'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ sessionId: string }> }

/**
 * PATCH /api/webinars/[sessionId]/session
 *
 * The host's lifecycle control. Admin only.
 *   { action: 'go-live' }  → status=live, started_at, start egress if armed
 *   { action: 'end' }      → stop egress, disconnect everyone, status=ended
 *   { action: 'settings', chat_enabled?, qa_enabled?, polls_enabled?, recording_enabled? }
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response
  const { supabase } = auth
  const { sessionId } = await ctx.params

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { data: session } = await supabase
    .from('webinar_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // ── Go live ──────────────────────────────────────────────────────
  if (body.action === 'go-live') {
    if (session.status === 'live') {
      return NextResponse.json({ ok: true, session, note: 'Already live' })
    }

    const update: Record<string, any> = {
      status: 'live',
      started_at: session.started_at ?? new Date().toISOString(),
    }

    let recordingWarning: string | null = null
    if (session.recording_enabled) {
      const result = await startSessionRecording(supabase, session)
      if (result.ok) {
        update.egress_id = result.egressId
        update.recording_status = 'recording'
      } else {
        // Never block going live because recording failed — the audience is
        // waiting. Surface it in the studio instead.
        recordingWarning = result.error
        update.recording_status = 'failed'
        update.recording_error = result.error
      }
    }

    const { data: updated } = await supabase
      .from('webinar_sessions')
      .update(update)
      .eq('id', sessionId)
      .select()
      .single()

    return NextResponse.json({ ok: true, session: updated, recordingWarning })
  }

  // ── End ──────────────────────────────────────────────────────────
  if (body.action === 'end') {
    // Order matters: stop egress and let LiveKit finalise the file BEFORE
    // deleting the room. Deleting first truncates or loses the recording, and
    // you only find that out an hour later.
    let recordingWarning: string | null = null
    if (session.egress_id) {
      const result = await stopSessionRecording(session.egress_id)
      if (!result.ok) recordingWarning = result.error
      // Ask LiveKit what actually happened and move the recording along, rather
      // than waiting on a webhook that may never have been registered.
      await settleEgress(supabase, sessionId, session.egress_id)
    }

    if (livekitConfigured()) {
      try {
        await roomService().deleteRoom(session.room_name)
      } catch (err: any) {
        // A room with nobody in it does not exist server-side; that is fine.
        if (!/not found/i.test(err?.message || '')) {
          console.error('[webinar] deleteRoom failed', err)
        }
      }
    }

    const { data: updated } = await supabase
      .from('webinar_sessions')
      // recording_status is deliberately NOT set here. `session` was read
      // before settleEgress() ran, so writing it back would stamp 'recording'
      // over the progress settleEgress just made and strand the file — the
      // cron and the admin button both look for 'uploaded'. That column is
      // owned by settleEgress and the webhook; this action owns status only.
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single()

    // Close any attendance rows still open.
    await supabase
      .from('webinar_attendance')
      .update({ left_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .is('left_at', null)

    return NextResponse.json({ ok: true, session: updated, recordingWarning })
  }

  // ── Feature toggles ──────────────────────────────────────────────
  if (body.action === 'settings') {
    const allowed = ['chat_enabled', 'qa_enabled', 'polls_enabled', 'recording_enabled'] as const
    const update: Record<string, any> = {}
    for (const key of allowed) {
      if (typeof body[key] === 'boolean') update[key] = body[key]
    }
    if (!Object.keys(update).length) {
      return NextResponse.json({ error: 'No settings supplied' }, { status: 400 })
    }

    const { data: updated } = await supabase
      .from('webinar_sessions')
      .update(update)
      .eq('id', sessionId)
      .select()
      .single()

    return NextResponse.json({ ok: true, session: updated })
  }

  // ── Stage layout ─────────────────────────────────────────────────
  // Host-authoritative: everyone renders from these two columns, so a handover
  // can't leave two attendees looking at different people.
  if (body.action === 'stage') {
    const mode = body.stageMode
    if (!['auto', 'spotlight', 'grid'].includes(mode)) {
      return NextResponse.json({ error: 'Unknown stage mode' }, { status: 400 })
    }

    const { data: updated } = await supabase
      .from('webinar_sessions')
      .update({
        stage_mode: mode,
        spotlight_identity: mode === 'spotlight' ? (body.identity ?? null) : null,
      })
      .eq('id', sessionId)
      .select()
      .single()

    return NextResponse.json({ ok: true, session: updated })
  }

  // ── Participant moderation ───────────────────────────────────────
  // The host token already carries roomAdmin, so these are permitted; there
  // was simply no way to reach them from the UI.
  if (body.action === 'mute' || body.action === 'remove') {
    if (!livekitConfigured()) {
      return NextResponse.json({ error: 'LiveKit is not configured' }, { status: 503 })
    }
    if (!body.identity) {
      return NextResponse.json({ error: 'identity is required' }, { status: 400 })
    }

    try {
      const service = roomService()

      if (body.action === 'remove') {
        await service.removeParticipant(session.room_name, body.identity)
      } else {
        const participant = await service.getParticipant(session.room_name, body.identity)
        const audio = participant.tracks.find(t => t.type === 1 /* AUDIO */)
        if (audio) {
          await service.mutePublishedTrack(session.room_name, body.identity, audio.sid, true)
        }
      }

      // Someone who has been removed or is no longer publishing should not be
      // left spotlit on an empty stage.
      if (body.action === 'remove' && session.spotlight_identity === body.identity) {
        await supabase
          .from('webinar_sessions')
          .update({ stage_mode: 'auto', spotlight_identity: null })
          .eq('id', sessionId)
      }

      return NextResponse.json({ ok: true })
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message || 'Could not update that participant' },
        { status: 502 }
      )
    }
  }

  // ── Manual recording control ─────────────────────────────────────
  if (body.action === 'start-recording' || body.action === 'stop-recording') {
    if (!livekitConfigured()) {
      return NextResponse.json({ error: 'LiveKit is not configured' }, { status: 503 })
    }

    if (body.action === 'start-recording') {
      if (session.egress_id) {
        return NextResponse.json({ ok: true, note: 'Already recording' })
      }
      const result = await startSessionRecording(supabase, session)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })

      const { data: updated } = await supabase
        .from('webinar_sessions')
        .update({ egress_id: result.egressId, recording_status: 'recording', recording_error: null })
        .eq('id', sessionId)
        .select()
        .single()
      return NextResponse.json({ ok: true, session: updated })
    }

    if (!session.egress_id) {
      return NextResponse.json({ ok: true, note: 'Not recording' })
    }
    const result = await stopSessionRecording(session.egress_id)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })

    await settleEgress(supabase, sessionId, session.egress_id)

    const { data: updated } = await supabase
      .from('webinar_sessions')
      .select()
      .eq('id', sessionId)
      .single()

    return NextResponse.json({ ok: true, session: updated })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

/** GET — live participant roster, straight from LiveKit. Admin only. */
export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response
  const { supabase } = auth
  const { sessionId } = await ctx.params

  const { data: session } = await supabase
    .from('webinar_sessions')
    .select('id, room_name, status')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  if (!livekitConfigured()) return NextResponse.json({ participants: [] })

  try {
    const participants = await roomService().listParticipants(session.room_name)
    return NextResponse.json({
      participants: participants.map(p => ({
        identity: p.identity,
        name: p.name,
        metadata: p.metadata,
        joinedAt: Number(p.joinedAt),
        isPublisher: p.tracks.length > 0,
      })),
    })
  } catch {
    // Room does not exist yet — nobody has joined.
    return NextResponse.json({ participants: [] })
  }
}
