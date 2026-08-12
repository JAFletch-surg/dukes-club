-- =============================================================================
-- THE DUKES' CLUB — Round-up digest: videos section + admin running order
-- =============================================================================
-- Extends the digest created by create-digest-preferences.sql with:
--   1. A videos section, which members can opt out of like events and news
--   2. Admin-controlled ordering, so the most important item in each section
--      leads it instead of being buried by date
--
-- Run this in the Supabase SQL Editor after create-digest-preferences.sql.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Videos section
-- ─────────────────────────────────────────────────────────────────────────────
-- Defaults to TRUE so existing subscribers start receiving the new section,
-- matching how include_events and include_news behave.

ALTER TABLE digest_preferences
  ADD COLUMN IF NOT EXISTS include_videos BOOLEAN NOT NULL DEFAULT TRUE;

-- Send log gains a video count alongside the existing event and post counts.
ALTER TABLE digest_sends
  ADD COLUMN IF NOT EXISTS video_count INTEGER NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Admin running order
-- ─────────────────────────────────────────────────────────────────────────────
-- digest_rank pins an item to the top of its section in the round-up email:
-- lower numbers lead, and NULL (the default, and the case for almost every row)
-- means "not pinned — position me by date as before".
--
-- Deliberately digest-specific rather than a general-purpose sort_order: the
-- public events and news listings stay chronological, and pinning something for
-- one week's email must not silently reorder the website.

ALTER TABLE events ADD COLUMN IF NOT EXISTS digest_rank INTEGER;
ALTER TABLE posts  ADD COLUMN IF NOT EXISTS digest_rank INTEGER;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS digest_rank INTEGER;

COMMENT ON COLUMN events.digest_rank IS
  'Round-up email running order. Lower numbers lead the section; NULL = order by date. Set from Admin → Round-Up Email.';
COMMENT ON COLUMN posts.digest_rank IS
  'Round-up email running order. Lower numbers lead the section; NULL = order by date. Set from Admin → Round-Up Email.';
COMMENT ON COLUMN videos.digest_rank IS
  'Round-up email running order. Lower numbers lead the section; NULL = order by date. Set from Admin → Round-Up Email.';

-- Partial indexes: pinned rows are a handful out of each table, and the admin
-- panel reads exactly that subset to render the running order.
CREATE INDEX IF NOT EXISTS events_digest_rank_idx ON events (digest_rank) WHERE digest_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS posts_digest_rank_idx  ON posts  (digest_rank) WHERE digest_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS videos_digest_rank_idx ON videos (digest_rank) WHERE digest_rank IS NOT NULL;

-- No new RLS policies needed: digest_rank lives on tables admins can already
-- update, and the digest sender reads them with the service role.
