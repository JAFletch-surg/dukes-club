import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'
import {
  AccessToken,
  EgressClient,
  RoomServiceClient,
  type VideoGrant,
} from 'livekit-server-sdk'
import {
  guestIdentity,
  memberIdentity,
  type WebinarParticipantMetadata,
  type WebinarRole,
} from '@/lib/webinars'

// ── Supabase (service role — these routes need to read event_bookings and
//    webinar_speakers past RLS) ───────────────────────────────────────

export function getSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── LiveKit ─────────────────────────────────────────────────────────

export const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY
export const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET
/** https:// URL for the server SDK (RoomService / Egress). */
export const LIVEKIT_HTTP_URL = process.env.LIVEKIT_HTTP_URL
/** wss:// URL handed to the browser. */
export const LIVEKIT_WS_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL

export function livekitConfigured(): boolean {
  return !!(LIVEKIT_API_KEY && LIVEKIT_API_SECRET && LIVEKIT_HTTP_URL && LIVEKIT_WS_URL)
}

export function roomService(): RoomServiceClient {
  return new RoomServiceClient(LIVEKIT_HTTP_URL!, LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!)
}

export function egressClient(): EgressClient {
  return new EgressClient(LIVEKIT_HTTP_URL!, LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!)
}

interface MintOptions {
  room: string
  identity: string
  name: string
  metadata: WebinarParticipantMetadata
  role: WebinarRole
  ttl?: string
}

/**
 * Mints a LiveKit access token.
 *
 * The grants below are enforced by the LiveKit server, not the client — an
 * attendee with canPublish:false cannot publish a track however much they
 * poke at the SDK in devtools. That is the whole reason this is server-side.
 *
 * NOTE: in livekit-server-sdk v2 `toJwt()` is ASYNC. Forgetting the await
 * yields the string "[object Promise]" and every join fails with an opaque
 * error — and since next.config.ts ignores type errors at build, nothing
 * catches it before it is live.
 */
export async function mintToken(opts: MintOptions): Promise<string> {
  const { room, identity, name, metadata, role, ttl } = opts

  const at = new AccessToken(LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!, {
    identity,
    name,
    metadata: JSON.stringify(metadata),
    ttl: ttl ?? '5h',
  })

  const grant: VideoGrant = {
    room,
    roomJoin: true,
    canSubscribe: true,
    // Attendees are view-only: no camera, no microphone, no screen share, and
    // no data channel either — all attendee text goes through Supabase so it
    // is persisted, moderatable and RLS-checked.
    canPublish: role !== 'attendee',
    canPublishData: role !== 'attendee',
    canUpdateOwnMetadata: role !== 'attendee',
  }

  // No canPublishSources restriction: with canPublish true, LiveKit already
  // permits camera, microphone, screen share and screen-share audio, which is
  // exactly what a speaker presenting slides needs.

  if (role === 'host') {
    grant.roomAdmin = true   // mute / remove participants from the studio
    grant.roomRecord = true
  }

  at.addGrant(grant)
  return await at.toJwt()
}

// ── Auth ────────────────────────────────────────────────────────────

export type AuthedUser = { id: string; fullName: string; role: string; avatarUrl: string | null }

export type AdminAuth =
  | { ok: true; supabase: SupabaseClient; user: AuthedUser }
  | { ok: false; response: NextResponse }

async function resolveBearer(
  request: NextRequest,
  supabase: SupabaseClient
): Promise<AuthedUser | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, avatar_url, approval_status')
    .eq('id', user.id)
    .single()

  if (!profile || profile.approval_status !== 'approved') return null

  return {
    id: user.id,
    fullName: profile.full_name || user.email || 'Member',
    role: profile.role,
    avatarUrl: profile.avatar_url ?? null,
  }
}

const ADMIN_ROLES = ['admin', 'super_admin', 'editor']

export function isAdminRole(role: string | null | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role)
}

/**
 * Bearer token → Supabase user → admin role check.
 *
 * Deliberately includes 'editor', matching the is_admin() SQL helper and the
 * middleware gate on /admin. (app/api/vimeo/_shared.ts uses a stricter list;
 * that one is left alone.)
 */
export async function requireAdmin(request: NextRequest): Promise<AdminAuth> {
  const supabase = getSupabase()
  const user = await resolveBearer(request, supabase)

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!isAdminRole(user.role)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 }) }
  }
  return { ok: true, supabase, user }
}

/** Bearer token → any approved member. Used by the token route before it
 *  decides whether the caller is a host or an attendee. */
export async function requireMember(
  request: NextRequest
): Promise<{ ok: true; supabase: SupabaseClient; user: AuthedUser } | { ok: false; response: NextResponse }> {
  const supabase = getSupabase()
  const user = await resolveBearer(request, supabase)
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { ok: true, supabase, user }
}

// ── Speaker magic-link tokens ───────────────────────────────────────

/** 32 random bytes, URL-safe. Shown to the admin once and emailed; only the
 *  hash is ever stored. */
export function generateSpeakerToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url')
  return { raw, hash: hashSpeakerToken(raw) }
}

export function hashSpeakerToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export interface ResolvedSpeaker {
  id: string
  session_id: string
  name: string
  email: string | null
  role: 'host' | 'speaker' | 'moderator'
}

/**
 * Exchanges a raw magic-link token for the speaker row it belongs to.
 * Returns null for unknown, revoked or expired tokens — the caller must not
 * distinguish between those cases in its response.
 */
export async function resolveSpeakerToken(
  supabase: SupabaseClient,
  rawToken: string | null | undefined
): Promise<ResolvedSpeaker | null> {
  if (!rawToken) return null

  const { data } = await supabase
    .from('webinar_speakers')
    .select('id, session_id, name, email, role, expires_at, revoked_at')
    .eq('token_hash', hashSpeakerToken(rawToken))
    .maybeSingle()

  if (!data) return null
  if (data.revoked_at) return null
  if (new Date(data.expires_at).getTime() < Date.now()) return null

  return {
    id: data.id,
    session_id: data.session_id,
    name: data.name,
    email: data.email,
    role: data.role,
  }
}

// ── Booking check ───────────────────────────────────────────────────

export type BookingCheck = 'ok' | 'pending' | 'none'

/** Does this member hold a live registration for the event behind a webinar? */
export async function checkBooking(
  supabase: SupabaseClient,
  eventId: string,
  userId: string
): Promise<BookingCheck> {
  const { data } = await supabase
    .from('event_bookings')
    .select('status')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return 'none'
  if (['approved', 'confirmed'].includes(data.status)) return 'ok'
  if (data.status === 'pending' || data.status === 'waitlisted') return 'pending'
  return 'none'
}

// ── Identity helpers re-exported so routes import from one place ─────

export { memberIdentity, guestIdentity }

/** Server-side identity parse, for the LiveKit webhook. Mirrors
 *  parseIdentity() in lib/webinars.ts. */
export function parseIdentityFromWebhook(identity: string): { kind: 'member' | 'guest' | 'other'; id: string | null } {
  if (identity.startsWith('u:')) return { kind: 'member', id: identity.slice(2) }
  if (identity.startsWith('g:')) return { kind: 'guest', id: identity.slice(2) }
  return { kind: 'other', id: null }
}

// ── Vimeo (re-exported from the existing integration so the recording
//    pipeline shares one set of credentials and headers) ──────────────

export { VIMEO_API, VIMEO_HEADERS, extractIdFromUri } from '../vimeo/_shared'
