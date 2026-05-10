-- =============================================================================
-- THE DUKES' CLUB — Fix All Supabase Security Linter Warnings
-- =============================================================================
-- Run this in the Supabase SQL Editor to resolve all warnings from the
-- security linter (Database > Linting).
--
-- This script is IDEMPOTENT — safe to re-run at any time.
--
-- Addresses:
--   1. function_search_path_mutable  (16 functions)
--   2. anon_security_definer         (10 functions)
--   3. rls_policy_always_true        (39 stale/permissive policies)
--   4. Proper policies for DB-only tables (9 tables)
--   5. public_bucket_allows_listing  (2 buckets)
--   6. extension_in_public           (pg_trgm)
--
-- NOTE: "Leaked Password Protection Disabled" is a dashboard setting —
-- enable it at: Auth > Settings > Password Security
-- =============================================================================


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: Fix function search_path (16 functions)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Without SET search_path, a SECURITY DEFINER function could be tricked into
-- reading from a malicious schema. ALTER FUNCTION ... SET is safe — it doesn't
-- change the function body or permissions.

DO $$ BEGIN RAISE NOTICE '── Section 1: Fixing function search_path ──'; END $$;

ALTER FUNCTION IF EXISTS public.is_admin()
  SET search_path = public;

ALTER FUNCTION IF EXISTS public.is_approved_member()
  SET search_path = public;

ALTER FUNCTION IF EXISTS public.is_conversation_participant(uuid)
  SET search_path = public;

ALTER FUNCTION IF EXISTS public.find_or_create_dm(uuid, uuid)
  SET search_path = public;

ALTER FUNCTION IF EXISTS public.reset_question_progress(uuid)
  SET search_path = public;

ALTER FUNCTION IF EXISTS public.update_event_bookings_updated_at()
  SET search_path = public;

ALTER FUNCTION IF EXISTS public.increment_question_stats(uuid, boolean)
  SET search_path = public;

ALTER FUNCTION IF EXISTS public.get_score_distribution()
  SET search_path = public;

ALTER FUNCTION IF EXISTS public.toggle_comment_like(uuid, uuid)
  SET search_path = public;

ALTER FUNCTION IF EXISTS public.generate_booking_reference()
  SET search_path = public;

ALTER FUNCTION IF EXISTS public.update_updated_at_column()
  SET search_path = public;

ALTER FUNCTION IF EXISTS public.get_unread_counts()
  SET search_path = public;

ALTER FUNCTION IF EXISTS public.update_question_stats()
  SET search_path = public;

ALTER FUNCTION IF EXISTS public.update_event_q_upvote_count()
  SET search_path = public;

ALTER FUNCTION IF EXISTS public.update_updated_at()
  SET search_path = public;

ALTER FUNCTION IF EXISTS public.approve_user(uuid, public.user_role, uuid)
  SET search_path = public;

ALTER FUNCTION IF EXISTS public.reject_user(uuid, uuid)
  SET search_path = public;

ALTER FUNCTION IF EXISTS public.handle_new_user()
  SET search_path = public;

DO $$ BEGIN RAISE NOTICE '  ✓ 18 functions updated with SET search_path = public'; END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: Revoke anon access from SECURITY DEFINER functions
-- ═══════════════════════════════════════════════════════════════════════════════
-- These functions should only be callable by authenticated users (or by
-- triggers running as the function owner). The anon role has no business
-- calling approve_user, reject_user, reset_question_progress, etc.
--
-- RLS policy evaluation uses the function owner's privileges (SECURITY
-- DEFINER), so revoking from anon does NOT break RLS policies that call
-- is_admin() or is_approved_member().

DO $$ BEGIN RAISE NOTICE '── Section 2: Revoking anon access from SECURITY DEFINER functions ──'; END $$;

DO $$
DECLARE
  fn TEXT;
  fns TEXT[] := ARRAY[
    'approve_user(uuid, public.user_role, uuid)',
    'find_or_create_dm(uuid, uuid)',
    'get_score_distribution()',
    'handle_new_user()',
    'increment_question_stats(uuid, boolean)',
    'is_admin()',
    'is_approved_member()',
    'is_conversation_participant(uuid)',
    'reject_user(uuid, uuid)',
    'reset_question_progress(uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon', fn);
      RAISE NOTICE '  ✓ Revoked anon from %', fn;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE '  ⊘ Skipped % (function not found)', fn;
    END;
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: Drop stale "always true" RLS policies
-- ═══════════════════════════════════════════════════════════════════════════════
-- These policies were created via the Supabase dashboard before rls-policies.sql
-- was written. The proper admin-gated policies (using is_admin()) already exist
-- from rls-policies.sql. The stale policies use USING(true) / WITH CHECK(true)
-- which effectively bypasses RLS for everyone.

