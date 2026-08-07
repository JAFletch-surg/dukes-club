-- ═══════════════════════════════════════════════════════════════════
-- DUKES WEEKEND — rule checks (optional)
-- ═══════════════════════════════════════════════════════════════════
--
-- Exercises every server-side rule in §10 of the spec against a throwaway
-- weekend, then rolls everything back. Nothing is left behind, so it is safe
-- to run against a real database — but it does take row locks on the rows it
-- creates, so prefer a staging copy.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/dukes-weekend-tests.sql
--
-- Any failure aborts with FAIL [rule n]. Success prints an "ok" line per rule.
--
-- Run supabase/create-dukes-weekend.sql and supabase/dukes-weekend-functions.sql
-- first. These checks call the functions directly, so they assume auth.uid()
-- can be steered — on Supabase that means running as a superuser/postgres
-- role, where the helper below shadows auth.uid() for the transaction.
--

BEGIN;

-- ── Harness ────────────────────────────────────────────────────────
-- Point auth.uid() at a settable GUC so the checks can act as different
-- members. Rolled back with everything else at the end.

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('test.uid', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION t_as(p_uid UUID) RETURNS void AS $$
  SELECT set_config('test.uid', p_uid::text, true);
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION t_expect_error(p_sql TEXT, p_expected TEXT, p_label TEXT)
RETURNS void AS $$
DECLARE v_err TEXT := NULL;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  IF v_err IS NULL THEN
    RAISE EXCEPTION 'FAIL [%]: expected "%" but the call succeeded', p_label, p_expected;
  ELSIF position(p_expected IN v_err) = 0 THEN
    RAISE EXCEPTION 'FAIL [%]: expected "%" but got "%"', p_label, p_expected, v_err;
  END IF;
  RAISE NOTICE '  ok   % — rejected with %', p_label, p_expected;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION t_expect_ok(p_sql TEXT, p_label TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE p_sql;
  RAISE NOTICE '  ok   % — allowed', p_label;
END;
$$ LANGUAGE plpgsql;

-- ── Fixture ────────────────────────────────────────────────────────

INSERT INTO profiles (id, full_name, email, role, approval_status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Member One',  'm1@test',      'member',  'approved'),
  ('22222222-2222-2222-2222-222222222222', 'Member Two',  'm2@test',      'member',  'approved'),
  ('33333333-3333-3333-3333-333333333333', 'Trainee',     'trainee@test', 'trainee', 'approved'),
  ('44444444-4444-4444-4444-444444444444', 'Admin',       'admin@test',   'admin',   'approved');

INSERT INTO events (id, title, slug, event_type, status, starts_at, ends_at,
                    weekend_deposit_pence, weekend_stream_enabled,
                    weekend_friday_room_capacity, weekend_saturday_room_capacity, auto_approve)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Weekend', 'test-weekend',
        'Dukes Weekend', 'published',
        '2099-06-05 09:00+00', '2099-06-07 17:00+00',
        5000, true, 1, 1, true);

-- F1 and F2 overlap; F3 is clear of both.
INSERT INTO weekend_courses (id, event_id, day, title, starts_at, ends_at, capacity, is_revision_course) VALUES
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'friday', 'Friday A',
   '2099-06-05 09:00+00', '2099-06-05 12:00+00', 1, false),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'friday', 'Friday B (overlaps A)',
   '2099-06-05 10:00+00', '2099-06-05 13:00+00', 5, false),
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'friday', 'Friday C (clear)',
   '2099-06-05 14:00+00', '2099-06-05 16:00+00', 5, false),
  ('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sunday', 'Sunday Revision',
   '2099-06-07 09:00+00', '2099-06-07 12:00+00', 5, true);

DO $$ BEGIN RAISE NOTICE 'Dukes Weekend rule checks'; END $$;

-- ── Rule 1 — only members may book ─────────────────────────────────

