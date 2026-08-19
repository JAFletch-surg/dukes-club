-- ═══════════════════════════════════════════════════════════════════
-- WEBINAR STAGE CONTROLS — host-authoritative layout
-- ═══════════════════════════════════════════════════════════════════
--
-- Run this in the Supabase SQL Editor after create-webinars.sql.
-- Additive and idempotent — safe to run more than once.
--
-- Until now every client picked its own stage layout from whoever happened to
-- be speaking, so during a handover two attendees could genuinely be looking at
-- different people. The host decides instead, and everyone follows the row.
--
--   auto       screen share dominates, else the active speaker leads
--   spotlight  spotlight_identity fills the stage (their slides, if sharing)
--   grid       every publisher gets an equal cell — panel discussions
--
-- spotlight_identity holds a LiveKit participant identity ('u:<uuid>' for a
-- member, 'g:<invite id>' for a guest speaker) — see lib/webinars.ts.

ALTER TABLE webinar_sessions
  ADD COLUMN IF NOT EXISTS stage_mode TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS spotlight_identity TEXT;

-- Added separately so re-running does not trip over an existing constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'webinar_sessions'::regclass
      AND conname = 'webinar_sessions_stage_mode_check'
  ) THEN
    ALTER TABLE webinar_sessions
      ADD CONSTRAINT webinar_sessions_stage_mode_check
      CHECK (stage_mode IN ('auto', 'spotlight', 'grid'));
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'Stage controls added. No dashboard steps needed — webinar_sessions is already replicated.';
END $$;