DO $$ BEGIN RAISE NOTICE '── Section 3: Dropping stale permissive policies ──'; END $$;

-- events
DROP POLICY IF EXISTS "events_delete"  ON events;
DROP POLICY IF EXISTS "events_insert"  ON events;
DROP POLICY IF EXISTS "events_update"  ON events;

-- event_faculty
DROP POLICY IF EXISTS "Admins can manage event_faculty" ON event_faculty;
DROP POLICY IF EXISTS "event_faculty_delete"             ON event_faculty;
DROP POLICY IF EXISTS "event_faculty_insert"             ON event_faculty;
DROP POLICY IF EXISTS "event_faculty_update"             ON event_faculty;

-- event_certificates
DROP POLICY IF EXISTS "Service inserts certificates" ON event_certificates;

-- executive_committee
DROP POLICY IF EXISTS "exec_delete" ON executive_committee;
DROP POLICY IF EXISTS "exec_insert" ON executive_committee;
DROP POLICY IF EXISTS "exec_update" ON executive_committee;

-- faculty
DROP POLICY IF EXISTS "faculty_delete" ON faculty;
DROP POLICY IF EXISTS "faculty_insert" ON faculty;
DROP POLICY IF EXISTS "faculty_update" ON faculty;

-- fellowships
DROP POLICY IF EXISTS "fellowships_delete" ON fellowships;
DROP POLICY IF EXISTS "fellowships_insert" ON fellowships;
DROP POLICY IF EXISTS "fellowships_update" ON fellowships;

-- posts
DROP POLICY IF EXISTS "posts_delete" ON posts;
DROP POLICY IF EXISTS "posts_insert" ON posts;
DROP POLICY IF EXISTS "posts_update" ON posts;

-- sponsors
DROP POLICY IF EXISTS "sponsors_delete" ON sponsors;
DROP POLICY IF EXISTS "sponsors_insert" ON sponsors;
DROP POLICY IF EXISTS "sponsors_update" ON sponsors;

-- videos
DROP POLICY IF EXISTS "videos_delete" ON videos;
DROP POLICY IF EXISTS "videos_insert" ON videos;
DROP POLICY IF EXISTS "videos_update" ON videos;

-- podcasts
DROP POLICY IF EXISTS "podcasts_all" ON podcasts;

-- profiles (stale "profiles_insert" — proper policy is "profiles_insert_own")
DROP POLICY IF EXISTS "profiles_insert" ON profiles;

-- question_flags
DROP POLICY IF EXISTS "question_flags_all" ON question_flags;

-- question_topics
DROP POLICY IF EXISTS "question_topics_all" ON question_topics;

-- questions
DROP POLICY IF EXISTS "questions_all" ON questions;

-- user_question_stats
DROP POLICY IF EXISTS "user_question_stats_all" ON user_question_stats;

DO $$ BEGIN RAISE NOTICE '  ✓ All stale permissive policies dropped'; END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 4: Add proper policies for database-only tables
-- ═══════════════════════════════════════════════════════════════════════════════
-- These tables exist in the database (created via the Supabase dashboard or SQL
-- Editor) but are not covered by rls-policies.sql. Their current policies are
-- overly permissive (USING (true) on ALL operations).

DO $$ BEGIN RAISE NOTICE '── Section 4: Adding proper policies for DB-only tables ──'; END $$;

-- ─── contact_submissions ─────────────────────────────────────────────────────
-- Public contact form — anonymous users can submit, admins can read

ALTER TABLE IF EXISTS contact_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_insert"                ON contact_submissions;
DROP POLICY IF EXISTS "contact_submissions_insert_anon" ON contact_submissions;
DROP POLICY IF EXISTS "contact_submissions_select_admin" ON contact_submissions;

CREATE POLICY "contact_submissions_insert_anon"
  ON contact_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "contact_submissions_select_admin"
  ON contact_submissions FOR SELECT
  TO authenticated
  USING (is_admin());

