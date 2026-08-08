import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { weekendWaitlistPromotedEmail } from '@/lib/emails/templates'
import { weekendErrorMessage } from '@/lib/events'

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.thedukesclub.org.uk'

/** Service-role client. Bypasses RLS — only for reads the caller is entitled to. */
export function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * A client that acts AS the calling member.
 *
 * The weekend booking functions are SECURITY DEFINER and read auth.uid() to
 * decide who is booking, so they must be called on a client carrying the
 * member's own JWT. Calling them on the service-role client would leave
 * auth.uid() NULL and every call would fail NOT_AUTHENTICATED — which is the
 * safe direction, but it also means a route physically cannot act on behalf
 * of a member it has not authenticated.
 */
export function userClient(token: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export interface AuthedRequest {
  token: string
  userId: string
  email: string
}

/**
 * Authenticate the Bearer token, following the pattern in
 * app/api/membership/submit-number/route.ts.
 */
export async function authenticate(
  request: NextRequest
): Promise<{ auth: AuthedRequest } | { error: NextResponse }> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await serviceClient().auth.getUser(token)

  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  return { auth: { token, userId: user.id, email: user.email || '' } }
}

/** True when the caller is an admin, editor or super admin. */
export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await serviceClient()
    .from('profiles')
    .select('role, approval_status')
    .eq('id', userId)
    .single()

  return !!data
    && ['admin', 'super_admin', 'editor'].includes(data.role)
    && data.approval_status === 'approved'
}

// Rule violations are the member's problem to fix (422); everything else is
// ours. Distinguishing them keeps a genuine 500 visible in the logs instead
// of being buried under ordinary validation noise.
const CLIENT_ERROR_CODES = new Set([
  'NOT_A_MEMBER', 'NOT_AUTHENTICATED', 'NOT_A_WEEKEND_EVENT', 'EVENT_NOT_FOUND',
  'EVENT_NOT_PUBLISHED', 'BOOKING_CLOSED', 'NO_DAYS_SELECTED', 'SUNDAY_REQUIRES_SATURDAY',
  'INVALID_SATURDAY_MODE', 'STREAMING_NOT_AVAILABLE', 'NO_WEEKEND_BOOKING',
  'NOT_ATTENDING_FRIDAY', 'NOT_ATTENDING_SUNDAY', 'ALREADY_BOOKED', 'COURSE_NOT_FOUND',
  'COURSE_FULL', 'COURSE_BOOKING_NOT_FOUND', 'NOT_YOUR_BOOKING',
  'FRIDAY_ROOM_REQUIRES_FRIDAY_COURSE', 'FRIDAY_ROOMS_FULL', 'SATURDAY_ROOMS_FULL',
  'NOT_AN_ADMIN', 'INVALID_PAYMENT_STATUS',
])

/**
 * Turn a Postgres error from the weekend functions into an HTTP response.
 *
 * Three things travel back:
 *   error  — wording a member can act on
 *   code   — the raw machine code, so the UI can react to specifics (offering
 *            a waitlist on COURSE_FULL, say) without parsing prose
 *   detail — the underlying Postgres/PostgREST text, verbatim
 *
 * `detail` exists because the first version of this returned only the friendly
 * message and logged the rest to the server. A missing migration then looked
 * exactly like a bug, and diagnosing it took several screenshots and a guess.
 * The UI shows `detail` to admins and editors only — members still see the
 * friendly line alone.
 */
export function rpcErrorResponse(message: string | undefined): NextResponse {
  const raw = (message || '').trim()
  const code = raw.split(':')[0]
  const known = CLIENT_ERROR_CODES.has(code) || code === 'COURSE_OVERLAP'

  if (!known) {
    console.error('Weekend RPC error:', raw)
    return NextResponse.json(
      {
        error: 'Something went wrong. Please try again.',
        // No `code`: this is not one of ours, so nothing should branch on it.
        detail: raw || 'The database returned an error with no message.',
      },
      { status: 500 }
    )
  }

  const status = code === 'NOT_AUTHENTICATED' ? 401
    : code === 'NOT_AN_ADMIN' || code === 'NOT_YOUR_BOOKING' ? 403
    : code === 'EVENT_NOT_FOUND' || code === 'COURSE_NOT_FOUND' || code === 'COURSE_BOOKING_NOT_FOUND' ? 404
    : 422

  return NextResponse.json({ error: weekendErrorMessage(raw), code, detail: raw }, { status })
}

export interface PromotionRow {
  user_id: string
  course_id: string
  course_title: string
}

/**
 * Tell anyone moved off a course waitlist that they now hold a place.
 *
 * Promotion happens inside the database transaction that frees the place, so
 * by the time this runs the member already has it — the email is telling them
 * about something that has happened, not asking them to claim it.
 *
 * Lives here rather than in a route file because both the booking route (days
 * dropped) and the courses route (a place released) trigger promotions, and a
 * Next route module should only export its handlers.
 */
export async function notifyPromotions(
  admin: SupabaseClient,
  promotions: PromotionRow[] | undefined,
  event: { title: string; slug: string }
) {
  for (const promo of promotions || []) {
    const { data: p } = await admin
      .from('profiles')
      .select('full_name, email')
      .eq('id', promo.user_id)
      .single()
    if (!p?.email) continue

    const { data: course } = await admin
      .from('weekend_courses')
      .select('starts_at, ends_at')
      .eq('id', promo.course_id)
      .single()

    const time = course
      ? `${new Date(course.starts_at).toLocaleString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long',
          hour: '2-digit', minute: '2-digit',
        })} – ${new Date(course.ends_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
      : ''

    const mail = weekendWaitlistPromotedEmail({
      name: p.full_name || 'Member',
      eventTitle: event.title,
      courseTitle: promo.course_title,
      courseTime: time,
      eventSlug: event.slug,
      siteUrl: SITE_URL,
    })
    await resend.emails.send({ from: FROM_EMAIL, to: p.email, subject: mail.subject, html: mail.html })
  }
}
