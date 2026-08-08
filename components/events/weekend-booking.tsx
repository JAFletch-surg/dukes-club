'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Loader2, Check, Lock, Clock, Users, Info, BedDouble, Radio,
  ChevronDown, ChevronUp, Star, User as UserIcon, X, MessageSquare,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { canBookEvent } from '@/lib/membership-gates'
import { coursesOverlap, type WeekendCourse } from '@/lib/events'
import { richTextToHtml } from '@/lib/rich-text'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/auth-provider'

// The booking rules mirrored here are for the UI only — greying out a clashing
// course and disabling an ineligible room option. Every one of them is enforced
// again server-side in save_weekend_booking() and book_weekend_course(), which
// are the authority. If the two ever disagree, the server wins and the member
// sees its message.

interface Props {
  event: {
    id: string
    slug: string
    title: string
    weekend_deposit_pence: number | null
    weekend_stream_enabled: boolean | null
    weekend_stream_url: string | null
    application_deadline: string | null
  }
  user: { id: string; email?: string } | null
  profile: Profile | null
}

interface CourseBooking {
  id: string
  course_id: string
  status: 'booked' | 'waitlisted' | 'cancelled'
  waitlist_position: number | null
}

interface Availability {
  course_id: string
  capacity: number
  booked: number
  waitlisted: number
  places_left: number
}

interface RoomAvailability {
  friday_capacity: number | null
  friday_used: number
  saturday_capacity: number | null
  saturday_used: number
}