-- ─── event_invites ───────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS event_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_invites_all"              ON event_invites;
DROP POLICY IF EXISTS "event_invites_select_admin"     ON event_invites;
DROP POLICY IF EXISTS "event_invites_insert_admin"     ON event_invites;
DROP POLICY IF EXISTS "event_invites_update_admin"     ON event_invites;
DROP POLICY IF EXISTS "event_invites_delete_admin"     ON event_invites;

CREATE POLICY "event_invites_select_admin"
  ON event_invites FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "event_invites_insert_admin"
  ON event_invites FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "event_invites_update_admin"
  ON event_invites FOR UPDATE
  TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "event_invites_delete_admin"
  ON event_invites FOR DELETE
  TO authenticated
  USING (is_admin());

-- ─── event_moderators ────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS event_moderators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_moderators_all"            ON event_moderators;
DROP POLICY IF EXISTS "event_moderators_select_admin"   ON event_moderators;
DROP POLICY IF EXISTS "event_moderators_insert_admin"   ON event_moderators;
DROP POLICY IF EXISTS "event_moderators_update_admin"   ON event_moderators;
DROP POLICY IF EXISTS "event_moderators_delete_admin"   ON event_moderators;

CREATE POLICY "event_moderators_select_admin"
  ON event_moderators FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "event_moderators_insert_admin"
  ON event_moderators FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "event_moderators_update_admin"
  ON event_moderators FOR UPDATE
  TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "event_moderators_delete_admin"
  ON event_moderators FOR DELETE
  TO authenticated
  USING (is_admin());

-- ─── event_questions ─────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS event_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_questions_all"             ON event_questions;
DROP POLICY IF EXISTS "event_questions_select_auth"     ON event_questions;
DROP POLICY IF EXISTS "event_questions_insert_auth"     ON event_questions;
DROP POLICY IF EXISTS "event_questions_update_admin"    ON event_questions;
DROP POLICY IF EXISTS "event_questions_delete_admin"    ON event_questions;

CREATE POLICY "event_questions_select_auth"
  ON event_questions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "event_questions_insert_auth"
  ON event_questions FOR INSERT
  TO authenticated
  WITH CHECK (is_approved_member());

CREATE POLICY "event_questions_update_admin"
  ON event_questions FOR UPDATE
  TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "event_questions_delete_admin"
  ON event_questions FOR DELETE
  TO authenticated
  USING (is_admin());

-- ─── event_question_upvotes ──────────────────────────────────────────────────

ALTER TABLE IF EXISTS event_question_upvotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_question_upvotes_all"          ON event_question_upvotes;
DROP POLICY IF EXISTS "event_question_upvotes_select_auth"  ON event_question_upvotes;
DROP POLICY IF EXISTS "event_question_upvotes_insert_auth"  ON event_question_upvotes;
DROP POLICY IF EXISTS "event_question_upvotes_delete_own"   ON event_question_upvotes;

CREATE POLICY "event_question_upvotes_select_auth"
  ON event_question_upvotes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "event_question_upvotes_insert_auth"
  ON event_question_upvotes FOR INSERT
  TO authenticated
  WITH CHECK (is_approved_member());

CREATE POLICY "event_question_upvotes_delete_own"
  ON event_question_upvotes FOR DELETE
  TO authenticated
  USING (is_admin());

-- ─── exam_answers ────────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS exam_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exam_answers_all"            ON exam_answers;
DROP POLICY IF EXISTS "exam_answers_select_admin"   ON exam_answers;
DROP POLICY IF EXISTS "exam_answers_insert_admin"   ON exam_answers;
DROP POLICY IF EXISTS "exam_answers_update_admin"   ON exam_answers;
DROP POLICY IF EXISTS "exam_answers_delete_admin"   ON exam_answers;

CREATE POLICY "exam_answers_select_admin"
  ON exam_answers FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "exam_answers_insert_admin"
  ON exam_answers FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "exam_answers_update_admin"
  ON exam_answers FOR UPDATE
  TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "exam_answers_delete_admin"
  ON exam_answers FOR DELETE
  TO authenticated
  USING (is_admin());

-- ─── exam_sessions ───────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS exam_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exam_sessions_all"            ON exam_sessions;
DROP POLICY IF EXISTS "exam_sessions_select_admin"   ON exam_sessions;
DROP POLICY IF EXISTS "exam_sessions_insert_admin"   ON exam_sessions;
DROP POLICY IF EXISTS "exam_sessions_update_admin"   ON exam_sessions;
DROP POLICY IF EXISTS "exam_sessions_delete_admin"   ON exam_sessions;

