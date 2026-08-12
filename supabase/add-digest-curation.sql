-- =============================================================================
-- THE DUKES' CLUB — Round-up digest: per-section curation
-- =============================================================================
-- Lets an admin choose exactly which items go in the next round-up, instead of
-- relying on "whatever is newest". Needed most when a batch of videos is synced
-- at once and the newest three are an arbitrary pick rather than an editorial
-- one.
--
-- The existing digest_rank column already records "chosen, and in what order".
-- What was missing is the ability to say "send only these" — that's the
-- per-section auto-fill switch below.
--
-- Run after add-digest-videos-and-ranking.sql.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: digest_settings
-- ─────────────────────────────────────────────────────────────────────────────
-- Single-row table of round-up-wide settings. The `id` column is a boolean
-- fixed to TRUE, which is the usual trick for enforcing a singleton: a second
-- row would have to reuse the same primary key.
--
-- With auto-fill ON (the default), chosen items lead the section and the rest
-- fills by date, exactly as before. With it OFF, the section contains the
-- chosen items and nothing else.

CREATE TABLE IF NOT EXISTS digest_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  events_autofill BOOLEAN NOT NULL DEFAULT TRUE,
  posts_autofill BOOLEAN NOT NULL DEFAULT TRUE,
  videos_autofill BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the singleton. The sender treats a missing row as "everything on", so
-- this is belt and braces rather than load-bearing.
INSERT INTO digest_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION digest_settings_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS digest_settings_updated_at ON digest_settings;
CREATE TRIGGER digest_settings_updated_at
  BEFORE UPDATE ON digest_settings
  FOR EACH ROW EXECUTE FUNCTION digest_settings_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
-- Admins manage it from the admin panel; the sender reads it with the service
-- role, which bypasses RLS. Members never need to see it.

ALTER TABLE digest_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "digest_settings_select_admin" ON digest_settings;
DROP POLICY IF EXISTS "digest_settings_update_admin" ON digest_settings;

CREATE POLICY "digest_settings_select_admin" ON digest_settings
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "digest_settings_update_admin" ON digest_settings
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Note on the existing digest_rank column
-- ─────────────────────────────────────────────────────────────────────────────
-- No schema change needed, but the meaning is now firmer: a non-NULL
-- digest_rank means "an admin chose this item for the round-up", and such an
-- item is sent to every subscriber of that section regardless of whether they
-- have already seen it, and regardless of whether it still falls inside the
-- 60-day content window. That is what makes it an override.
--
-- The sender fetches chosen rows explicitly rather than relying on the date
-- window, so an older video can be featured without silently dropping out.

COMMENT ON COLUMN videos.digest_rank IS
  'Round-up email: chosen for the next issue, and its position in the section. NULL = not chosen. Chosen items bypass the per-member "already seen" window. Set from Admin → Round-Up Email.';
COMMENT ON COLUMN posts.digest_rank IS
  'Round-up email: chosen for the next issue, and its position in the section. NULL = not chosen. Chosen items bypass the per-member "already seen" window. Set from Admin → Round-Up Email.';
COMMENT ON COLUMN events.digest_rank IS
  'Round-up email: chosen for the next issue, and its position in the section. NULL = not chosen. Chosen items bypass the per-member horizon. Set from Admin → Round-Up Email.';
