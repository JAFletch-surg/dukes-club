import { NextRequest, NextResponse } from 'next/server'
import {
  getSupabase,
  resolveSpeakerToken,
  mintToken,
  guestIdentity,
  livekitConfigured,
  LIVEKIT_WS_URL,
} from '../_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/webinars/speaker-token   { inviteToken, displayName? }
 *
 * The guest-speaker path. Deliberately takes NO Supabase auth header — a
 * visiting consultant has no account here. The magic-link token is hashed and
 * matched against webinar_speakers.token_hash; the raw token exists only in
 * their email and the URL.
 *
 * Unknown, revoked and expired tokens all return the same 401 so a caller
 * cannot probe which is which.
 */
export async function POST(request: NextRequest) {
  if (!livekitConfigured()) {
    return NextResponse.json(
      { error: 'Live webinars are not configured on this deployment.' },
      { status: 503 }
    )
  }

  let body: { inviteToken?: string; displayName?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const supabase = getSupabase()
  const speaker = await resolveSpeakerToken(supabase, body.inviteToken)

  if (!speaker) {
    return NextResponse.json(
      { error: 'invalid_invite', message: 'This speaker link is not valid or has expired.' },
      { status: 401 }
    )
  }

  const { data: session } = await supabase
    .from('webinar_sessions')
    .select('id, event_id, room_name, status')
    .eq('id', speaker.session_id)
    .maybeSingle()

  if (!session) {
    return NextResponse.json({ error: 'This webinar no longer exists.' }, { status: 404 })
  }

  if (session.status === 'ended' || session.status === 'published') {
    return NextResponse.json(
      { error: 'ended', message: 'This webinar has finished.' },
      { status: 409 }
    )
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, title, slug, starts_at, ends_at')
    .eq('id', session.event_id)
    .maybeSingle()

  // Let the speaker correct their own name in the green room, and keep the
  // host's speaker list in step with what the audience actually sees.
  const displayName = (body.displayName || '').trim() || speaker.name

  await supabase
    .from('webinar_speakers')
    .update({
      name: displayName,
      last_joined_at: new Date().toISOString(),
    })
    .eq('id', speaker.id)

  const role = speaker.role === 'host' ? 'host' : 'speaker'

  const token = await mintToken({
    room: session.room_name,
    identity: guestIdentity(speaker.id),
    name: displayName,
    role,
    metadata: { role, name: displayName },
  })

  return NextResponse.json({
    token,
    url: LIVEKIT_WS_URL,
    role,
    sessionId: session.id,
    roomName: session.room_name,
    sessionStatus: session.status,
    identity: guestIdentity(speaker.id),
    displayName,
    event: event
      ? { id: event.id, title: event.title, slug: event.slug, startsAt: event.starts_at, endsAt: event.ends_at }
      : null,
  })
}
