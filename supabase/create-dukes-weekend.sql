-- ═══════════════════════════════════════════════════════════════════
-- DUKES WEEKEND — schema, standalone migration
-- ═══════════════════════════════════════════════════════════════════
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query),
-- then run supabase/dukes-weekend-functions.sql, which adds the booking
-- functions that enforce the rules this schema only partly expresses.
-- This script is idempotent — safe to run multiple times.
--
-- A Dukes Weekend is an event_type on the existing events table, in the same
-- way Webinar and In Person Course are — no new event entity. It spans
-- Friday (courses) / Saturday (main programme) / Sunday (courses, incl. a
-- revision course). Weekend-only fields hang off events and event_bookings as
-- nullable columns, exactly as the streaming and application fields do.
--
-- The weekend booking itself stays ONE event_bookings row per member per
-- event, so the applicants view, feedback linkage and certificates keep
-- working untouched. Course sign-ups are child rows in
-- weekend_course_bookings.
--

-- ───────────────────────────────────────────────────────────────────
-- 1. Weekend settings on the parent event
-- ───────────────────────────────────────────────────────────────────
-- Booking close deliberately reuses the existing application_deadline column
-- rather than adding a second one.

ALTER TABLE events ADD COLUMN IF NOT EXISTS weekend_deposit_pence           INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS weekend_stream_enabled          BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS weekend_stream_url              TEXT;
-- NULL room capacity = uncapped. Admins set these per weekend; the booking
-- function refuses requests once a night is full.
ALTER TABLE events ADD COLUMN IF NOT EXISTS weekend_friday_room_capacity    INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS weekend_saturday_room_capacity  INTEGER;

-- ───────────────────────────────────────────────────────────────────
-- 2. Weekend fields on the booking
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE event_bookings ADD COLUMN IF NOT EXISTS attends_friday          BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE event_bookings ADD COLUMN IF NOT EXISTS attends_saturday        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE event_bookings ADD COLUMN IF NOT EXISTS attends_sunday          BOOLEAN NOT NULL DEFAULT false;
-- 'in_person' | 'stream'. NULL when the member is not attending Saturday.
ALTER TABLE event_bookings ADD COLUMN IF NOT EXISTS saturday_mode           TEXT;
ALTER TABLE event_bookings ADD COLUMN IF NOT EXISTS room_friday_requested   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE event_bookings ADD COLUMN IF NOT EXISTS room_saturday_requested BOOLEAN NOT NULL DEFAULT false;
-- Rooms are allocated by Dukes — the member states a need, never a preference.
-- These record what was allocated, filled in by an admin after the fact.
ALTER TABLE event_bookings ADD COLUMN IF NOT EXISTS room_friday_allocated   TEXT;
ALTER TABLE event_bookings ADD COLUMN IF NOT EXISTS room_saturday_allocated TEXT;

-- Validation rule 2, at the lowest level we can put it: Sunday requires
-- Saturday. Friday is independent, so it gets no constraint.
ALTER TABLE event_bookings DROP CONSTRAINT IF EXISTS event_bookings_sunday_requires_saturday;
ALTER TABLE event_bookings ADD CONSTRAINT event_bookings_sunday_requires_saturday
  CHECK (NOT attends_sunday OR attends_saturday);

ALTER TABLE event_bookings DROP CONSTRAINT IF EXISTS event_bookings_saturday_mode_valid;
ALTER TABLE event_bookings ADD CONSTRAINT event_bookings_saturday_mode_valid
  CHECK (saturday_mode IS NULL OR saturday_mode IN ('in_person', 'stream'));

-- Validation rule 7. A stream attendee is not at the venue on Saturday night.
-- The Friday-night equivalent depends on course bookings in another table, so
-- it lives in save_weekend_booking() rather than here.
ALTER TABLE event_bookings DROP CONSTRAINT IF EXISTS event_bookings_saturday_room_requires_in_person;
ALTER TABLE event_bookings ADD CONSTRAINT event_bookings_saturday_room_requires_in_person
  CHECK (
    NOT room_saturday_requested
    OR (attends_saturday AND saturday_mode = 'in_person')
  );

