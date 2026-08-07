import { createClient } from '@/lib/supabase/client'

// Event types that stream online (Zoom / Vimeo Live), as opposed to in-person events.
export const STREAMING_EVENT_TYPES = ['Webinar', 'Online Lecture', 'Hybrid'] as const

export function isStreamingEvent(eventType: string | null | undefined): boolean {
  return !!eventType && (STREAMING_EVENT_TYPES as readonly string[]).includes(eventType)
}

// A Dukes Weekend is a three-day members-only event: Friday courses, the
// Saturday main programme, and Sunday courses including a revision course.
// Like every other event type on the site it is a value in events.event_type,
// with its own nullable columns rather than its own table.
export const DUKES_WEEKEND_TYPE = 'Dukes Weekend'

export function isWeekendEvent(eventType: string | null | undefined): boolean {
  return eventType === DUKES_WEEKEND_TYPE
}

export type WeekendDay = 'friday' | 'sunday'

export interface WeekendCourse {
  id: string
  event_id: string
  day: WeekendDay
  title: string
  description_html: string | null
  description_plain: string | null
  starts_at: string
  ends_at: string
  capacity: number
  is_revision_course: boolean
  learning_objectives: string[]
  timetable_data: { time: string; title: string; description?: string; faculty_id?: string }[]
  waitlist_enabled: boolean
  sort_order: number
}

/**
 * Two courses clash when start_a < end_b AND start_b < end_a.
 *
 * A member may hold only one course booking per overlapping slot. This is the
 * client-side half of that rule, used to grey out unselectable courses — the
 * authoritative check is book_weekend_course() in the database, which runs
 * the same comparison under a row lock.
 */
export function coursesOverlap(
  a: { starts_at: string; ends_at: string },
  b: { starts_at: string; ends_at: string }
): boolean {
  return new Date(a.starts_at) < new Date(b.ends_at)
    && new Date(b.starts_at) < new Date(a.ends_at)
}

/**
 * Which day combinations may be booked. Sunday needs Saturday; Friday stands
 * alone. Mirrors save_weekend_booking(), which rejects the rest server-side.
 */
export function isValidDayCombination(days: {
  friday: boolean
  saturday: boolean
  sunday: boolean
}): boolean {
  if (days.sunday && !days.saturday) return false
  return days.friday || days.saturday
}

// Machine-readable codes raised by the weekend booking functions, mapped to
// wording a member should see. The API routes fall back to a generic message
// for anything not listed, so an unmapped code is never leaked raw.
export const WEEKEND_ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: 'Please log in to book.',
  NOT_A_MEMBER: 'The Dukes Weekend is open to full members only.',
  NOT_A_WEEKEND_EVENT: 'This event is not a Dukes Weekend.',
  EVENT_NOT_FOUND: 'That event could not be found.',
  EVENT_NOT_PUBLISHED: 'This event is not open for booking.',
  BOOKING_CLOSED: 'Bookings and changes have closed for this event.',
  NO_DAYS_SELECTED: 'Choose at least Friday or Saturday.',
  SUNDAY_REQUIRES_SATURDAY: 'Sunday can only be booked alongside Saturday.',
  INVALID_SATURDAY_MODE: 'Choose whether you are attending Saturday in person or online.',
  STREAMING_NOT_AVAILABLE: 'This weekend is not being streamed.',
  NO_WEEKEND_BOOKING: 'Book your weekend days before choosing courses.',
  NOT_ATTENDING_FRIDAY: 'Add Friday to your booking before choosing a Friday course.',
  NOT_ATTENDING_SUNDAY: 'Add Sunday to your booking before choosing a Sunday course.',
  ALREADY_BOOKED: 'You already have a place on this course.',
  COURSE_NOT_FOUND: 'That course could not be found.',
  COURSE_FULL: 'This course is full.',
  COURSE_BOOKING_NOT_FOUND: 'That course booking could not be found.',
  NOT_YOUR_BOOKING: 'That booking belongs to someone else.',
  FRIDAY_ROOM_REQUIRES_FRIDAY_COURSE: 'A Friday night room is only available if you are booked onto a Friday course.',
  FRIDAY_ROOMS_FULL: 'All Friday night rooms have been allocated.',
  SATURDAY_ROOMS_FULL: 'All Saturday night rooms have been allocated.',
  NOT_AN_ADMIN: 'You do not have permission to do that.',
  INVALID_PAYMENT_STATUS: 'That is not a valid deposit status.',
}

/**
 * Turn a Postgres error from the weekend functions into something a member
 * can read. COURSE_OVERLAP carries the clashing course title after a colon.
 */
export function weekendErrorMessage(raw: string | null | undefined): string {
  if (!raw) return 'Something went wrong. Please try again.'
  if (raw.startsWith('COURSE_OVERLAP')) {
    const clash = raw.split(':')[1]
    return clash
      ? `That course clashes with ${clash}, which you are already booked onto.`
      : 'That course clashes with one you are already booked onto.'
  }
  return WEEKEND_ERROR_MESSAGES[raw] ?? 'Something went wrong. Please try again.'
}

interface RegisterForEventParams {
  eventId: string
  userId: string
  status: string
  applicantName: string
  applicantEmail: string
  applicantTrainingLevel: string
  applicantHospital: string
  applicantDeanery: string
  motivation?: string
  answers?: Record<string, string>
}

// Registers a user for an event, reusing their existing event_bookings row
// (e.g. after they previously cancelled) instead of inserting a second row
// for the same (event_id, user_id) pair, which would hit the unique
// constraint that backs the "already applied" duplicate check.
export async function registerForEvent(
  supabase: ReturnType<typeof createClient>,
  params: RegisterForEventParams
): Promise<{ booking: { id: string; status: string } | null; error: any }> {
  const { eventId, userId, status, applicantName, applicantEmail, applicantTrainingLevel, applicantHospital, applicantDeanery, motivation, answers } = params

  const { data: existing } = await supabase
    .from('event_bookings')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()

  const fields = {
    applicant_name: applicantName,
    applicant_email: applicantEmail,
    applicant_training_level: applicantTrainingLevel,
    applicant_hospital: applicantHospital,
    applicant_deanery: applicantDeanery,
    motivation: motivation ?? null,
    answers: answers ?? null,
    status,
    cancelled_at: null,
    reviewed_at: null,
  }

  if (existing) {
    const { data, error } = await supabase
      .from('event_bookings')
      .update(fields)
      .eq('id', existing.id)
      .select('id, status')
      .single()
    return { booking: data, error }
  }

  const { data, error } = await supabase
    .from('event_bookings')
    .insert({ event_id: eventId, user_id: userId, ...fields })
    .select('id, status')
    .single()
  return { booking: data, error }
}
