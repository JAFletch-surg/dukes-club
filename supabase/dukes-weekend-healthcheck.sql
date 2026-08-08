-- ═══════════════════════════════════════════════════════════════════
-- DUKES WEEKEND — health check
-- ═══════════════════════════════════════════════════════════════════
--
-- Read-only. Reports which pieces of the Dukes Weekend are installed and
-- which are missing, and names the file to run for anything absent. Safe to
-- run against the live database at any time — it reads catalogue tables and
-- writes nothing.
--
--   Supabase → SQL Editor → paste → Run
--
-- It returns a TABLE of results. An earlier version reported through
-- RAISE NOTICE inside a DO block, which prints nothing in the Supabase SQL
-- editor — the editor shows result sets, and a DO block returns none. Every
-- line below is a row for that reason; do not turn it back into a DO block.
--
-- Rows sort MISSING first, then OK, then the TYPE lines. Read the top of the
-- list: if it starts with MISSING, run the file named in the "fix" column.
--
-- Run this first whenever a weekend misbehaves. A booking that fails with
-- "Something went wrong" is almost always a migration that has not been
-- applied rather than a bug, and this tells the two apart in one go.
--

WITH
-- ── 1. The event type ──────────────────────────────────────────────
-- If events.event_type is plain text there is no enum value to add.
enum_col AS (
  SELECT t.typname AS enum_name
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_type t  ON t.oid = a.atttypid
  WHERE c.relname = 'events' AND a.attname = 'event_type' AND t.typtype = 'e'
),
event_type_check AS (
  SELECT
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM enum_col) THEN 'OK'
      WHEN EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = (SELECT enum_name FROM enum_col)
          AND e.enumlabel = 'Dukes Weekend'
      ) THEN 'OK'
      ELSE 'MISSING'
    END AS status,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM enum_col)
        THEN 'event type — events.event_type is plain text, no enum value needed'
      ELSE 'event type — ''Dukes Weekend'' in the ' || (SELECT enum_name FROM enum_col) || ' enum'
    END AS item,
    'supabase/add-dukes-weekend-event-type.sql' AS fix
),

-- ── 2. Tables ──────────────────────────────────────────────────────
table_checks AS (
  SELECT
    CASE WHEN to_regclass('public.' || t) IS NOT NULL THEN 'OK' ELSE 'MISSING' END,
    'table ' || t,
    'supabase/create-dukes-weekend.sql'
  FROM unnest(ARRAY[
    'weekend_courses', 'weekend_course_faculty', 'weekend_course_bookings',
    'event_payments', 'event_payment_events', 'event_sponsors'
  ]) AS t
),

-- ── 3. Columns added to existing tables ────────────────────────────
column_checks AS (
  SELECT
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name  = split_part(spec, '.', 1)
        AND column_name = split_part(spec, '.', 2)
    ) THEN 'OK' ELSE 'MISSING' END,
    'column ' || spec,
    'supabase/create-dukes-weekend.sql'
  FROM unnest(ARRAY[
    'events.weekend_deposit_pence',
    'events.weekend_stream_enabled',
    'events.weekend_friday_room_capacity',
    'events.weekend_saturday_room_capacity',
    'event_bookings.attends_friday',
    'event_bookings.attends_saturday',
    'event_bookings.attends_sunday',
    'event_bookings.saturday_mode',
    'event_bookings.room_friday_requested',
    'event_bookings.room_saturday_requested',
    'event_feedback_forms.course_id',
    'event_feedback_responses.course_id'
  ]) AS spec
),

-- ── 4. Functions ───────────────────────────────────────────────────
-- These carry every booking rule. Without them the booking route fails with
-- PGRST202 (function not found), which is what a member sees as
-- "Something went wrong".
function_checks AS (
  SELECT
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    ) THEN 'OK' ELSE 'MISSING' END,
    'function ' || fn || '()',
    'supabase/dukes-weekend-functions.sql'
  FROM unnest(ARRAY[
    'is_full_member',
    'weekend_booking_guard',
    'promote_weekend_waitlist',
    'save_weekend_booking',
    'book_weekend_course',
    'cancel_weekend_course_booking',
    'transition_event_payments',
    'weekend_course_availability',
    'weekend_room_availability'
  ]) AS fn
),

-- ── 5. The room guard trigger ──────────────────────────────────────
trigger_check AS (
  SELECT
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'weekend_booking_guard_trigger'
    ) THEN 'OK' ELSE 'MISSING' END,
    'trigger weekend_booking_guard_trigger',
    'supabase/dukes-weekend-functions.sql'
),

-- ── 6. Unrelated, but it bites event descriptions ──────────────────
description_check AS (
  SELECT
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'description_html'
    ) THEN 'OK' ELSE 'MISSING' END,
    'column events.description_html — descriptions lose their formatting on save without it',
    'supabase/add-event-description-html.sql'
),

-- ── 7. Actual data types of the columns the weekend code touches ───
-- Three separate rounds of bugs came from assuming a column was text when it
-- is an enum: events.event_type, event_bookings.status, then
-- profiles.training_stage. This section exists so the whole picture shows in
-- one run rather than one column at a time. These lines are never MISSING —
-- they are information. A column reported here as USER-DEFINED is an enum,
-- and any value written to it must be cast rather than mixed with a literal.
type_rows AS (
  SELECT
    'TYPE' AS status,
    'type  ' || spec || '  →  ' || COALESCE(
      (SELECT CASE WHEN c.data_type = 'USER-DEFINED'
                   THEN c.udt_name || ' (enum)'
                   ELSE c.data_type END
       FROM information_schema.columns c
       WHERE c.table_schema = 'public'
         AND c.table_name  = split_part(spec, '.', 1)
         AND c.column_name = split_part(spec, '.', 2)),
      'column not present') AS item,
    '' AS fix
  FROM unnest(ARRAY[
    'profiles.training_stage',
    'profiles.region',
    'profiles.role',
    'profiles.approval_status',
    'events.event_type',
    'events.status',
    'events.access_level',
    'event_bookings.status',
    'event_bookings.applicant_name',
    'event_bookings.applicant_email',
    'event_bookings.applicant_training_level',
    'event_bookings.applicant_hospital',
    'event_bookings.applicant_deanery',
    'event_bookings.saturday_mode',
    'weekend_courses.day',
    'weekend_course_bookings.status'
  ]) AS spec
),

all_rows AS (
  SELECT * FROM event_type_check
  UNION ALL SELECT * FROM table_checks
  UNION ALL SELECT * FROM column_checks
  UNION ALL SELECT * FROM function_checks
  UNION ALL SELECT * FROM trigger_check
  UNION ALL SELECT * FROM description_check
  UNION ALL SELECT * FROM type_rows
)

SELECT
  status,
  item,
  -- Nothing to run for a check that passed, so the column stays empty except
  -- where there is something to do.
  CASE WHEN status = 'MISSING' THEN fix ELSE '' END AS fix
FROM all_rows
ORDER BY
  CASE status WHEN 'MISSING' THEN 1 WHEN 'OK' THEN 2 ELSE 3 END,
  -- Within MISSING, the order the files must be run in.
  CASE
    WHEN fix = 'supabase/add-dukes-weekend-event-type.sql' THEN 1
    WHEN fix = 'supabase/create-dukes-weekend.sql'         THEN 2
    WHEN fix = 'supabase/dukes-weekend-functions.sql'      THEN 3
    ELSE 4
  END,
  item;
