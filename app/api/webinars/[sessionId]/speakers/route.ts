import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, generateSpeakerToken } from '../../_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ sessionId: string }> }

/**
 * POST /api/webinars/[sessionId]/speakers
 *   { name, email?, role?, sendEmail? }        → invite a guest speaker
 *   { speakerId, action: 'revoke' }            → kill a link
 *   { speakerId, action: 'regenerate' }        → new link, old one dies
 *
 * The raw magic-link token is returned exactly ONCE, in the response to this
 * call. Only its hash is stored, so it cannot be recovered later — "resend"
 * mints a fresh token and invalidates the previous one.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
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
    .select('id, event_id')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const { data: event } = await supabase
    .from('events')
    .select('slug, title, starts_at, ends_at')
    .eq('id', session.event_id)
    .maybeSingle()

  // Links stay valid until a day after the event, so a speaker who rejoins
  // after a dropout is not locked out mid-webinar.
  const expiresAt = new Date(
    new Date(event?.ends_at || event?.starts_at || Date.now()).getTime() + 24 * 60 * 60 * 1000
  ).toISOString()

  // ── Revoke ───────────────────────────────────────────────────────
  if (body.action === 'revoke') {
    if (!body.speakerId) return NextResponse.json({ error: 'speakerId required' }, { status: 400 })
    await supabase
      .from('webinar_speakers')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', body.speakerId)
      .eq('session_id', sessionId)
    return NextResponse.json({ ok: true })
  }

  // ── Regenerate ───────────────────────────────────────────────────
  if (body.action === 'regenerate') {
    if (!body.speakerId) return NextResponse.json({ error: 'speakerId required' }, { status: 400 })
    const { raw, hash } = generateSpeakerToken()

    const { data: updated, error } = await supabase
      .from('webinar_speakers')
      .update({ token_hash: hash, revoked_at: null, expires_at: expiresAt })
      .eq('id', body.speakerId)
      .eq('session_id', sessionId)
      .select('id, name, email, role')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({
      ok: true,
      speaker: updated,
      inviteUrl: speakerUrl(request, event?.slug, raw),
    })
  }

  // ── Create ───────────────────────────────────────────────────────
  const name = (body.name || '').trim()
  if (!name) return NextResponse.json({ error: 'A speaker name is required' }, { status: 400 })

  const { raw, hash } = generateSpeakerToken()

  const { data: created, error } = await supabase
    .from('webinar_speakers')
    .insert({
      session_id: sessionId,
      name,
      email: (body.email || '').trim() || null,
      role: ['host', 'speaker', 'moderator'].includes(body.role) ? body.role : 'speaker',
      token_hash: hash,
      expires_at: expiresAt,
      user_id: body.userId || null,
      faculty_id: body.facultyId || null,
    })
    .select('id, name, email, role, expires_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({
    ok: true,
    speaker: created,
    inviteUrl: speakerUrl(request, event?.slug, raw),
    eventTitle: event?.title,
    startsAt: event?.starts_at,
  })
}

/**
 * Builds the speaker's magic link against the deployment that issued it.
 *
 * NEXT_PUBLIC_SITE_URL points at production even on a Vercel preview, so using
 * it here sent testers' invites to the live site — which 404s until the branch
 * is merged. Deriving the origin from the request means a preview issues
 * preview links and production issues production links, with no configuration,
 * and a staging invite can never route someone to production by accident.
 */
function speakerUrl(request: NextRequest, slug: string | undefined, rawToken: string): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'

  const base =
    (forwardedHost ? `${forwardedProto}://${forwardedHost}` : null) ??
    request.nextUrl.origin ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    ''

  return `${base}/webinar/${slug ?? ''}/speaker?t=${rawToken}`
}
