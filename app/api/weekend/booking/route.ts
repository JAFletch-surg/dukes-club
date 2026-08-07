import { NextRequest, NextResponse } from 'next/server'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { weekendBookingEmail, weekendRoomInvalidatedEmail } from '@/lib/emails/templates'
import { getPaymentProvider, getPaymentProviderName } from '@/lib/payments'
import {
  authenticate, rpcErrorResponse, serviceClient, userClient, notifyPromotions,
  SITE_URL, type PromotionRow,
} from '../_shared'

/**
 * Create or update a member's Dukes Weekend booking: which days, how they are
 * joining Saturday, and whether they need a room.
 *
 * The rules are not enforced here — save_weekend_booking() owns them, under a
 * row lock, and is called with the member's own JWT so it decides for itself
 * who is booking. This route's job is the work the database should not do:
 * ensuring the single deposit record exists, and telling people what changed.
 */
export async function POST(request: NextRequest) {
  const result = await authenticate(request)
  if ('error' in result) return result.error
  const { auth } = result

  let body: {
    eventId?: string
    friday?: boolean
    saturday?: boolean
    sunday?: boolean
    saturdayMode?: 'in_person' | 'stream' | null
    roomFriday?: boolean
    roomSaturday?: boolean
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.eventId) {
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
  }

  const supabase = userClient(auth.token)
  const admin = serviceClient()

  const { data: saved, error } = await supabase.rpc('save_weekend_booking', {
    p_event_id: body.eventId,
    p_friday: !!body.friday,
    p_saturday: !!body.saturday,
    p_sunday: !!body.sunday,
    p_saturday_mode: body.saturdayMode ?? null,
    p_room_friday: !!body.roomFriday,
    p_room_saturday: !!body.roomSaturday,
  })

  if (error) return rpcErrorResponse(error.message)

  const bookingId = saved.booking_id as string
  const depositPence = (saved.deposit_pence as number) || 0

  // ── The single deposit for the weekend ──
  //
  // One per member per booking regardless of how many days or courses they
  // hold, so this is an insert that does nothing if one already exists —
  // adding a course must never create a second charge. The UNIQUE constraint
  // on booking_id is the real guarantee; this just avoids the error.
  let depositStatus: string | null = null
  if (depositPence > 0) {
    const { data: existing } = await admin
      .from('event_payments')
      .select('id, status')
      .eq('booking_id', bookingId)
      .maybeSingle()

    if (existing) {
      depositStatus = existing.status
    } else {
      const provider = getPaymentProvider()
      const taken = await provider.takeDeposit({
        bookingId,
        eventId: body.eventId,
        userId: auth.userId,
        amountPence: depositPence,
        description: 'Dukes Weekend refundable deposit',
      })

      const { data: payment } = await admin
        .from('event_payments')
        .insert({
          event_id: body.eventId,
          user_id: auth.userId,
          booking_id: bookingId,
          amount_pence: depositPence,
          status: taken.status,
          provider: getPaymentProviderName(),
          provider_intent_id: taken.providerIntentId ?? null,
          provider_charge_id: taken.providerChargeId ?? null,
        })
        .select('id, status')
        .single()

      if (payment) {
        depositStatus = payment.status
        // Opening entry in the audit trail, so a deposit's history is complete
        // from creation rather than starting at the first admin action.
        await admin.from('event_payment_events').insert({
          payment_id: payment.id,
          from_status: null,
          to_status: payment.status,
          actor_id: auth.userId,
          note: `Deposit created via ${getPaymentProviderName()} provider`,
        })
      }
    }
  }

  // ── Notify ──
  // Best-effort: a booking that saved must not be reported as failed because
  // an email bounced.
  try {
    await sendNotifications({
      admin,
      eventId: body.eventId,
      userId: auth.userId,
      email: auth.email,
      bookingId,
      saved,
      body,
      depositPence,
    })
  } catch (err) {
    console.error('Weekend booking notifications failed:', err)
  }

  return NextResponse.json({
    booking_id: bookingId,
    status: saved.status,
    deposit_pence: depositPence,
    deposit_status: depositStatus,
    courses_cancelled: saved.courses_cancelled,
    friday_room_cleared: saved.friday_room_cleared,
  })
}

async function sendNotifications(args: {
  admin: ReturnType<typeof serviceClient>
  eventId: string
  userId: string
  email: string
  bookingId: string
  saved: Record<string, unknown>
  body: { friday?: boolean; saturday?: boolean; sunday?: boolean; saturdayMode?: string | null }
  depositPence: number
}) {
  const { admin, eventId, userId, email, bookingId, saved, body, depositPence } = args

  const { data: event } = await admin
    .from('events')
    .select('title, slug, starts_at, ends_at, location')
    .eq('id', eventId)
    .single()
  if (!event) return

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single()

  const { data: booking } = await admin
    .from('event_bookings')
    .select('room_friday_requested, room_saturday_requested')
    .eq('id', bookingId)
    .single()

  const { data: courseRows } = await admin
    .from('weekend_course_bookings')
    .select('status, weekend_courses(title)')
    .eq('booking_id', bookingId)
    .eq('status', 'booked')

  const courses = (courseRows || [])
    .map((r: { weekend_courses?: { title?: string } | { title?: string }[] }) => {
      const c = Array.isArray(r.weekend_courses) ? r.weekend_courses[0] : r.weekend_courses
      return c?.title
    })
    .filter((t): t is string => !!t)

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const eventDates = event.ends_at && fmt(event.ends_at) !== fmt(event.starts_at)
    ? `${fmt(event.starts_at)} – ${fmt(event.ends_at)}`
    : fmt(event.starts_at)

  const name = profile?.full_name || email.split('@')[0] || 'Member'

  if (email) {
    const mail = weekendBookingEmail({
      name,
      eventTitle: event.title,
      eventDates,
      eventLocation: event.location || 'TBC',
      days: { friday: !!body.friday, saturday: !!body.saturday, sunday: !!body.sunday },
      saturdayMode: (body.saturdayMode as 'in_person' | 'stream' | null) ?? null,
      courses,
      roomFriday: !!booking?.room_friday_requested,
      roomSaturday: !!booking?.room_saturday_requested,
      depositPence,
      eventSlug: event.slug,
      siteUrl: SITE_URL,
    })
    await resend.emails.send({ from: FROM_EMAIL, to: email, subject: mail.subject, html: mail.html })
  }

  // A room request that fell away with the day it depended on. Left unsaid,
  // the member would arrive expecting a bed.
  if (saved.friday_room_cleared && email) {
    const mail = weekendRoomInvalidatedEmail({
      name,
      eventTitle: event.title,
      night: 'Friday',
      reason: 'you are no longer booked onto a Friday course.',
      eventSlug: event.slug,
      siteUrl: SITE_URL,
    })
    await resend.emails.send({ from: FROM_EMAIL, to: email, subject: mail.subject, html: mail.html })
  }

  // Dropping a day frees course places, which may have promoted other members.
  await notifyPromotions(admin, saved.promotions as PromotionRow[] | undefined, event)
}