CREATE POLICY "exam_sessions_select_admin"
  ON exam_sessions FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "exam_sessions_insert_admin"
  ON exam_sessions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "exam_sessions_update_admin"
  ON exam_sessions FOR UPDATE
  TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "exam_sessions_delete_admin"
  ON exam_sessions FOR DELETE
  TO authenticated
  USING (is_admin());

-- ─── site_settings ───────────────────────────────────────────────────────────
-- Public can read settings (e.g. feature flags), only admins can modify

ALTER TABLE IF EXISTS site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_insert"             ON site_settings;
DROP POLICY IF EXISTS "settings_update"             ON site_settings;
DROP POLICY IF EXISTS "site_settings_select_public" ON site_settings;
DROP POLICY IF EXISTS "site_settings_insert_admin"  ON site_settings;
DROP POLICY IF EXISTS "site_settings_update_admin"  ON site_settings;

CREATE POLICY "site_settings_select_public"
  ON site_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "site_settings_insert_admin"
  ON site_settings FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "site_settings_update_admin"
  ON site_settings FOR UPDATE
  TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- ─── user_topic_stats ────────────────────────────────────────────────────────
-- Users can see and upsert their own stats; admins can see all

ALTER TABLE IF EXISTS user_topic_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_topic_stats_all"          ON user_topic_stats;
DROP POLICY IF EXISTS "user_topic_stats_select_own"   ON user_topic_stats;
DROP POLICY IF EXISTS "user_topic_stats_insert_own"   ON user_topic_stats;
DROP POLICY IF EXISTS "user_topic_stats_update_own"   ON user_topic_stats;
DROP POLICY IF EXISTS "user_topic_stats_select_admin" ON user_topic_stats;

CREATE POLICY "user_topic_stats_select_own"
  ON user_topic_stats FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_topic_stats_insert_own"
  ON user_topic_stats FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_topic_stats_update_own"
  ON user_topic_stats FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_topic_stats_select_admin"
  ON user_topic_stats FOR SELECT
  TO authenticated
  USING (is_admin());

DO $$ BEGIN RAISE NOTICE '  ✓ Proper policies added for 9 database-only tables'; END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 5: Fix storage bucket listing policies
-- ═══════════════════════════════════════════════════════════════════════════════
-- Public buckets serve files by direct URL — they don't need a SELECT policy
-- on storage.objects for that. The broad SELECT policies let anyone LIST all
-- files in the bucket, which is unnecessary and exposes the file inventory.

DO $$ BEGIN RAISE NOTICE '── Section 5: Fixing storage bucket listing policies ──'; END $$;

DROP POLICY IF EXISTS "Media: public read"           ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view sponsor logos" ON storage.objects;

DO $$ BEGIN RAISE NOTICE '  ✓ Broad SELECT policies dropped from media and sponsor-logos buckets'; END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 6: Move pg_trgm extension out of public schema
-- ═══════════════════════════════════════════════════════════════════════════════
-- Extensions in the public schema are accessible to all roles. Moving pg_trgm
-- to the extensions schema limits its surface area.

DO $$ BEGIN RAISE NOTICE '── Section 6: Moving pg_trgm to extensions schema ──'; END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension
    WHERE extname = 'pg_trgm'
      AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
    RAISE NOTICE '  ✓ pg_trgm moved to extensions schema';
  ELSE
    RAISE NOTICE '  ⊘ pg_trgm not in public schema (already moved or not installed)';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- FINAL SUMMARY
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE '  Security hardening complete!';
  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  ✓ 18 functions: search_path pinned to public';
  RAISE NOTICE '  ✓ 10 functions: anon execute revoked';
  RAISE NOTICE '  ✓ ~35 stale permissive policies dropped';
  RAISE NOTICE '  ✓ 9 tables: proper RLS policies added';
  RAISE NOTICE '  ✓ 2 buckets: listing policies removed';
  RAISE NOTICE '  ✓ pg_trgm: moved to extensions schema';
  RAISE NOTICE '';
  RAISE NOTICE '  MANUAL ACTION REQUIRED:';
  RAISE NOTICE '  → Enable "Leaked Password Protection" in Supabase';
  RAISE NOTICE '    Dashboard → Auth → Settings → Password Security';
  RAISE NOTICE '';
  RAISE NOTICE '  Re-run the linter at Database → Linting to verify.';
  RAISE NOTICE '══════════════════════════════════════════════════════';
END $$;