-- ───────────────────────────────────────────────────────────────────
-- 3. weekend_courses — the Friday and Sunday courses
-- ───────────────────────────────────────────────────────────────────
-- Shaped deliberately like events (starts_at/ends_at, capacity,
-- description_html + description_plain, timetable_data jsonb) so the admin
-- editor and public rendering reuse the same idioms.

CREATE TABLE IF NOT EXISTS weekend_courses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  day                 TEXT NOT NULL CHECK (day IN ('friday', 'sunday')),
  title               TEXT NOT NULL,
  description_html    TEXT,
  description_plain   TEXT,
  starts_at           TIMESTAMPTZ NOT NULL,
  ends_at             TIMESTAMPTZ NOT NULL,
  -- Hard cap. Enforced under a row lock in book_weekend_course().
  capacity            INTEGER NOT NULL CHECK (capacity > 0),
  -- Labelling and reporting only. The revision course is an ordinary
  -- sign-up with ordinary capacity.
  is_revision_course  BOOLEAN NOT NULL DEFAULT false,
  -- Ordered array of plain strings.
  learning_objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Ordered array of { time, title, description, faculty_id }.
  timetable_data      JSONB NOT NULL DEFAULT '[]'::jsonb,
  waitlist_enabled    BOOLEAN NOT NULL DEFAULT true,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT weekend_courses_ends_after_starts CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS weekend_courses_event_idx ON weekend_courses (event_id, day, sort_order);

-- ───────────────────────────────────────────────────────────────────
-- 4. weekend_course_faculty — same shape as event_faculty
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS weekend_course_faculty (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES weekend_courses(id) ON DELETE CASCADE,
  faculty_id  UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  role        TEXT DEFAULT 'Faculty',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, faculty_id)
);

CREATE INDEX IF NOT EXISTS weekend_course_faculty_course_idx ON weekend_course_faculty (course_id);

-- ───────────────────────────────────────────────────────────────────
-- 5. weekend_course_bookings — a member's place on one course
-- ───────────────────────────────────────────────────────────────────
-- One row per (course, member), reused on rebooking rather than inserted
-- twice — the same approach registerForEvent() takes in lib/events.ts.
--
-- There is no INSERT/UPDATE policy on this table by design: every write goes
-- through the SECURITY DEFINER functions, so the capacity, overlap and
-- waitlist rules cannot be bypassed by talking to PostgREST directly.

CREATE TABLE IF NOT EXISTS weekend_course_bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        UUID NOT NULL REFERENCES event_bookings(id) ON DELETE CASCADE,
  course_id         UUID NOT NULL REFERENCES weekend_courses(id) ON DELETE CASCADE,
  -- Denormalised from the course so per-event queries and RLS stay cheap.
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'booked'
                      CHECK (status IN ('booked', 'waitlisted', 'cancelled')),
  -- 1-based queue position; NULL unless status = 'waitlisted'.
  waitlist_position INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at      TIMESTAMPTZ,
  UNIQUE (course_id, user_id)
);

CREATE INDEX IF NOT EXISTS weekend_course_bookings_course_idx ON weekend_course_bookings (course_id, status);
CREATE INDEX IF NOT EXISTS weekend_course_bookings_user_idx   ON weekend_course_bookings (event_id, user_id, status);
CREATE INDEX IF NOT EXISTS weekend_course_bookings_booking_idx ON weekend_course_bookings (booking_id);

-- ───────────────────────────────────────────────────────────────────
-- 6. event_payments — the refundable deposit
-- ───────────────────────────────────────────────────────────────────
-- One deposit per member per weekend booking, for the weekend in general —
-- not per day and not per course. Validation rule 8 is the UNIQUE constraint
-- on booking_id: the database will not let a second deposit exist, whatever
-- the application does.
--
-- Every column Stripe will need is already here, so switching the provider on
-- is credentials plus config, not a migration.

CREATE TABLE IF NOT EXISTS event_payments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id         UUID NOT NULL UNIQUE REFERENCES event_bookings(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL DEFAULT 'deposit',
  amount_pence       INTEGER NOT NULL CHECK (amount_pence >= 0),
  currency           TEXT NOT NULL DEFAULT 'GBP',
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'held', 'paid', 'refunded', 'failed')),
  -- 'manual' today, 'stripe' once the flag is flipped.
  provider           TEXT NOT NULL DEFAULT 'manual',
  provider_intent_id TEXT,
  provider_charge_id TEXT,
  paid_at            TIMESTAMPTZ,
  refunded_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_payments_event_idx ON event_payments (event_id, status);
