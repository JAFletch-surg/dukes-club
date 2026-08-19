import { NextRequest, NextResponse } from 'next/server'
import {
  requireMember,
  mintToken,
  memberIdentity,
  checkBooking,
  isAdminRole,
  livekitConfigured,
  LIVEKIT_WS_URL,
} from '../_shared'
import type { WebinarRole } from '@/lib/webinars'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/webinars/token   { eventId }
 *
 * Mints a LiveKit token for a signed-in member. Three outcomes:
 *   admin / editor            → host grant (publish + roomAdmin + record)
 *   member listed as speaker  → speaker grant (publish)
 *   member with a live booking → attendee grant (SUBSCRIBE ONLY)
 *
 * Anyone else is refused. Guest speakers without an account use
 * /api/webinars/speaker-token instead.
 */
export async function POST(request: NextRequest) {
  if (!livekitConfigured()) {
    return NextResponse.json(
      { error: 'Live webinars are not configured on this deployment.' },
      { status: 503 }
    )
  }

  const auth = await requireMember(request)
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  let body: { eventId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const eventId = body.eventId
  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
  }

  const { data: session } = await supabase
    .from('webinar_sessions')
    .select('id, event_id, room_name, status')
    .eq('event_id', eventId)
    .maybeSingle()

  if (!session) {
    return NextResponse.json({ error: 'This event has no live room.' }, { status: 404 })
  }

  const admin = isAdminRole(user.role)

  // Is this member also on the speaker list? (A member speaker never needs a
  // magic link — they are recognised by their account.)
  const { data: speakerRow } = await supabase
    .from('webinar_speakers')
    .select('id, role, name, revoked_at')
    .eq('session_id', session.id)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .maybeSingle()

  let role: WebinarRole
  if (admin) {
    role = 'host'
  } else if (speakerRow) {
    role = speakerRow.role === 'host' ? 'host' : 'speaker'
  } else {
    // Plain attendee — must hold a live registration for the event.
    const booking = await checkBooking(supabase, eventId, user.id)
    if (booking === 'pending') {
      return NextResponse.json(
        { error: 'pending_approval', message: 'Your registration is awaiting approval.' },
        { status: 403 }
      )
    }
    if (booking === 'none') {
      return NextResponse.json(
        { error: 'not_registered', message: 'You need to register for this webinar first.' },
        { status: 403 }
      )
    }
    role = 'attendee'
  }

  // Attendees wait in the lobby until the host actually goes live. Hosts and
  // speakers can enter beforehand to set up.
  if (role === 'attendee' && session.status !== 'live') {
    return NextResponse.json(
      { error: 'not_live', message: 'The webinar has not started yet.', status: session.status },
      { status: 409 }
    )
  }

  if (session.status === 'ended' || session.status === 'published') {
    return NextResponse.json(
      { error: 'ended', message: 'This webinar has finished.' },
      { status: 409 }
    )
  }

  // Capacity ceiling — this is also the cost ceiling, since LiveKit bills per
  // participant-minute.
  if (role === 'attendee') {
    const { data: event } = await supabase
      .from('events')
      .select('capacity')
      .eq('id', eventId)
      .maybeSingle()

    if (event?.capacity) {
      const { count } = await supabase
        .from('webinar_attendance')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', session.id)
        .is('left_at', null)

      if ((count ?? 0) >= event.capacity) {
        return NextResponse.json(
          { error: 'at_capacity', message: 'This webinar is at capacity.' },
          { status: 409 }
        )
      }
    }
  }

  const token = await mintToken({
    room: session.room_name,
    identity: memberIdentity(user.id),
    name: user.fullName,
    role,
    metadata: { role, name: user.fullName, avatarUrl: user.avatarUrl },
  })

  return NextResponse.json({
    token,
    url: LIVEKIT_WS_URL,
    role,
    sessionId: session.id,
    roomName: session.room_name,
    identity: memberIdentity(user.id),
    displayName: user.fullName,
  })
}
