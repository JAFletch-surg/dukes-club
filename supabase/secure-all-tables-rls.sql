-- =============================================================================
-- THE DUKES' CLUB — Secure All Tables (Enable RLS Everywhere)
-- =============================================================================
-- Run this in the Supabase SQL Editor to fix the
-- "Table publicly accessible — Row-Level Security is not enabled" alert.
--
-- What this script does:
--   1. Audits every table in the `public` schema for RLS status
--   2. Enables Row Level Security on any table where it isn't already on
--   3. Enables RLS explicitly on every known application table (idempotent)
--   4. Re-audits and reports which tables are now secured
--
-- Safe to re-run at any time.
--
-- Policies themselves live in `rls-policies.sql` — if you haven't run that
-- file in a while, run it AFTER this one to ensure your policies are up to
-- date. Enabling RLS without policies makes a table readable by NO ONE
-- (except service_role), which is the safe default.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Pre-audit: show any public tables currently WITHOUT RLS
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r RECORD;
  unsafe_count INTEGER := 0;
BEGIN
  RAISE NOTICE '─── PRE-AUDIT: tables in public schema without RLS ───';
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND rowsecurity = false
    ORDER BY tablename
  LOOP
    RAISE NOTICE '  ⚠  %', r.tablename;
    unsafe_count := unsafe_count + 1;
  END LOOP;

  IF unsafe_count = 0 THEN
    RAISE NOTICE '  ✓  all public tables already have RLS enabled';
  ELSE
    RAISE NOTICE '  → % table(s) missing RLS — will be fixed below', unsafe_count;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Dynamically enable RLS on EVERY public table
-- ─────────────────────────────────────────────────────────────────────────────
-- This catches any table that may have been created outside of a migration
-- file (e.g. via the Supabase Table Editor) and forgotten.
--
-- Enabling RLS without a matching policy means only the service_role can
-- access the table until policies are added. This is the safe default.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND rowsecurity = false
    ORDER BY tablename
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    RAISE NOTICE '  ✓  enabled RLS on %', r.tablename;
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — Explicit belt-and-braces: enable RLS on every known app table
-- ─────────────────────────────────────────────────────────────────────────────
-- Listed explicitly so that if a table exists but was somehow missed above,
-- this still covers it. Each statement is idempotent.

ALTER TABLE IF EXISTS profiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS password_reset_tokens       ENABLE ROW LEVEL SECURITY;

-- Events
ALTER TABLE IF EXISTS events                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS event_faculty               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS event_bookings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS event_feedback_forms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS event_feedback_responses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS event_certificates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS calendar_dates              ENABLE ROW LEVEL SECURITY;

-- Content
ALTER TABLE IF EXISTS posts                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS videos                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS video_faculty               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS video_comments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS video_comment_likes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS video_watch_progress        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS podcasts                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS podcast_faculty             ENABLE ROW LEVEL SECURITY;

-- FRCS question bank
ALTER TABLE IF EXISTS questions                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS question_topics             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS question_attempts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS question_sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_question_stats         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS question_flags              ENABLE ROW LEVEL SECURITY;

-- Messaging
ALTER TABLE IF EXISTS conversations               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS conversation_participants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS message_reads               ENABLE ROW LEVEL SECURITY;

-- People / directory
ALTER TABLE IF EXISTS faculty                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS executive_committee         ENABLE ROW LEVEL SECURITY;

-- Fellowships
ALTER TABLE IF EXISTS fellowships                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fellowship_institutions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fellowship_faculty          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS institutions                ENABLE ROW LEVEL SECURITY;

-- Sponsors
ALTER TABLE IF EXISTS sponsors                    ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4 — Post-audit: confirm every public table now has RLS
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r RECORD;
  unsafe_count INTEGER := 0;
  total_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '─── POST-AUDIT ───';

  SELECT COUNT(*) INTO total_count
  FROM pg_tables WHERE schemaname = 'public';

  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND rowsecurity = false
    ORDER BY tablename
  LOOP
    RAISE NOTICE '  ✗  STILL UNSAFE: %', r.tablename;
    unsafe_count := unsafe_count + 1;
  END LOOP;

  IF unsafe_count = 0 THEN
    RAISE NOTICE '  ✓  all % public tables have RLS enabled', total_count;
    RAISE NOTICE '';
    RAISE NOTICE 'NEXT STEP: run `rls-policies.sql` to (re)apply all policies.';
  ELSE
    RAISE WARNING '% table(s) still lack RLS — investigate manually', unsafe_count;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5 — Diagnostic view of current RLS status (final SELECT output)
-- ─────────────────────────────────────────────────────────────────────────────
-- This row set appears at the end of the query so you can eyeball every
-- table's RLS status in the Supabase SQL editor result pane.

SELECT
  tablename,
  CASE WHEN rowsecurity THEN '✓ enabled' ELSE '✗ DISABLED' END AS rls_status,
  (
    SELECT COUNT(*)
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename  = t.tablename
  ) AS policy_count
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY rowsecurity ASC, tablename ASC;
