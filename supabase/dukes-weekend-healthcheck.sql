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
-- Run this first whenever a weekend misbehaves. A booking that fails with
-- "Something went wrong" is almost always a migration that has not been
-- applied rather than a bug, and this tells the two apart in one go.
--

DO $$
DECLARE
  v_missing   TEXT[] := ARRAY[]::TEXT[];
  v_files     TEXT[] := ARRAY[]::TEXT[];
  -- Doubles as the loop variable for each thing being checked, so every
  -- section reports in the same shape: a boolean and the name.
  v_enum_type TEXT;
  v_ok        BOOLEAN;
BEGIN
  RAISE NOTICE ' ';
  RAISE NOTICE '════ DUKES WEEKEND HEALTH CHECK ════';
  RAISE NOTICE ' ';

  -- ── 1. The event type ──────────────────────────────────────────
  SELECT t.typname INTO v_enum_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_type t  ON t.oid = a.atttypid
  WHERE c.relname = 'events' AND a.attname = 'event_type' AND t.typtype = 'e';

  IF v_enum_type IS NULL THEN
    RAISE NOTICE 'OK       events.event_type is plain text — no enum value needed';
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = v_enum_type AND e.enumlabel = 'Dukes Weekend'
    ) INTO v_ok;

    IF v_ok THEN
      RAISE NOTICE 'OK       ''Dukes Weekend'' is a valid % value', v_enum_type;
    ELSE
      RAISE NOTICE 'MISSING  ''Dukes Weekend'' is not a valid % value', v_enum_type;
      v_missing := v_missing || 'event_type enum value'::TEXT;
      v_files   := v_files   || 'supabase/add-dukes-weekend-event-type.sql'::TEXT;
    END IF;
  END IF;

  -- ── 2. Tables ──────────────────────────────────────────────────
  FOR v_ok, v_enum_type IN
    SELECT to_regclass('public.' || t) IS NOT NULL, t
    FROM unnest(ARRAY[
      'weekend_courses', 'weekend_course_faculty', 'weekend_course_bookings',
      'event_payments', 'event_payment_events', 'event_sponsors'
    ]) AS t
  LOOP
    IF v_ok THEN
      RAISE NOTICE 'OK       table %', v_enum_type;
    ELSE
      RAISE NOTICE 'MISSING  table %', v_enum_type;
      v_missing := v_missing || ('table ' || v_enum_type)::TEXT;
      v_files   := v_files   || 'supabase/create-dukes-weekend.sql'::TEXT;
    END IF;
  END LOOP;

  -- ── 3. Columns added to existing tables ────────────────────────
  FOR v_ok, v_enum_type IN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = split_part(spec, '.', 1)
        AND column_name = split_part(spec, '.', 2)
    ), spec
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
  LOOP
    IF v_ok THEN
      RAISE NOTICE 'OK       column %', v_enum_type;
    ELSE
      RAISE NOTICE 'MISSING  column %', v_enum_type;
      v_missing := v_missing || ('column ' || v_enum_type)::TEXT;
      v_files   := v_files   || 'supabase/create-dukes-weekend.sql'::TEXT;
    END IF;
  END LOOP;

  -- ── 4. Functions ───────────────────────────────────────────────
  -- These carry every booking rule. Without them the booking route fails with
  -- PGRST202 (function not found), which is what a member sees as
  -- "Something went wrong".
  FOR v_ok, v_enum_type IN
    SELECT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    ), fn
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
  LOOP
    IF v_ok THEN
      RAISE NOTICE 'OK       function %()', v_enum_type;
    ELSE
      RAISE NOTICE 'MISSING  function %()', v_enum_type;
      v_missing := v_missing || ('function ' || v_enum_type)::TEXT;
      v_files   := v_files   || 'supabase/dukes-weekend-functions.sql'::TEXT;
    END IF;
  END LOOP;

  -- ── 5. The room guard trigger ──────────────────────────────────
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'weekend_booking_guard_trigger'
  ) INTO v_ok;

  IF v_ok THEN
    RAISE NOTICE 'OK       trigger weekend_booking_guard_trigger';
  ELSE
    RAISE NOTICE 'MISSING  trigger weekend_booking_guard_trigger';
    v_missing := v_missing || 'room guard trigger'::TEXT;
    v_files   := v_files   || 'supabase/dukes-weekend-functions.sql'::TEXT;
  END IF;

  -- ── 6. Unrelated, but it bites event descriptions ──────────────
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'description_html'
  ) INTO v_ok;

  IF v_ok THEN
    RAISE NOTICE 'OK       events.description_html';
  ELSE
    RAISE NOTICE 'MISSING  events.description_html — event descriptions lose their formatting on save';
    v_missing := v_missing || 'events.description_html'::TEXT;
    v_files   := v_files   || 'supabase/add-event-description-html.sql'::TEXT;
  END IF;

  -- ── Summary ────────────────────────────────────────────────────
  RAISE NOTICE ' ';
  IF array_length(v_missing, 1) IS NULL THEN
    RAISE NOTICE '════ ALL PRESENT — the Dukes Weekend is fully installed ════';
  ELSE
    RAISE NOTICE '════ % ITEM(S) MISSING ════', array_length(v_missing, 1);
    RAISE NOTICE ' ';
    RAISE NOTICE 'Run these, in this order:';
    FOR v_enum_type IN
      SELECT f FROM unnest(v_files) AS f
      GROUP BY f
      ORDER BY CASE f
        WHEN 'supabase/add-dukes-weekend-event-type.sql' THEN 1
        WHEN 'supabase/create-dukes-weekend.sql'         THEN 2
        WHEN 'supabase/dukes-weekend-functions.sql'      THEN 3
        ELSE 4
      END
    LOOP
      RAISE NOTICE '  → %', v_enum_type;
    END LOOP;
  END IF;
  RAISE NOTICE ' ';
END $$;
