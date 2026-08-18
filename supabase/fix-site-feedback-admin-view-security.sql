-- =============================================================================
-- THE DUKES' CLUB — site_feedback_admin: drop the security-definer view
-- =============================================================================
-- Resolves the Supabase advisor finding
--
--   "Security Definer View — public.site_feedback_admin is defined with the
--    SECURITY DEFINER property" (CRITICAL)
--
-- Run this whole script once in the Supabase SQL Editor on any project that
-- already ran supabase/create-site-feedback.sql. That file now creates the
-- shape below directly, so a fresh project does not need this script.
--
-- ─── What was there ──────────────────────────────────────────────────────────
-- site_feedback_admin was a plain (non-invoker) view, so it ran with its
-- owner's rights and read straight past RLS. That was deliberate: admins have
-- no SELECT policy on site_feedback_responses, and reading past RLS through a
-- view that never projects user_id is what makes the "don't show my name"
-- tick-box real rather than a client-side `if`. The guard was the view's own
-- WHERE is_admin().
--
-- ─── Why it still changes ────────────────────────────────────────────────────
-- The privilege was real, it was just implicit — carried by the view's owner,
-- invisible in the view definition, and applying to every table the view
-- touches. Moving it into one SECURITY DEFINER function makes it explicit and
-- bounded: the function pins its search_path (so nothing it calls can be
-- shadowed), re-checks is_admin() itself, and is the only object in the chain
-- holding elevated rights. The view on top is security_invoker, which is what
-- the advisor checks for.
--
-- ─── What does NOT change ────────────────────────────────────────────────────
--   * the columns, their order, and their types — user_id is still absent, and
--     full_name/email are still NULL for anonymous responses;
--   * the client: /admin/feedback keeps doing
--     .from('site_feedback_admin').select('*');
--   * site_feedback_responses: still no admin SELECT policy, still write-once.
--     Do not add one. An admin SELECT policy plus a plain invoker view would
--     hand every admin the user_id of every anonymous response — the exact
--     thing this design exists to prevent.
-- =============================================================================

DROP VIEW IF EXISTS site_feedback_admin;
DROP FUNCTION IF EXISTS site_feedback_admin_rows();

CREATE FUNCTION site_feedback_admin_rows()
RETURNS TABLE (
  id UUID,
  questionnaire_version TEXT,
  answers JSONB,
  ux_rating SMALLINT,
  nps_score SMALLINT,
  is_anonymous BOOLEAN,
  role_at_submission TEXT,
  region_at_submission TEXT,
  training_stage_at_submission TEXT,
  submitted_at TIMESTAMPTZ,
  full_name TEXT,
  email TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
-- pg_temp last so a caller cannot shadow public objects with temporary ones.
SET search_path = public, pg_temp
AS $$
  SELECT
    r.id,
    r.questionnaire_version::text,
    r.answers,
    r.ux_rating,
    r.nps_score,
    r.is_anonymous,
    r.role_at_submission::text,
    r.region_at_submission::text,
    r.training_stage_at_submission::text,
    r.submitted_at,
    (CASE WHEN r.is_anonymous THEN NULL ELSE p.full_name END)::text,
    (CASE WHEN r.is_anonymous THEN NULL ELSE p.email     END)::text
  FROM site_feedback_responses r
  JOIN profiles p ON p.id = r.user_id
  WHERE is_admin();
$$;

-- Only signed-in users may execute it; the is_admin() guard inside does the
-- rest. PUBLIC includes anon, so revoke before granting.
REVOKE ALL ON FUNCTION site_feedback_admin_rows() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION site_feedback_admin_rows() TO authenticated;

CREATE VIEW site_feedback_admin
  WITH (security_invoker = true) AS
  SELECT * FROM site_feedback_admin_rows();

REVOKE ALL ON site_feedback_admin FROM PUBLIC;
GRANT SELECT ON site_feedback_admin TO authenticated;

-- =============================================================================
-- Verification — run these after the script and check the output
-- =============================================================================
--
--   -- the view claims no rights of its own: expect {security_invoker=true}
--   SELECT relname, reloptions FROM pg_class
--    WHERE relname = 'site_feedback_admin';
--
--   -- the one privileged read: expect prosecdef = true and
--   -- proconfig = {search_path=public, pg_temp}
--   SELECT proname, prosecdef, proconfig FROM pg_proc
--    WHERE proname = 'site_feedback_admin_rows';
--
--   -- still no user_id column, same 12 columns as before
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'site_feedback_admin'
--    ORDER BY ordinal_position;
--
--   -- still no admin SELECT policy on the base table: expect SELECT + INSERT
--   -- scoped to the member's own row, and nothing else
--   SELECT policyname, cmd, qual FROM pg_policies
--    WHERE tablename = 'site_feedback_responses';
--
--   -- as an admin, this should return your rounds; as an ordinary member it
--   -- should return zero rows (not an error)
--   SELECT questionnaire_version, count(*) FROM site_feedback_admin
--    GROUP BY 1 ORDER BY 1 DESC;
--
-- Re-run the advisor afterwards: the "Security Definer View" finding for
-- public.site_feedback_admin should be gone.
-- =============================================================================