CREATE INDEX IF NOT EXISTS event_payments_user_idx  ON event_payments (user_id);

-- ───────────────────────────────────────────────────────────────────
-- 7. event_payment_events — audit trail of status transitions
-- ───────────────────────────────────────────────────────────────────
-- Append-only. actor_id NULL means the transition was made by the system
-- (e.g. a provider webhook) rather than by an admin.

CREATE TABLE IF NOT EXISTS event_payment_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id  UUID NOT NULL REFERENCES event_payments(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_payment_events_payment_idx ON event_payment_events (payment_id, created_at);

-- ───────────────────────────────────────────────────────────────────
-- 8. event_sponsors — attach existing sponsors to an event
-- ───────────────────────────────────────────────────────────────────
-- The sponsors table already carries name, logo_url, tier, website_url,
-- description and sort_order, so this is a junction and nothing more.
-- tier_override lets a sponsor sit at a different level for one event
-- without disturbing its global tier.

CREATE TABLE IF NOT EXISTS event_sponsors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sponsor_id    UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  tier_override TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, sponsor_id)
);

CREATE INDEX IF NOT EXISTS event_sponsors_event_idx ON event_sponsors (event_id, sort_order);

-- ───────────────────────────────────────────────────────────────────
-- 9. Per-course feedback
-- ───────────────────────────────────────────────────────────────────
-- Feedback has two levels: one form for the weekend overall (course_id NULL,
-- which is every pre-existing form) and one form per course.
--
-- IMPORTANT: the admin and member feedback pages both load with
-- .eq('event_id', …).single(). Those queries must also filter
-- .is('course_id', null) or they break as soon as a weekend has course
-- forms. The partial unique indexes below are what make that filter
-- sufficient.

ALTER TABLE event_feedback_forms     ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES weekend_courses(id) ON DELETE CASCADE;
ALTER TABLE event_feedback_responses ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES weekend_courses(id) ON DELETE CASCADE;

-- One event-level form per event; one form per course.
CREATE UNIQUE INDEX IF NOT EXISTS event_feedback_forms_event_unique
  ON event_feedback_forms (event_id) WHERE course_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS event_feedback_forms_course_unique
  ON event_feedback_forms (course_id) WHERE course_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS event_feedback_responses_course_idx
  ON event_feedback_responses (course_id);

-- ───────────────────────────────────────────────────────────────────
-- 10. Row Level Security
-- ───────────────────────────────────────────────────────────────────
-- Same shapes as the rest of the site: published content is world-readable,
-- writes are is_admin(), members read their own rows.

-- ═══ weekend_courses ═══

ALTER TABLE weekend_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekend_courses_select_published" ON weekend_courses;
DROP POLICY IF EXISTS "weekend_courses_select_admin" ON weekend_courses;
DROP POLICY IF EXISTS "weekend_courses_insert_admin" ON weekend_courses;
DROP POLICY IF EXISTS "weekend_courses_update_admin" ON weekend_courses;
DROP POLICY IF EXISTS "weekend_courses_delete_admin" ON weekend_courses;

CREATE POLICY "weekend_courses_select_published"
  ON weekend_courses FOR SELECT
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.status = 'published'));

CREATE POLICY "weekend_courses_select_admin"
  ON weekend_courses FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "weekend_courses_insert_admin"
  ON weekend_courses FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "weekend_courses_update_admin"
  ON weekend_courses FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "weekend_courses_delete_admin"
  ON weekend_courses FOR DELETE
  TO authenticated
  USING (is_admin());

-- ═══ weekend_course_faculty ═══
-- Mirrors event_faculty exactly.

ALTER TABLE weekend_course_faculty ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekend_course_faculty_select_public" ON weekend_course_faculty;
DROP POLICY IF EXISTS "weekend_course_faculty_insert_admin" ON weekend_course_faculty;
DROP POLICY IF EXISTS "weekend_course_faculty_delete_admin" ON weekend_course_faculty;

