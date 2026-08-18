-- =============================================================================
-- THE DUKES' CLUB — Site feedback questionnaire
-- =============================================================================
-- Backs the member-facing questionnaire and the committee's results dashboard:
--
--   /members/feedback   (the four-step wizard, linked from the dashboard card)
--   /admin/feedback     (results: UI/UX scores, feature value, suggestions)
--
-- The questions themselves live in code, not in this database — see
-- lib/site-feedback-questions.ts. Answers are stored as JSONB keyed by question
-- id, so the wording, ordering and length of the survey can change by editing
-- that one file. The contract is: a question id, once used, never changes
-- meaning. To ask the membership again, bump SITE_FEEDBACK_VERSION in that file
-- rather than deleting rows — the unique constraint below is per (member,
-- version), so a bump opens a fresh round without destroying the last one.
--
-- Run this whole script in the Supabase SQL Editor.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: site_feedback_responses
-- ─────────────────────────────────────────────────────────────────────────────
-- One row per member per round. Write-once: there is deliberately no UPDATE and
-- no DELETE policy below, matching the event_feedback_responses convention.

CREATE TABLE IF NOT EXISTS site_feedback_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The FK is added at the bottom pointing at profiles(id) rather than being
  -- declared inline against auth.users(id): PostgREST resolves embeds by
  -- foreign key, and profiles already cascades from auth.users.
  user_id UUID NOT NULL,

  -- Mirrors SITE_FEEDBACK_VERSION in lib/site-feedback-questions.ts. Stored as
  -- text ('2026-08') rather than a counter so the round is self-describing in
  -- the admin round picker.
  questionnaire_version TEXT NOT NULL,

  -- Every answer, keyed by the question ids in lib/site-feedback-questions.ts.
  -- The value shape per question type is documented at the top of that file.
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Promoted out of `answers` purely so the results page can aggregate and sort
  -- the two headline numbers without unpacking JSONB for every row.
  ux_rating SMALLINT CHECK (ux_rating BETWEEN 1 AND 5),
  nps_score SMALLINT CHECK (nps_score BETWEEN 0 AND 10),

  -- The member ticked "don't show my name against my answers". Honoured by the
  -- site_feedback_admin view below, which is the only way an admin can read
  -- these rows — see the note on that view.
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,

  -- Snapshot of where the member stood when they answered. A trainee this round
  -- may be a full member in the next one, and the segment breakdown should
  -- reflect what they were at the time. Retained for anonymous responses too:
  -- grade and region are coarse enough to report on, and they are the whole
  -- point of segmenting. The member-facing copy says so explicitly.
  role_at_submission TEXT,
  region_at_submission TEXT,
  training_stage_at_submission TEXT,

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One response per member per round.
  CONSTRAINT site_feedback_responses_one_per_round
    UNIQUE (user_id, questionnaire_version)
);

-- The results page reads one whole round at a time, newest first. The unique
-- constraint above already indexes user_id as its leading column, so the
-- dashboard's "has this member answered?" lookup needs no extra index.
CREATE INDEX IF NOT EXISTS site_feedback_responses_round_idx
  ON site_feedback_responses (questionnaire_version, submitted_at DESC);

-- FK so PostgREST can resolve profiles:user_id(...) joins, and so ad-hoc joins
-- in the SQL Editor are cheap. Same pattern as event_feedback_responses.
ALTER TABLE site_feedback_responses
  DROP CONSTRAINT IF EXISTS site_feedback_responses_user_id_fkey;
ALTER TABLE site_feedback_responses
  ADD CONSTRAINT site_feedback_responses_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
-- Members insert their own single response and can read it back — that read is
-- what the dashboard card uses to decide whether to still ask. Nobody gets
-- UPDATE or DELETE: the absence of those policies is what makes this
-- write-once. Removing a spam response is a job for the SQL Editor.
--
-- Note what is NOT here: there is no admin SELECT policy on this table.
-- Admins read through the site_feedback_admin view below, which never projects
-- user_id at all. That is what makes the anonymity promise real rather than a
-- client-side `if` over data the browser already received.

ALTER TABLE site_feedback_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_feedback_responses_select_own" ON site_feedback_responses;
DROP POLICY IF EXISTS "site_feedback_responses_insert_own" ON site_feedback_responses;

CREATE POLICY "site_feedback_responses_select_own"
  ON site_feedback_responses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- is_approved_member() as well as the ownership check: middleware already keeps
-- pending members out of /members, this is the belt to that pair of braces.
CREATE POLICY "site_feedback_responses_insert_own"
  ON site_feedback_responses FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_approved_member());

-- ─────────────────────────────────────────────────────────────────────────────
-- THE COMMITTEE'S READ PATH: site_feedback_admin_rows() + site_feedback_admin
-- ─────────────────────────────────────────────────────────────────────────────
-- There is no admin SELECT policy on the table above, so something has to read
-- past RLS on the committee's behalf — and that is exactly what lets the read
-- withhold user_id entirely instead of trusting the browser to hide it.
--
-- That privileged read lives in one SECURITY DEFINER *function*, not in a
-- security-definer view:
--
--   * the function pins its search_path and re-checks is_admin() itself, so the
--     elevated rights are explicit, narrow, and auditable in one place;
--   * the view over it is created WITH (security_invoker = true), so it claims
--     no rights of its own — which is what Supabase's "Security Definer View"
--     advisory (and anyone reading pg_views) wants to see;
--   * PostgREST still sees a plain relation, so the client carries on doing
--     .from('site_feedback_admin').select('*') unchanged.
--
-- A non-admin gets zero rows rather than an error, as before: the results page
-- never renders for them anyway, and an empty read is the quieter failure.
--
-- What must NOT change: do not "simplify" this into a plain security_invoker
-- view over site_feedback_responses plus an admin SELECT policy on the table.
-- That would hand every admin the user_id of every anonymous response.

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
--   -- three columns of interest exist, nothing nullable that shouldn't be
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'site_feedback_responses'
--    ORDER BY ordinal_position;
--
--   -- exactly two policies, neither of them UPDATE or DELETE
--   SELECT policyname, cmd FROM pg_policies
--    WHERE tablename = 'site_feedback_responses';
--
--   -- unique constraint is on the PAIR, not on user_id alone
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid = 'site_feedback_responses'::regclass;
--
--   -- the view claims no rights of its own: expect {security_invoker=true}
--   SELECT relname, reloptions FROM pg_class
--    WHERE relname = 'site_feedback_admin';
--
--   -- the one privileged read: expect prosecdef = true and a pinned
--   -- search_path in proconfig
--   SELECT proname, prosecdef, proconfig FROM pg_proc
--    WHERE proname = 'site_feedback_admin_rows';
--
--   -- and the view still has no user_id column
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'site_feedback_admin'
--    ORDER BY ordinal_position;
--
-- =============================================================================
