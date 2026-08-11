-- =============================================================================
-- THE DUKES' CLUB — Member digest (round-up email) subscriptions
-- =============================================================================
-- Backs the recurring "what's new" email that highlights upcoming events and
-- newly published news/blog posts:
--
--   POST /api/digest/send         (service role — builds and sends the batch)
--   GET  /api/digest/cron         (Vercel cron entry point)
--   GET  /api/digest/preferences  (token-based, logged-out preference centre)
--   /members/profile → Notifications tab (logged-in preference centre)
--
-- Run this whole script in the Supabase SQL Editor.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: digest_preferences
-- ─────────────────────────────────────────────────────────────────────────────
-- One row per member. A member with no row is treated as unsubscribed by the
-- sender, so the trigger + backfill below matter: they are what opts the
-- existing membership in at the default weekly cadence.

CREATE TABLE IF NOT EXISTS digest_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 'never' is the opt-out. Kept as a row rather than a deletion so the
  -- member can turn the digest back on from the same unsubscribe link.
  frequency TEXT NOT NULL DEFAULT 'weekly'
    CHECK (frequency IN ('weekly', 'fortnightly', 'monthly', 'never')),

  -- What they hear about. Both false is equivalent to opting out — the sender
  -- skips anyone with nothing left to send.
  include_events BOOLEAN NOT NULL DEFAULT TRUE,
  include_news BOOLEAN NOT NULL DEFAULT TRUE,

  -- Optional narrowing of the news section to particular post categories.
  -- Empty array means "all categories", which is the default.
  news_categories TEXT[] NOT NULL DEFAULT '{}',

  -- Unguessable token for the one-click unsubscribe / manage-preferences link
  -- in the email footer, which has to work without a login.
  unsubscribe_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),

  -- Drives both "is this member due?" and the news window ("what's new since
  -- you last heard from us?"). NULL means they have never been sent a digest.
  last_sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The sender scans for due subscribers by frequency + last_sent_at.
CREATE INDEX IF NOT EXISTS digest_preferences_due_idx
  ON digest_preferences (frequency, last_sent_at)
  WHERE frequency <> 'never';

-- Footer links resolve a member by token.
CREATE INDEX IF NOT EXISTS digest_preferences_token_idx
  ON digest_preferences (unsubscribe_token);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: digest_sends
-- ─────────────────────────────────────────────────────────────────────────────
-- Audit log of every attempt. Doubles as the safety net against double sends:
-- the sender refuses to send to a member who already received a digest within
-- the last 24 hours, even if last_sent_at somehow failed to update.

CREATE TABLE IF NOT EXISTS digest_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  frequency TEXT,
  event_count INTEGER NOT NULL DEFAULT 0,
  post_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed', 'skipped_empty')),
  provider_message_id TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS digest_sends_user_sent_idx
  ON digest_sends (user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS digest_sends_sent_at_idx
  ON digest_sends (sent_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Keep updated_at honest
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION digest_preferences_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS digest_preferences_updated_at ON digest_preferences;
CREATE TRIGGER digest_preferences_updated_at
  BEFORE UPDATE ON digest_preferences
  FOR EACH ROW EXECUTE FUNCTION digest_preferences_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Give every new member a default subscription
-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER because it fires while the registering user's own INSERT on
-- profiles is running, and that user has no INSERT policy for other rows here.

CREATE OR REPLACE FUNCTION create_default_digest_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO digest_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_create_digest_preferences ON profiles;
CREATE TRIGGER profiles_create_digest_preferences
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_default_digest_preferences();

-- Backfill everyone who registered before this table existed.
INSERT INTO digest_preferences (user_id)
SELECT id FROM profiles
ON CONFLICT (user_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
-- Members read and update their own row from the profile page. Nobody can
-- change someone else's cadence, and nobody but an admin can read the list.
-- The token-based preference centre runs through a service-role API route, so
-- it does not need (and must not have) a browser-visible policy.

ALTER TABLE digest_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "digest_preferences_select_own" ON digest_preferences;
DROP POLICY IF EXISTS "digest_preferences_insert_own" ON digest_preferences;
DROP POLICY IF EXISTS "digest_preferences_update_own" ON digest_preferences;
DROP POLICY IF EXISTS "digest_preferences_select_admin" ON digest_preferences;

CREATE POLICY "digest_preferences_select_own" ON digest_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "digest_preferences_insert_own" ON digest_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "digest_preferences_update_own" ON digest_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "digest_preferences_select_admin" ON digest_preferences
  FOR SELECT TO authenticated
  USING (is_admin());

-- digest_sends is written only by the service-role sender. Admins can read it
-- to see when the last run went out and whether anything failed.

ALTER TABLE digest_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "digest_sends_select_admin" ON digest_sends;

CREATE POLICY "digest_sends_select_admin" ON digest_sends
  FOR SELECT TO authenticated
  USING (is_admin());