interface Booking {
  id: string
  status: string
  attends_friday: boolean
  attends_saturday: boolean
  attends_sunday: boolean
  saturday_mode: 'in_person' | 'stream' | null
  room_friday_requested: boolean
  room_saturday_requested: boolean
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

const formatDeposit = (pence: number | null) =>
  !pence ? 'No deposit' : `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`

export function WeekendBooking({ event, user, profile }: Props) {
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [courses, setCourses] = useState<WeekendCourse[]>([])
  const [facultyByCourse, setFacultyByCourse] = useState<Record<string, { name: string; photo_url: string }[]>>({})
  const [availability, setAvailability] = useState<Record<string, Availability>>({})
  // True when the availability lookup failed, so places-left is unknown rather
  // than "nobody has booked".
  const [availabilityBroken, setAvailabilityBroken] = useState(false)
  const [rooms, setRooms] = useState<RoomAvailability | null>(null)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [myCourses, setMyCourses] = useState<CourseBooking[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  // Draft day selection, kept separate from the saved booking so the member
  // can change their mind before committing.
  const [days, setDays] = useState({ friday: false, saturday: false, sunday: false })
  const [saturdayMode, setSaturdayMode] = useState<'in_person' | 'stream'>('in_person')
  const [roomFriday, setRoomFriday] = useState(false)
  const [roomSaturday, setRoomSaturday] = useState(false)

  const [saving, setSaving] = useState(false)
  const [busyCourse, setBusyCourse] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The underlying database error, shown to admins and editors only. Members
  // get the friendly line by itself; without this a setup problem and a real
  // bug look identical from the page.
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const bookingsClosed = !!event.application_deadline && new Date(event.application_deadline) < new Date()
  const eligible = !!user && canBookEvent(profile, 'Dukes Weekend')
  const canSeeDetail = !!profile && ['admin', 'super_admin', 'editor'].includes(profile.role)

  // Clearing both together keeps a stale detail from outliving its message.
  const fail = useCallback((message: string, detail?: string | null) => {
    setError(message)
    setErrorDetail(detail ?? null)
  }, [])

  const clearMessages = useCallback(() => {
    setError(null)
    setErrorDetail(null)
    setNotice(null)
  }, [])

  // The courses section, so a successful day save can bring it into view.
  const coursesRef = useRef<HTMLDivElement | null>(null)

  // ── Load ─────────────────────────────────────────────────────────

  const loadShared = useCallback(async () => {
    const [{ data: courseRows }, { data: avail, error: availErr }, { data: roomRows }] = await Promise.all([
      supabase.from('weekend_courses').select('*').eq('event_id', event.id).order('sort_order'),
      supabase.rpc('weekend_course_availability', { p_event_id: event.id }),
      supabase.rpc('weekend_room_availability', { p_event_id: event.id }),
    ])

    const list = (courseRows || []) as WeekendCourse[]
    setCourses(list)

    // If this lookup fails the places-left numbers are unknown, not zero-booked.
    // Saying nothing would make a broken function look like an empty course —
    // which is exactly what happened, and is why it took three screenshots to
    // spot that the functions migration had not been applied.
    if (availErr) {
      setAvailabilityBroken(true)
      if (canSeeDetail) fail('Course availability could not be loaded.', availErr.message)
    } else {
      setAvailabilityBroken(false)
    }

    const map: Record<string, Availability> = {}
    for (const a of (avail || []) as Availability[]) map[a.course_id] = a
    setAvailability(map)

    setRooms(((roomRows || [])[0] as RoomAvailability) || null)

    // Course faculty, two-step to avoid FK join issues — the same approach the
    // event page takes for event_faculty.
    if (list.length > 0) {
      const { data: links } = await supabase
        .from('weekend_course_faculty')
        .select('course_id, faculty_id')
        .in('course_id', list.map(c => c.id))

      if (links && links.length > 0) {
        const { data: people } = await supabase
          .from('faculty')
          .select('id, full_name, photo_url')
          .in('id', links.map((l: { faculty_id: string }) => l.faculty_id))

        const byCourse: Record<string, { name: string; photo_url: string }[]> = {}
        for (const link of links as { course_id: string; faculty_id: string }[]) {
          const person = (people || []).find((p: { id: string }) => p.id === link.faculty_id)
          if (!person) continue
          byCourse[link.course_id] = byCourse[link.course_id] || []
          byCourse[link.course_id].push({ name: person.full_name, photo_url: person.photo_url })
        }
        setFacultyByCourse(byCourse)
      }
    }
  }, [supabase, event.id, canSeeDetail, fail])

  const loadMine = useCallback(async () => {
    if (!user) return
    const [{ data: bookingRow }, { data: courseRows }] = await Promise.all([
      supabase.from('event_bookings').select('*').eq('event_id', event.id).eq('user_id', user.id).maybeSingle(),
      supabase.from('weekend_course_bookings')
        .select('id, course_id, status, waitlist_position')
        .eq('event_id', event.id).eq('user_id', user.id).neq('status', 'cancelled'),
    ])

    setMyCourses((courseRows || []) as CourseBooking[])

    if (bookingRow && bookingRow.status !== 'cancelled') {
      const b = bookingRow as Booking
      setBooking(b)
      setDays({ friday: b.attends_friday, saturday: b.attends_saturday, sunday: b.attends_sunday })
      setSaturdayMode(b.saturday_mode ?? 'in_person')
      setRoomFriday(b.room_friday_requested)
      setRoomSaturday(b.room_saturday_requested)
    } else {
      setBooking(null)
    }
  }, [supabase, event.id, user])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        await Promise.all([loadShared(), loadMine()])
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [loadShared, loadMine])

  // ── Derived state ────────────────────────────────────────────────

  const bookedCourseIds = useMemo(
    () => new Set(myCourses.filter(c => c.status === 'booked').map(c => c.course_id)),
    [myCourses]
  )
  const bookedCourses = useMemo(
    () => courses.filter(c => bookedCourseIds.has(c.id)),
    [courses, bookedCourseIds]
  )
  const myCourseFor = useCallback(
    (courseId: string) => myCourses.find(c => c.course_id === courseId) || null,
    [myCourses]
  )

  const hasBookedFridayCourse = bookedCourses.some(c => c.day === 'friday')

  // "Full" only blocks members who do not already hold a room — someone with a
  // request in hand must still be able to save other changes to their booking.
  const fridayRoomsFull = rooms?.friday_capacity != null
    && rooms.friday_used >= rooms.friday_capacity && !booking?.room_friday_requested
  const saturdayRoomsFull = rooms?.saturday_capacity != null
    && rooms.saturday_used >= rooms.saturday_capacity && !booking?.room_saturday_requested

  // Why the Friday room option is unavailable, in the member's terms. Null
  // means it is available.
  const fridayRoomBlocked = !days.friday
    ? 'Add Friday to your booking first'
    : !hasBookedFridayCourse
      ? 'Only available if you are booked onto a Friday course'
      : fridayRoomsFull
        ? 'All Friday night rooms have been allocated'
        : null

  const saturdayRoomBlocked = !days.saturday
    ? 'Add Saturday to your booking first'
    : saturdayMode === 'stream'
      ? 'Rooms are for members attending in person'
      : saturdayRoomsFull
        ? 'All Saturday night rooms have been allocated'
        : null

  const daysDirty = !!booking && (
    booking.attends_friday !== days.friday ||
    booking.attends_saturday !== days.saturday ||
    booking.attends_sunday !== days.sunday ||
    (booking.saturday_mode ?? 'in_person') !== saturdayMode ||
    booking.room_friday_requested !== (roomFriday && !fridayRoomBlocked) ||
    booking.room_saturday_requested !== (roomSaturday && !saturdayRoomBlocked)
  )

  // ── Actions ──────────────────────────────────────────────────────

  const authHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    }
  }, [supabase])

  const saveBooking = async ({ thenShowCourses = false } = {}) => {
    setSaving(true); clearMessages()
    try {
      const res = await fetch('/api/weekend/booking', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          eventId: event.id,
          friday: days.friday,
          saturday: days.saturday,
          sunday: days.sunday,
          saturdayMode: days.saturday ? saturdayMode : null,
          roomFriday: roomFriday && !fridayRoomBlocked,
          roomSaturday: roomSaturday && !saturdayRoomBlocked,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        fail(json.error || 'Could not save your booking', json.detail)
      } else {
        setNotice(
          json.courses_cancelled > 0
            ? `Booking updated. ${json.courses_cancelled} course place${json.courses_cancelled === 1 ? '' : 's'} released for the days you removed.`
            : 'Your booking has been saved.'
        )
        await Promise.all([loadMine(), loadShared()])

        // After the first save the course lists have just become usable, so
        // put them in front of the member rather than leaving them to scroll
        // back up and find out.
        if (thenShowCourses) {
          requestAnimationFrame(() => {
            coursesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          })
        }
      }
    } catch {
      fail('Could not reach the server. Please try again.')
    }
    setSaving(false)
  }

  const bookCourse = async (courseId: string, joinWaitlist: boolean) => {
    setBusyCourse(courseId); clearMessages()
    try {
      const res = await fetch('/api/weekend/courses', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ courseId, joinWaitlist }),
      })
      const json = await res.json()
      if (!res.ok) {
        fail(json.error || 'Could not book that course', json.detail)
      } else {
        setNotice(
          json.status === 'waitlisted'
            ? `You are number ${json.waitlist_position} on the waitlist. We will email you if a place frees up.`
            : 'Course booked.'
        )
        await Promise.all([loadMine(), loadShared()])
      }
    } catch {
      fail('Could not reach the server. Please try again.')
    }
    setBusyCourse(null)
  }

  const releaseCourse = async (courseBookingId: string, courseId: string) => {
    setBusyCourse(courseId); clearMessages()
    try {
      const res = await fetch(`/api/weekend/courses?courseBookingId=${courseBookingId}`, {
        method: 'DELETE',
        headers: await authHeaders(),
      })
      const json = await res.json()
      if (!res.ok) {
        fail(json.error || 'Could not release that place', json.detail)
      } else {
        setNotice(
          json.friday_room_cleared
            ? 'Place released. Your Friday night room request has been cancelled, as it depended on that course.'
            : 'Place released.'
        )
        await Promise.all([loadMine(), loadShared()])
      }
    } catch {
      fail('Could not reach the server. Please try again.')
    }
    setBusyCourse(null)
  }

  // ── Gated states ─────────────────────────────────────────────────
  // The event page itself stays public — only the booking controls are
  // members-only, which is how every other event type on the site behaves.

  if (!user) {
    return (
      <Section title="Book Your Weekend">
        <div className="rounded-lg border-2 border-navy-foreground/20 bg-navy-foreground/5 p-6 text-center">
          <Lock size={20} className="text-gold mx-auto mb-3" />
          <p className="text-sm text-navy-foreground/80 mb-4">
            The Dukes Weekend is open to Dukes&apos; Club members only.
          </p>
          <Link href="/login" className="inline-block px-6 py-3 rounded-lg bg-gold text-gold-foreground text-sm font-bold hover:bg-gold/90 transition-colors">
            Log in to Book
          </Link>
          <p className="text-xs text-navy-foreground/50 mt-3">
            Not a member yet? <Link href="/register" className="text-gold underline">Join the Dukes&apos; Club</Link>
          </p>
        </div>
      </Section>
    )
  }

  if (!eligible) {
    return (
      <Section title="Book Your Weekend">
        <div className="rounded-lg border-2 border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <Lock size={20} className="text-amber-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-amber-400 mb-2">Full Members Only</p>
          <p className="text-xs text-navy-foreground/60 leading-relaxed mb-4">
            The Dukes Weekend is available to verified ACPGBI members. Submit your membership
            number to upgrade your account.
          </p>
          <Link href="/members/profile" className="inline-block px-5 py-2.5 rounded-lg bg-gold text-gold-foreground text-sm font-bold hover:bg-gold/90 transition-colors">
            Add Membership Number
          </Link>
        </div>
      </Section>
    )
  }

  if (loading) {
    return (
      <Section title="Book Your Weekend">
        <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-gold" /></div>
      </Section>
    )
  }

  const fridayCourses = courses.filter(c => c.day === 'friday')
  const sundayCourses = courses.filter(c => c.day === 'sunday')
  const deposit = event.weekend_deposit_pence || 0

  return (
    <Section title="Book Your Weekend">
      {bookingsClosed && (
        <div className="mb-5 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-red-400">Bookings have closed for this event.</p>
        </div>
      )}

      {error && (
        <div className="mb-5 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 flex items-start gap-2">
          <X size={15} className="text-red-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-red-300">{error}</p>
            {/* Admins and editors also get the database's own words, so a
                missing migration is distinguishable from a real bug without
                digging through server logs. */}
            {canSeeDetail && errorDetail && (
              <p className="mt-1.5 text-[11px] font-mono text-red-300/60 break-words">
                {errorDetail}
              </p>
            )}
          </div>
        </div>
      )}
      {notice && (
        <div className="mb-5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 flex items-start gap-2">
          <Check size={15} className="text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-sm text-emerald-300">{notice}</p>
        </div>
      )}

      {/* ── 1. Days ── */}
      <h3 className="text-sm font-semibold text-navy-foreground uppercase tracking-wider mb-3">
        1. Which days are you coming?
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <DayCard
          label="Friday"
          sublabel={`${fridayCourses.length} course${fridayCourses.length === 1 ? '' : 's'}`}
          selected={days.friday}
          disabled={bookingsClosed}
          onClick={() => setDays(d => ({ ...d, friday: !d.friday }))}
        />
        <DayCard
          label="Saturday"
          sublabel="Main programme"
          selected={days.saturday}
          disabled={bookingsClosed}
          onClick={() => setDays(d => {
            const saturday = !d.saturday
            // Sunday cannot stand alone, so dropping Saturday drops it too
            // rather than leaving an invalid selection for the server to reject.
            return { ...d, saturday, sunday: saturday ? d.sunday : false }
          })}
        />
        <DayCard
          label="Sunday"
          sublabel={`${sundayCourses.length} course${sundayCourses.length === 1 ? '' : 's'}`}
          selected={days.sunday}
          disabled={bookingsClosed || !days.saturday}
          disabledReason="Sunday can only be booked alongside Saturday"
          onClick={() => setDays(d => ({ ...d, sunday: !d.sunday }))}
        />
      </div>

      {/* Saturday attendance mode — only when this weekend is streamed. */}
      {days.saturday && event.weekend_stream_enabled && (
        <div className="mb-6 rounded-lg border border-navy-foreground/15 bg-navy-foreground/5 p-4">
          <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Radio size={13} className="text-gold" /> How are you joining Saturday?
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {(['in_person', 'stream'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                disabled={bookingsClosed}
                onClick={() => {
                  setSaturdayMode(mode)
                  if (mode === 'stream') setRoomSaturday(false)
                }}
                className={cn(
                  'flex-1 text-left px-4 py-3 rounded-lg border-2 transition-colors disabled:opacity-50',
                  saturdayMode === mode
                    ? 'border-gold bg-gold/10'
                    : 'border-navy-foreground/20 hover:border-navy-foreground/40'
                )}
              >
                <span className="block text-sm font-semibold text-navy-foreground">
                  {mode === 'in_person' ? 'In person' : 'Watch the stream'}
                </span>
                <span className="block text-xs text-navy-foreground/60 mt-0.5">
                  {mode === 'in_person'
                    ? 'At the venue for the day'
                    : 'Free — no accommodation or catering'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Courses need a saved booking behind them (the server rejects a course
          without one), so when there is none the action to create it belongs
          right here — not at the bottom of the page past the very lists it
          unlocks. Nothing is written until this is pressed, so a mistaken day
          tap does not create a booking, a deposit and a confirmation email. */}
      {!booking && (days.friday || days.saturday) && (
        <button
          onClick={() => saveBooking({ thenShowCourses: true })}
          disabled={saving || bookingsClosed}
          className="w-full mt-2 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-gold text-gold-foreground text-sm font-bold hover:bg-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          {days.friday || days.sunday ? 'Save Days & Choose Courses' : 'Save My Days'}
        </button>
      )}

      {/* ── 2. Courses ── */}
      {(days.friday || days.sunday) && (
        <div ref={coursesRef}>
          <h3 className="text-sm font-semibold text-navy-foreground uppercase tracking-wider mb-1 mt-8">
            2. Choose your courses
          </h3>
          <p className="text-xs text-navy-foreground/50 mb-4">
            One course per time slot. Courses that clash with something you already hold are shown greyed out.
          </p>

          {!booking && (
            <div className="mb-4 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 flex items-start gap-2">
              <Info size={15} className="text-gold mt-0.5 shrink-0" />
              <p className="text-sm text-navy-foreground/80">
                Save your days first — the button just above — and these unlock.
              </p>
            </div>
          )}

          {days.friday && (
            <CourseList
              heading="Friday"
              courses={fridayCourses}
              {...{ availability, availabilityBroken, facultyByCourse, bookedCourses, myCourseFor, expanded, setExpanded, busyCourse, bookCourse, releaseCourse }}
              disabled={!booking || bookingsClosed}
            />
          )}
          {days.sunday && (
            <CourseList
              heading="Sunday"
              courses={sundayCourses}
              {...{ availability, availabilityBroken, facultyByCourse, bookedCourses, myCourseFor, expanded, setExpanded, busyCourse, bookCourse, releaseCourse }}
              disabled={!booking || bookingsClosed}
            />
          )}
        </div>
      )}

      {/* ── 3. Accommodation ── */}
      <h3 className="text-sm font-semibold text-navy-foreground uppercase tracking-wider mb-1 mt-8">
        3. Do you need a room?
      </h3>
      <p className="text-xs text-navy-foreground/50 mb-4">
        Rooms are allocated by the Dukes&apos; Club — you are telling us you need one, not choosing it.
      </p>
      <div className="space-y-2.5 mb-6">
        <RoomOption
          label="Friday night"
          checked={roomFriday && !fridayRoomBlocked}
          blockedReason={fridayRoomBlocked}
          disabled={bookingsClosed}
          remaining={rooms?.friday_capacity != null ? rooms.friday_capacity - rooms.friday_used : null}
          onChange={setRoomFriday}
        />
        <RoomOption
          label="Saturday night"
          checked={roomSaturday && !saturdayRoomBlocked}
          blockedReason={saturdayRoomBlocked}
          disabled={bookingsClosed}
          remaining={rooms?.saturday_capacity != null ? rooms.saturday_capacity - rooms.saturday_used : null}
          onChange={setRoomSaturday}
        />
      </div>

      {/* ── 4. Deposit and save ── */}
      {deposit > 0 && (
        <div className="rounded-lg border border-gold/30 bg-gold/5 p-4 mb-5">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-sm font-semibold text-navy-foreground">Refundable deposit</span>
            <span className="text-lg font-bold text-gold">{formatDeposit(deposit)}</span>
          </div>
          <p className="text-xs text-navy-foreground/60 leading-relaxed">
            One deposit for the weekend, however many days or courses you book. Returned after the event.
          </p>
        </div>
      )}

      {/* The first save now happens up beside the day cards, so this one only
          handles later edits — rooms, a changed day, switching to the stream. */}
      <button
        onClick={() => saveBooking({ thenShowCourses: !booking })}
        disabled={saving || bookingsClosed || (!days.friday && !days.saturday) || (!!booking && !daysDirty)}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-gold text-gold-foreground text-sm font-bold hover:bg-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving && <Loader2 size={15} className="animate-spin" />}
        {!booking ? 'Confirm My Weekend Booking' : daysDirty ? 'Update My Booking' : 'Booking Saved'}
      </button>

      {booking && !daysDirty && (
        <p className="text-xs text-center text-navy-foreground/50 mt-3">
          Your booking is confirmed. You can change it until bookings close.
        </p>
      )}
    </Section>
  )
}

// ── Pieces ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-12">
      <h2 className="text-2xl font-sans font-bold text-navy-foreground mb-6">{title}</h2>
      {children}
    </div>
  )
}

function DayCard({ label, sublabel, selected, disabled, disabledReason, onClick }: {
  label: string
  sublabel: string
  selected: boolean
  disabled?: boolean
  disabledReason?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className={cn(
        'text-left px-4 py-4 rounded-lg border-2 transition-colors',
        selected ? 'border-gold bg-gold/10' : 'border-navy-foreground/20',
        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-navy-foreground/40'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-base font-bold text-navy-foreground">{label}</span>
        {selected && <Check size={16} className="text-gold" />}
      </div>
      <span className="block text-xs text-navy-foreground/60 mt-1">
        {disabled && disabledReason ? disabledReason : sublabel}
      </span>
    </button>
  )
}

function RoomOption({ label, checked, blockedReason, disabled, remaining, onChange }: {
  label: string
  checked: boolean
  blockedReason: string | null
  disabled: boolean
  remaining: number | null
  onChange: (v: boolean) => void
}) {
  const unavailable = !!blockedReason || disabled
  return (
    <label
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-lg border transition-colors',
        unavailable
          ? 'border-navy-foreground/10 bg-navy-foreground/[0.02] cursor-not-allowed'
          : 'border-navy-foreground/20 bg-navy-foreground/5 cursor-pointer hover:border-navy-foreground/40'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={unavailable}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-[#E5A718] disabled:cursor-not-allowed"
      />
      <span className="flex-1">
        <span className={cn(
          'flex items-center gap-1.5 text-sm font-semibold',
          unavailable ? 'text-navy-foreground/40' : 'text-navy-foreground'
        )}>
          <BedDouble size={14} className={unavailable ? 'text-navy-foreground/30' : 'text-gold'} />
          {label}
        </span>
        <span className="block text-xs text-navy-foreground/50 mt-0.5">
          {blockedReason
            ?? (remaining != null
              ? `${Math.max(0, remaining)} room${remaining === 1 ? '' : 's'} left`
              : 'Requests are collected and allocated by Dukes')}
        </span>
      </span>
    </label>
  )
}

function CourseList(props: {
  heading: string
  courses: WeekendCourse[]
  disabled: boolean
  availability: Record<string, Availability>
  facultyByCourse: Record<string, { name: string; photo_url: string }[]>
  bookedCourses: WeekendCourse[]
  myCourseFor: (id: string) => CourseBooking | null
  expanded: string | null
  setExpanded: (id: string | null) => void
  busyCourse: string | null
  availabilityBroken: boolean
  bookCourse: (id: string, waitlist: boolean) => void
  releaseCourse: (bookingId: string, courseId: string) => void
}) {
  const {
    heading, courses, disabled, availability, facultyByCourse, bookedCourses,
    myCourseFor, expanded, setExpanded, busyCourse, availabilityBroken,
    bookCourse, releaseCourse,
  } = props

  if (courses.length === 0) {
    return (
      <div className="mb-6">
        <h4 className="text-base font-bold text-navy-foreground mb-2">{heading}</h4>
        <p className="text-sm text-navy-foreground/50">No courses have been published for {heading.toLowerCase()} yet.</p>
      </div>
    )
  }

  return (
    <div className="mb-6">
      <h4 className="text-base font-bold text-navy-foreground mb-3">{heading}</h4>
      <div className="space-y-3">
        {courses.map(course => {
          const mine = myCourseFor(course.id)
          const avail = availability[course.id]
          // Without a successful availability lookup we do not know how many
          // places remain. Assuming the course is empty would quietly turn a
          // broken function into a healthy-looking course.
          const placesKnown = !availabilityBroken && !!avail
          const placesLeft = avail?.places_left ?? course.capacity
          const isMine = mine?.status === 'booked'
          const isWaiting = mine?.status === 'waitlisted'

          // A course clashes when it overlaps something the member already
          // holds. Their own booking never counts as a clash with itself.
          const clash = !isMine && !isWaiting
            ? bookedCourses.find(b => b.id !== course.id && coursesOverlap(course, b))
            : undefined

          const full = placesKnown && placesLeft <= 0
          const busy = busyCourse === course.id
          const isOpen = expanded === course.id
          const faculty = facultyByCourse[course.id] || []

          return (
            <div
              key={course.id}
              className={cn(
                'rounded-lg border transition-colors',
                isMine ? 'border-emerald-400/40 bg-emerald-500/5'
                  : isWaiting ? 'border-amber-400/40 bg-amber-500/5'
                  : clash ? 'border-navy-foreground/10 bg-navy-foreground/[0.02]'
                  : 'border-navy-foreground/20 bg-navy-foreground/5'
              )}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className={cn(
                        'text-sm font-bold',
                        clash ? 'text-navy-foreground/40' : 'text-navy-foreground'
                      )}>
                        {course.title}
                      </h5>
                      {course.is_revision_course && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/15 text-gold text-[10px] font-bold uppercase tracking-wide">
                          <Star size={9} /> Revision
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-navy-foreground/60 mt-1 flex items-center gap-3 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} className="text-gold" />
                        {formatTime(course.starts_at)} – {formatTime(course.ends_at)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users size={11} className="text-gold" />
                        {!placesKnown
                          ? `${course.capacity} places`
                          : full
                            ? 'Full'
                            : `${placesLeft} of ${course.capacity} left`}
                        {placesKnown && avail?.waitlisted ? ` · ${avail.waitlisted} waiting` : ''}
                      </span>
                    </p>
                  </div>

                  <CourseAction
                    {...{ isMine, isWaiting, clash, full, busy, disabled, mine, course }}
                    waitlistEnabled={course.waitlist_enabled}
                    onBook={() => bookCourse(course.id, false)}
                    onWaitlist={() => bookCourse(course.id, true)}
                    onRelease={() => mine && releaseCourse(mine.id, course.id)}
                  />
                </div>

                {clash && (
                  <p className="text-xs text-navy-foreground/50 italic mb-2">
                    Clashes with {clash.title}, which you are already booked onto.
                  </p>
                )}
                {isWaiting && mine?.waitlist_position && (
                  <p className="text-xs text-amber-400 mb-2">
                    Number {mine.waitlist_position} on the waitlist — we will email you if a place frees up.
                  </p>
                )}

                {/* Each course has its own feedback form, separate from the
                    weekend's. It only makes sense once the course has run. */}
                {isMine && new Date(course.ends_at) < new Date() && (
                  <Link
                    href={`/members/events/${course.event_id}/feedback?courseId=${course.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-gold hover:text-gold/80 mb-2"
                  >
                    <MessageSquare size={12} /> Give feedback on this course
                  </Link>
                )}

                {(course.description_plain || faculty.length > 0 || course.learning_objectives?.length > 0) && (
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : course.id)}
                    className="text-xs font-semibold text-gold hover:text-gold/80 inline-flex items-center gap-1"
                  >
                    {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {isOpen ? 'Less' : 'Course details'}
                  </button>
                )}
              </div>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-navy-foreground/10 space-y-4">
                  {course.description_html && (
                    <div
                      className="event-content event-content-sm text-navy-foreground/70"
                      dangerouslySetInnerHTML={{ __html: richTextToHtml(course.description_html) }}
                    />
                  )}

                  {course.learning_objectives?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-2">Learning objectives</p>
                      <ul className="space-y-1">
                        {course.learning_objectives.map((o, i) => (
                          <li key={i} className="text-xs text-navy-foreground/70 flex gap-2">
                            <span className="text-gold shrink-0">•</span>{o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {course.timetable_data?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-2">Programme</p>
                      <div className="space-y-0">
                        {course.timetable_data.map((item, i) => (
                          <div key={i} className="flex items-start gap-3 py-2 border-b border-navy-foreground/10 last:border-0">
                            <span className="text-gold font-semibold text-xs w-12 shrink-0">{item.time}</span>
                            <div>
                              <span className="text-xs text-navy-foreground/80">{item.title}</span>
                              {item.description && (
                                <span className="block text-[11px] text-navy-foreground/50 mt-0.5">{item.description}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {faculty.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-2">Faculty</p>
                      <div className="flex flex-wrap gap-3">
                        {faculty.map((f, i) => (
                          <div key={i} className="flex items-center gap-2">
                            {f.photo_url ? (
                              <img src={f.photo_url} alt={f.name} className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-navy-foreground/10 flex items-center justify-center">
                                <UserIcon size={12} className="text-gold/60" />
                              </div>
                            )}
                            <span className="text-xs text-navy-foreground/70">{f.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CourseAction(props: {
  isMine: boolean
  isWaiting: boolean
  clash: WeekendCourse | undefined
  full: boolean
  busy: boolean
  disabled: boolean
  waitlistEnabled: boolean
  onBook: () => void
  onWaitlist: () => void
  onRelease: () => void
}) {
  const { isMine, isWaiting, clash, full, busy, disabled, waitlistEnabled, onBook, onWaitlist, onRelease } = props

  const base = 'shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

  if (busy) {
    return <span className={cn(base, 'bg-navy-foreground/10 text-navy-foreground/60 inline-flex items-center gap-1.5')}>
      <Loader2 size={11} className="animate-spin" /> Working
    </span>
  }

  if (isMine || isWaiting) {
    return (
      <button onClick={onRelease} disabled={disabled} className={cn(base, 'bg-navy-foreground/10 text-navy-foreground/70 hover:bg-red-500/15 hover:text-red-300')}>
        {isMine ? 'Release place' : 'Leave waitlist'}
      </button>
    )
  }

  if (clash) {
    return (
      <span title={`Clashes with ${clash.title}`} className={cn(base, 'bg-navy-foreground/5 text-navy-foreground/30 cursor-not-allowed')}>
        Unavailable
      </span>
    )
  }

  if (full) {
    return waitlistEnabled ? (
      <button onClick={onWaitlist} disabled={disabled} className={cn(base, 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25')}>
        Join waitlist
      </button>
    ) : (
      <span className={cn(base, 'bg-navy-foreground/5 text-navy-foreground/30')}>Full</span>
    )
  }

  return (
    <button onClick={onBook} disabled={disabled} className={cn(base, 'bg-gold text-gold-foreground hover:bg-gold/90')}>
      Book
    </button>
  )
}
