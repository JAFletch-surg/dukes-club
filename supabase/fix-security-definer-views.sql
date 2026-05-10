-- =============================================================================
-- THE DUKES' CLUB — Fix SECURITY DEFINER Views
-- =============================================================================
-- Supabase linter flags these three views because they use SECURITY DEFINER,
-- meaning they bypass the querying user's RLS and run with the view owner's
-- permissions instead.
--
-- None of these views are used by the application — they were created directly
-- in the SQL Editor. This script converts them to SECURITY INVOKER so they
-- respect the querying user's Row Level Security policies.
--
-- If a view intentionally needs cross-user access (e.g. the leaderboard),
-- SECURITY INVOKER will restrict it to the current user's data. In that case,
-- use a SECURITY DEFINER *function* with explicit auth checks instead.
--
-- Requires PostgreSQL 15+ (Supabase default).
-- Safe to re-run.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- OPTION A (recommended): Convert to SECURITY INVOKER
-- ─────────────────────────────────────────────────────────────────────────────
-- The views will now respect each user's RLS policies.
-- For user_topic_breakdown this is correct — users only see their own data.
-- For question_bank_leaderboard and event_feedback_summary, this means
-- non-admin users will only see their own rows. If you need aggregate /
-- cross-user data, use Option B (below) instead for those views.

ALTER VIEW IF EXISTS public.user_topic_breakdown
  SET (security_invoker = on);

ALTER VIEW IF EXISTS public.question_bank_leaderboard
  SET (security_invoker = on);

ALTER VIEW IF EXISTS public.event_feedback_summary
  SET (security_invoker = on);


-- ─────────────────────────────────────────────────────────────────────────────
-- OPTION B (alternative): Drop the unused views entirely
-- ─────────────────────────────────────────────────────────────────────────────
-- Uncomment these lines if you'd rather remove the views. The application
-- does not reference them, so nothing will break.

-- DROP VIEW IF EXISTS public.user_topic_breakdown;
-- DROP VIEW IF EXISTS public.question_bank_leaderboard;
-- DROP VIEW IF EXISTS public.event_feedback_summary;


-- ─────────────────────────────────────────────────────────────────────────────
-- Verify: list all views still using SECURITY DEFINER
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
  c.relname AS view_name,
  CASE
    WHEN NOT COALESCE(
      (SELECT option_value::boolean
       FROM pg_options_to_table(c.reloptions)
       WHERE option_name = 'security_invoker'), false)
    THEN '⚠ DEFINER (bypasses RLS)'
    ELSE '✓ INVOKER (respects RLS)'
  END AS security_mode
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
ORDER BY view_name;