SELECT t_as('33333333-3333-3333-3333-333333333333');
SELECT t_expect_error(
  $$ SELECT save_weekend_booking('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, false, false, NULL, false, false) $$,
  'NOT_A_MEMBER', 'rule 1  trainee cannot book');

SELECT t_as(NULL);
SELECT t_expect_error(
  $$ SELECT save_weekend_booking('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, false, false, NULL, false, false) $$,
  'NOT_AUTHENTICATED', 'rule 1  logged out cannot book');

-- ── Rule 2 — Sunday requires Saturday ──────────────────────────────

SELECT t_as('11111111-1111-1111-1111-111111111111');
SELECT t_expect_error(
  $$ SELECT save_weekend_booking('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false, false, true, NULL, false, false) $$,
  'NO_DAYS_SELECTED', 'rule 2  Sunday only');
SELECT t_expect_error(
  $$ SELECT save_weekend_booking('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, false, true, NULL, false, false) $$,
  'SUNDAY_REQUIRES_SATURDAY', 'rule 2  Friday + Sunday, no Saturday');

-- ── Rule 3 — Friday may be booked alone ────────────────────────────

SELECT t_expect_ok(
  $$ SELECT save_weekend_booking('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, false, false, NULL, false, false) $$,
  'rule 3  Friday only');

-- And the three remaining valid combinations.
SELECT t_expect_ok(
  $$ SELECT save_weekend_booking('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false, true, false, 'in_person', false, false) $$,
  'rule 3  Saturday only');
SELECT t_expect_ok(
  $$ SELECT save_weekend_booking('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, true, false, 'in_person', false, false) $$,
  'rule 3  Friday + Saturday');
SELECT t_expect_ok(
  $$ SELECT save_weekend_booking('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, true, true, 'in_person', false, false) $$,
  'rule 3  Friday + Saturday + Sunday');

-- ── Rule 4 — one course per overlapping slot ───────────────────────

SELECT t_expect_ok(
  $$ SELECT book_weekend_course('cccccccc-0000-0000-0000-000000000001') $$,
  'rule 4  first Friday course');
SELECT t_expect_error(
  $$ SELECT book_weekend_course('cccccccc-0000-0000-0000-000000000002') $$,
  'COURSE_OVERLAP', 'rule 4  overlapping course');
SELECT t_expect_ok(
  $$ SELECT book_weekend_course('cccccccc-0000-0000-0000-000000000003') $$,
  'rule 4  non-overlapping course');

-- ── Rule 5 — capacity ──────────────────────────────────────────────
-- Friday A has capacity 1 and member one holds it.

SELECT t_as('22222222-2222-2222-2222-222222222222');
SELECT save_weekend_booking('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, true, true, 'in_person', false, false);

SELECT t_expect_error(
  $$ SELECT book_weekend_course('cccccccc-0000-0000-0000-000000000001', false) $$,
  'COURSE_FULL', 'rule 5  full course with waitlist declined');

SELECT t_expect_ok(
  $$ SELECT book_weekend_course('cccccccc-0000-0000-0000-000000000001', true) $$,
  'rule 5  full course joins waitlist');

DO $$
DECLARE v_status TEXT; v_pos INTEGER;
BEGIN
  SELECT status, waitlist_position INTO v_status, v_pos
  FROM weekend_course_bookings
  WHERE course_id = 'cccccccc-0000-0000-0000-000000000001'
    AND user_id = '22222222-2222-2222-2222-222222222222';
  IF v_status <> 'waitlisted' OR v_pos <> 1 THEN
    RAISE EXCEPTION 'FAIL [rule 5]: expected waitlisted at position 1, got % at %', v_status, v_pos;
  END IF;
  RAISE NOTICE '  ok   rule 5  waitlisted at position 1';
END $$;

-- ── Rule 6 — Friday room requires a Friday course ──────────────────
-- Member two is on the Friday A waitlist only, which is not attendance.

SELECT t_expect_error(
  $$ SELECT save_weekend_booking('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, true, true, 'in_person', true, false) $$,
  'FRIDAY_ROOM_REQUIRES_FRIDAY_COURSE', 'rule 6  Friday room without a confirmed course');

-- Member one does hold Friday courses, so the request stands.
SELECT t_as('11111111-1111-1111-1111-111111111111');
SELECT t_expect_ok(
  $$ SELECT save_weekend_booking('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, true, true, 'in_person', true, true) $$,
  'rule 6  Friday room with a confirmed course');

-- Room capacity is 1 per night, and member one now holds both.
SELECT t_as('22222222-2222-2222-2222-222222222222');
SELECT t_expect_ok(
  $$ SELECT book_weekend_course('cccccccc-0000-0000-0000-000000000003') $$,
  'rule 6  member two takes a clear Friday course');
SELECT t_expect_error(
  $$ SELECT save_weekend_booking('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, true, true, 'in_person', true, false) $$,
  'FRIDAY_ROOMS_FULL', 'rule 6  Friday rooms at venue capacity');

-- ── Rule 7 — Saturday room requires in-person attendance ───────────
-- Switching to the stream drops the Saturday room rather than erroring, so a
-- member changing their mind keeps their booking.

SELECT t_as('11111111-1111-1111-1111-111111111111');
SELECT save_weekend_booking('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, true, true, 'stream', true, true);

DO $$
DECLARE v_sat BOOLEAN; v_mode TEXT;
BEGIN
  SELECT room_saturday_requested, saturday_mode INTO v_sat, v_mode
  FROM event_bookings
  WHERE event_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND user_id = '11111111-1111-1111-1111-111111111111';
  IF v_mode <> 'stream' OR v_sat THEN
    RAISE EXCEPTION 'FAIL [rule 7]: stream attendee kept a Saturday room (mode %, room %)', v_mode, v_sat;
  END IF;
  RAISE NOTICE '  ok   rule 7  stream attendee has no Saturday room';
END $$;

-- Back to in person for the rest of the checks.
SELECT save_weekend_booking('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, true, true, 'in_person', true, true);

-- Streaming that is switched off cannot be selected at all.
UPDATE events SET weekend_stream_enabled = false WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT t_expect_error(
  $$ SELECT save_weekend_booking('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, true, true, 'stream', false, false) $$,
  'STREAMING_NOT_AVAILABLE', 'rule 9  stream when the weekend is not streamed');
UPDATE events SET weekend_stream_enabled = true WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- ── Rule 8 — one deposit per member per weekend booking ────────────

INSERT INTO event_payments (event_id, user_id, booking_id, amount_pence)
SELECT event_id, user_id, id, 5000 FROM event_bookings
WHERE event_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND user_id = '11111111-1111-1111-1111-111111111111';

SELECT t_expect_error(
  $$ INSERT INTO event_payments (event_id, user_id, booking_id, amount_pence)
     SELECT event_id, user_id, id, 5000 FROM event_bookings
     WHERE event_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       AND user_id = '11111111-1111-1111-1111-111111111111' $$,
  'duplicate key', 'rule 8  second deposit on one booking');

-- ── Waitlist promotion and room invalidation on cancellation ───────
-- Member one drops Friday A. Member two is next in the queue and does not
-- clash, so the place is theirs.

DO $$
DECLARE v_id UUID; v_result JSONB; v_status TEXT;
BEGIN
  PERFORM t_as('11111111-1111-1111-1111-111111111111');
  SELECT id INTO v_id FROM weekend_course_bookings
  WHERE course_id = 'cccccccc-0000-0000-0000-000000000001'
    AND user_id = '11111111-1111-1111-1111-111111111111';

  v_result := cancel_weekend_course_booking(v_id);

  IF v_result->'promoted'->>'user_id' <> '22222222-2222-2222-2222-222222222222' THEN
    RAISE EXCEPTION 'FAIL [waitlist]: expected member two promoted, got %', v_result->'promoted';
  END IF;

  SELECT status INTO v_status FROM weekend_course_bookings
  WHERE course_id = 'cccccccc-0000-0000-0000-000000000001'
    AND user_id = '22222222-2222-2222-2222-222222222222';
  IF v_status <> 'booked' THEN
    RAISE EXCEPTION 'FAIL [waitlist]: promoted row is %', v_status;
  END IF;
  RAISE NOTICE '  ok   waitlist  place freed and next member promoted';
END $$;

-- Dropping the last Friday course must invalidate the Friday room request.
DO $$
DECLARE v_id UUID; v_result JSONB; v_room BOOLEAN;
BEGIN
  PERFORM t_as('11111111-1111-1111-1111-111111111111');
  SELECT id INTO v_id FROM weekend_course_bookings
  WHERE course_id = 'cccccccc-0000-0000-0000-000000000003'
    AND user_id = '11111111-1111-1111-1111-111111111111';

  v_result := cancel_weekend_course_booking(v_id);

  IF NOT (v_result->>'friday_room_cleared')::boolean THEN
    RAISE EXCEPTION 'FAIL [rooms]: last Friday course dropped but room not cleared';
  END IF;

  SELECT room_friday_requested INTO v_room FROM event_bookings
  WHERE event_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND user_id = '11111111-1111-1111-1111-111111111111';
  IF v_room THEN
    RAISE EXCEPTION 'FAIL [rooms]: orphaned Friday room request left behind';
  END IF;
  RAISE NOTICE '  ok   rooms     Friday room invalidated with the last Friday course';
END $$;

-- Dropping Saturday must cascade to the Sunday courses too.
DO $$
DECLARE v_result JSONB; v_left INTEGER;
BEGIN
  PERFORM t_as('22222222-2222-2222-2222-222222222222');
  PERFORM book_weekend_course('cccccccc-0000-0000-0000-000000000004');

  v_result := save_weekend_booking('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, true, false, 'in_person', false, false);

  SELECT COUNT(*) INTO v_left FROM weekend_course_bookings
  WHERE user_id = '22222222-2222-2222-2222-222222222222'
    AND course_id = 'cccccccc-0000-0000-0000-000000000004'
    AND status = 'booked';
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'FAIL [cascade]: Sunday course survived dropping Sunday';
  END IF;
  RAISE NOTICE '  ok   cascade   dropping a day releases that day''s course places';
END $$;

-- ── Booking window ─────────────────────────────────────────────────

UPDATE events SET application_deadline = now() - interval '1 day'
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SELECT t_as('11111111-1111-1111-1111-111111111111');
SELECT t_expect_error(
  $$ SELECT book_weekend_course('cccccccc-0000-0000-0000-000000000003') $$,
  'BOOKING_CLOSED', 'switching  closed after the booking deadline');

-- ── Deposit transitions are admin-only and audited ─────────────────

SELECT t_expect_error(
  $$ SELECT transition_event_payments(ARRAY(SELECT id FROM event_payments), 'refunded') $$,
  'NOT_AN_ADMIN', 'deposits  member cannot refund');

SELECT t_as('44444444-4444-4444-4444-444444444444');
DO $$
DECLARE v_audit INTEGER;
BEGIN
  PERFORM transition_event_payments(ARRAY(SELECT id FROM event_payments), 'paid', 'marked paid at registration');
  PERFORM transition_event_payments(ARRAY(SELECT id FROM event_payments), 'refunded', 'refunded after the weekend');

  SELECT COUNT(*) INTO v_audit FROM event_payment_events;
  IF v_audit <> 2 THEN
    RAISE EXCEPTION 'FAIL [deposits]: expected 2 audit rows, got %', v_audit;
  END IF;
  RAISE NOTICE '  ok   deposits  admin transitions recorded in the audit trail';
END $$;

DO $$ BEGIN RAISE NOTICE 'All Dukes Weekend rule checks passed.'; END $$;

ROLLBACK;