CREATE POLICY "weekend_course_faculty_select_public"
  ON weekend_course_faculty FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "weekend_course_faculty_insert_admin"
  ON weekend_course_faculty FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "weekend_course_faculty_delete_admin"
  ON weekend_course_faculty FOR DELETE
  TO authenticated
  USING (is_admin());

-- ═══ weekend_course_bookings ═══
-- SELECT only for members. No INSERT or UPDATE policy: writes go exclusively
-- through book_weekend_course() / cancel_weekend_course_booking(), which are
-- SECURITY DEFINER and therefore bypass RLS. Admins may correct rows by hand.

ALTER TABLE weekend_course_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekend_course_bookings_select_own" ON weekend_course_bookings;
DROP POLICY IF EXISTS "weekend_course_bookings_select_admin" ON weekend_course_bookings;
DROP POLICY IF EXISTS "weekend_course_bookings_update_admin" ON weekend_course_bookings;
DROP POLICY IF EXISTS "weekend_course_bookings_delete_admin" ON weekend_course_bookings;

CREATE POLICY "weekend_course_bookings_select_own"
  ON weekend_course_bookings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "weekend_course_bookings_select_admin"
  ON weekend_course_bookings FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "weekend_course_bookings_update_admin"
  ON weekend_course_bookings FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "weekend_course_bookings_delete_admin"
  ON weekend_course_bookings FOR DELETE
  TO authenticated
  USING (is_admin());

-- ═══ event_payments ═══
-- Members see their own deposit and its status. Only admins change it, and
-- the API route writes the audit row alongside every change.

ALTER TABLE event_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_payments_select_own" ON event_payments;
DROP POLICY IF EXISTS "event_payments_select_admin" ON event_payments;
DROP POLICY IF EXISTS "event_payments_update_admin" ON event_payments;
DROP POLICY IF EXISTS "event_payments_delete_admin" ON event_payments;

CREATE POLICY "event_payments_select_own"
  ON event_payments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "event_payments_select_admin"
  ON event_payments FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "event_payments_update_admin"
  ON event_payments FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "event_payments_delete_admin"
  ON event_payments FOR DELETE
  TO authenticated
  USING (is_admin());

-- ═══ event_payment_events ═══
-- Read-only audit trail, admin eyes only. Written by service role / functions.

ALTER TABLE event_payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_payment_events_select_admin" ON event_payment_events;

CREATE POLICY "event_payment_events_select_admin"
  ON event_payment_events FOR SELECT
  TO authenticated
  USING (is_admin());

-- ═══ event_sponsors ═══

ALTER TABLE event_sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_sponsors_select_public" ON event_sponsors;
DROP POLICY IF EXISTS "event_sponsors_insert_admin" ON event_sponsors;
DROP POLICY IF EXISTS "event_sponsors_update_admin" ON event_sponsors;
DROP POLICY IF EXISTS "event_sponsors_delete_admin" ON event_sponsors;

CREATE POLICY "event_sponsors_select_public"
  ON event_sponsors FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "event_sponsors_insert_admin"
  ON event_sponsors FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "event_sponsors_update_admin"
  ON event_sponsors FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "event_sponsors_delete_admin"
  ON event_sponsors FOR DELETE
  TO authenticated
  USING (is_admin());

-- ───────────────────────────────────────────────────────────────────
-- 11. Verify
-- ───────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE '✓ events: weekend deposit, streaming and room-capacity columns';
  RAISE NOTICE '✓ event_bookings: day attendance, saturday_mode and room request columns';
  RAISE NOTICE '✓ weekend_courses + weekend_course_faculty + weekend_course_bookings';
  RAISE NOTICE '✓ event_payments + event_payment_events (deposit and audit trail)';
  RAISE NOTICE '✓ event_sponsors junction over the existing sponsors table';
  RAISE NOTICE '✓ course_id added to event_feedback_forms and event_feedback_responses';
  RAISE NOTICE '✓ RLS enabled on all new tables';
  RAISE NOTICE '→ Now run supabase/dukes-weekend-functions.sql';
END $$;
