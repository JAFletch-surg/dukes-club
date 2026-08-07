import { NextRequest, NextResponse } from 'next/server'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { weekendRoomInvalidatedEmail } from '@/lib/emails/templates'
import {
  authenticate, rpcErrorResponse, serviceClient, userClient, notifyPromotions,
  SITE_URL, type PromotionRow,
} from '../_shared'

/**
 * Take a place on a Friday or Sunday course.
 *
 * Capacity, the one-course-per-overlapping-slot rule and the waitlist all
 * live in book_weekend_course(), which locks the course row before it counts.
 * Two members racing for the last place cannot both win, however the request
 * arrives.
 */
export async function POST(request: NextRequest) {
  const result = await authenticate(request)
  if ('error' in result) return result.error
  const { auth } = result

  let body: { courseId?: string; joinWaitlist?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.courseId) {
    return NextResponse.json({ error: 'Missing courseId' }, { status: 400 })
  }

  const { data, error } = await userClient(auth.token).rpc('book_weekend_course', {
    p_course_id: body.courseId,
    // Default false: joining a waitlist is a different decision from booking a
    // place, so the member has to ask for it rather than land on one by
    // surprise when a course turns out to be full.
    p_allow_waitlist: body.joinWaitlist === true,
  })

  if (error) return rpcErrorResponse(error.message)

  return NextResponse.json(data)
}

/**
 * Give up a course place. This is also how switching works — drop one, book
 * another — and both halves stay open until the event's booking-close date.
 *
 * Two consequences are settled inside the transaction rather than left to
 * tidy up afterwards: the freed place goes to whoever is next on the waitlist,
 * and dropping a member's last Friday course invalidates their Friday room
 * request, since the thing that made them eligible is gone.
 */
export async function DELETE(request: NextRequest) {
  const result = await authenticate(request)
  if ('error' in result) return result.error
  const { auth } = result

  const courseBookingId = request.nextUrl.searchParams.get('courseBookingId')
  if (!courseBookingId) {
    return NextResponse.json({ error: 'Missing courseBookingId' }, { status: 400 })
  }

  const { data, error } = await userClient(auth.token).rpc('cancel_weekend_course_booking', {
    p_course_booking_id: courseBookingId,
  })

  if (error) return rpcErrorResponse(error.message)

  if (!data?.cancelled) {
    return NextResponse.json(data ?? { cancelled: false })
  }

  try {
    await notifyCancellation(data)
  } catch (err) {
    console.error('Weekend cancellation notifications failed:', err)
  }

  return NextResponse.json(data)
}

async function notifyCancellation(data: {
  course_id: string
  user_id: string
  promoted?: PromotionRow | null
  friday_room_cleared?: boolean
}) {
  const admin = serviceClient()

  const { data: course } = await admin
    .from('weekend_courses')
    .select('event_id, events(title, slug)')
    .eq('id', data.course_id)
    .single()

  const raw = course?.events as { title: string; slug: string } | { title: string; slug: string }[] | undefined
  const event = Array.isArray(raw) ? raw[0] : raw
  if (!event) return

  if (data.promoted) {
    await notifyPromotions(admin, [data.promoted], event)
  }

  if (data.friday_room_cleared) {
    // An admin can cancel on a member's behalf, so this goes to the member
    // whose room it was — data.user_id, the owner of the cancelled row — not
    // to whoever clicked the button.
    const { data: p } = await admin
      .from('profiles')
      .select('full_name, email')
      .eq('id', data.user_id)
      .single()

    if (p?.email) {
      const mail = weekendRoomInvalidatedEmail({
        name: p.full_name || 'Member',
        eventTitle: event.title,
        night: 'Friday',
        reason: 'you are no longer booked onto a Friday course.',
        eventSlug: event.slug,
        siteUrl: SITE_URL,
      })
      await resend.emails.send({ from: FROM_EMAIL, to: p.email, subject: mail.subject, html: mail.html })
    }
  }
}
