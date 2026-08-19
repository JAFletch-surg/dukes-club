-- ═══════════════════════════════════════════════════════════════════
-- NATIVE LIVE WEBINARS — standalone migration
-- ═══════════════════════════════════════════════════════════════════
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- Idempotent — safe to run multiple times.
--
-- A "native webinar" is an existing `events` row whose event_type is one of
-- Webinar / Online Lecture / Hybrid and whose stream_type is 'livekit'.
-- Everything below hangs off that event via `webinar_sessions`.
--
-- AFTER RUNNING THIS you must also, in the Supabase Dashboard:
--   1. Database → Replication → enable Realtime on:
--        webinar_sessions, webinar_chat_messages, webinar_questions,
--        webinar_polls, webinar_poll_votes, webinar_resources
--   2. Storage → create a PRIVATE bucket named `webinar-recordings`
--      (must match WEBINAR_S3_BUCKET; the code defaults to that name)
--   3. Storage → S3 settings → generate an access key pair for LiveKit egress
--


-- ═══════════════════════════════════════════════════════════════════
-- 0. ALLOW 'livekit' AS AN events.stream_type
-- ═══════════════════════════════════════════════════════════════════
-- There is no CREATE TABLE for `events` in this repo (it was created in the
-- dashboard), so it may or may not carry a CHECK constraint pinning
-- stream_type to ('zoom','vimeo_live','hybrid'). If it does, an INSERT of
-- 'livekit' fails with a constraint violation. This block finds any such
-- constraint and rewrites it to include 'livekit'.

DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'events'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%stream_type%'
  LOOP
    EXECUTE format('ALTER TABLE events DROP CONSTRAINT %I', con.conname);
    RAISE NOTICE 'Dropped old stream_type constraint: %', con.conname;
  END LOOP;

  ALTER TABLE events ADD CONSTRAINT events_stream_type_check
    CHECK (stream_type IS NULL OR stream_type IN ('zoom','vimeo_live','hybrid','livekit'));
END $$;


-- Speeds up is_webinar_attendee(), which runs once per row per subscriber on
-- every realtime chat/Q&A insert.
CREATE INDEX IF NOT EXISTS event_bookings_event_user_status_idx
  ON event_bookings(event_id, user_id, status);


-- ═══════════════════════════════════════════════════════════════════
-- 1. SESSIONS
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS webinar_sessions (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id           UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  room_name          TEXT NOT NULL UNIQUE,
  status             TEXT NOT NULL DEFAULT 'scheduled'
                       CHECK (status IN ('scheduled','live','ended','processing','published')),
  started_at         TIMESTAMPTZ,
  ended_at           TIMESTAMPTZ,

  -- feature toggles, per session
  chat_enabled       BOOLEAN NOT NULL DEFAULT true,
  qa_enabled         BOOLEAN NOT NULL DEFAULT true,
  polls_enabled      BOOLEAN NOT NULL DEFAULT true,
  recording_enabled  BOOLEAN NOT NULL DEFAULT true,

  -- recording pipeline
  egress_id          TEXT,
  recording_path     TEXT,
  recording_status   TEXT NOT NULL DEFAULT 'none'
                       CHECK (recording_status IN ('none','recording','uploaded','transferring','done','failed')),
  recording_error    TEXT,
  vimeo_id           TEXT,
  recording_video_id UUID REFERENCES videos(id) ON DELETE SET NULL,

  peak_attendees     INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webinar_sessions_event_idx  ON webinar_sessions(event_id);
CREATE INDEX IF NOT EXISTS webinar_sessions_status_idx ON webinar_sessions(status);
CREATE INDEX IF NOT EXISTS webinar_sessions_recording_status_idx ON webinar_sessions(recording_status);


-- ═══════════════════════════════════════════════════════════════════
-- 2. SPEAKERS (magic-link invites — guests need no site account)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS webinar_speakers (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id     UUID NOT NULL REFERENCES webinar_sessions(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  email          TEXT,
  role           TEXT NOT NULL DEFAULT 'speaker'
                   CHECK (role IN ('host','speaker','moderator')),
  -- sha256() of the raw invite token, never the token itself — same approach as
  -- password_reset_tokens. The raw token is shown to the admin once, emailed to
  -- the speaker, and is then unrecoverable; "resend" mints a fresh one.
  token_hash     TEXT NOT NULL UNIQUE,
  faculty_id     UUID REFERENCES faculty(id) ON DELETE SET NULL,
  user_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  invited_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  invite_sent_at TIMESTAMPTZ,
  last_joined_at TIMESTAMPTZ,
  revoked_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webinar_speakers_session_idx ON webinar_speakers(session_id);
CREATE INDEX IF NOT EXISTS webinar_speakers_token_idx   ON webinar_speakers(token_hash);


-- ═══════════════════════════════════════════════════════════════════
-- 3. CHAT
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS webinar_chat_messages (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id   UUID NOT NULL REFERENCES webinar_sessions(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  is_staff     BOOLEAN NOT NULL DEFAULT false,
  body         TEXT NOT NULL,
  is_pinned    BOOLEAN NOT NULL DEFAULT false,
  is_hidden    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webinar_chat_session_idx ON webinar_chat_messages(session_id, created_at);


-- ═══════════════════════════════════════════════════════════════════
-- 4. Q&A
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS webinar_questions (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id             UUID NOT NULL REFERENCES webinar_sessions(id) ON DELETE CASCADE,
  user_id                UUID REFERENCES profiles(id) ON DELETE SET NULL,
  display_name           TEXT NOT NULL,
  body                   TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open','answered','hidden')),
  is_pinned              BOOLEAN NOT NULL DEFAULT false,
  -- admin / speaker answer, optionally carrying a link, PDF or media file
  answer_body            TEXT,
  answer_attachment_url  TEXT,
  answer_attachment_name TEXT,
  answer_attachment_type TEXT CHECK (answer_attachment_type IN ('image','pdf','link','video')),
  answered_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  answered_by_name       TEXT,
  answered_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webinar_questions_session_idx ON webinar_questions(session_id, created_at);


-- ═══════════════════════════════════════════════════════════════════
-- 5. RESOURCES (links / PDFs / media the host pushes to the audience)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS webinar_resources (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id  UUID NOT NULL REFERENCES webinar_sessions(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  url         TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'link'
                CHECK (kind IN ('link','pdf','image','video')),
  posted_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webinar_resources_session_idx ON webinar_resources(session_id, created_at);


-- ═══════════════════════════════════════════════════════════════════
-- 6. POLLS
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS webinar_polls (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      UUID NOT NULL REFERENCES webinar_sessions(id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  -- [{ id: 'a', label: 'Anterior resection' }, ...]
  options         JSONB NOT NULL DEFAULT '[]'::jsonb,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','live','closed')),
  allow_multiple  BOOLEAN NOT NULL DEFAULT false,
  results_visible BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  launched_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webinar_polls_session_idx ON webinar_polls(session_id, sort_order);

CREATE TABLE IF NOT EXISTS webinar_poll_votes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id    UUID NOT NULL REFERENCES webinar_polls(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES webinar_sessions(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  option_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS webinar_poll_votes_poll_idx ON webinar_poll_votes(poll_id);


-- ═══════════════════════════════════════════════════════════════════
-- 7. ATTENDANCE
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS webinar_attendance (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      UUID NOT NULL REFERENCES webinar_sessions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at         TIMESTAMPTZ,
  seconds_watched INTEGER NOT NULL DEFAULT 0,
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS webinar_attendance_session_idx ON webinar_attendance(session_id);


-- ═══════════════════════════════════════════════════════════════════
-- 8. LINK RECORDINGS TO THEIR EVENT
-- ═══════════════════════════════════════════════════════════════════
-- Replaces the fuzzy title-prefix match in app/members/webinars/page.tsx.
-- /api/vimeo/sync preserves this column on update (it is a manual field).

ALTER TABLE videos ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS videos_event_id_idx ON videos(event_id);


-- ═══════════════════════════════════════════════════════════════════
-- 9. HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════

-- Is the current user registered for the event behind this webinar session?
-- Used by the chat / Q&A / poll policies so only people who actually signed
-- up through the event system can take part.
CREATE OR REPLACE FUNCTION is_webinar_attendee(sess_id UUID)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM webinar_sessions ws
    JOIN event_bookings eb ON eb.event_id = ws.event_id
    WHERE ws.id = sess_id
      AND eb.user_id = auth.uid()
      AND eb.status IN ('approved', 'confirmed')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Aggregate poll results without exposing individual votes.
-- SECURITY DEFINER so it can read webinar_poll_votes past RLS; it only ever
-- returns counts, never a user_id.
CREATE OR REPLACE FUNCTION webinar_poll_results(p_poll_id UUID)
RETURNS TABLE (option_id TEXT, votes BIGINT) AS $$
  SELECT opt AS option_id, COUNT(*) AS votes
  FROM webinar_poll_votes v, UNNEST(v.option_ids) AS opt
  WHERE v.poll_id = p_poll_id
  GROUP BY opt;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Total number of people who have voted in a poll (for the "n responses" line).
CREATE OR REPLACE FUNCTION webinar_poll_voter_count(p_poll_id UUID)
RETURNS BIGINT AS $$
  SELECT COUNT(*) FROM webinar_poll_votes WHERE poll_id = p_poll_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION webinar_poll_results(UUID)     TO authenticated;
GRANT EXECUTE ON FUNCTION webinar_poll_voter_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_webinar_attendee(UUID)      TO authenticated;

-- Keep updated_at honest on webinar_sessions
CREATE OR REPLACE FUNCTION touch_webinar_session()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS webinar_sessions_touch ON webinar_sessions;
CREATE TRIGGER webinar_sessions_touch
  BEFORE UPDATE ON webinar_sessions
  FOR EACH ROW EXECUTE FUNCTION touch_webinar_session();


-- ═══════════════════════════════════════════════════════════════════
-- 10. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE webinar_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE webinar_speakers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE webinar_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE webinar_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE webinar_resources     ENABLE ROW LEVEL SECURITY;
ALTER TABLE webinar_polls         ENABLE ROW LEVEL SECURITY;
ALTER TABLE webinar_poll_votes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE webinar_attendance    ENABLE ROW LEVEL SECURITY;

-- ── webinar_sessions ───────────────────────────────────────────────
DROP POLICY IF EXISTS "webinar_sessions_select_member" ON webinar_sessions;
DROP POLICY IF EXISTS "webinar_sessions_select_admin"  ON webinar_sessions;
DROP POLICY IF EXISTS "webinar_sessions_insert_admin"  ON webinar_sessions;
DROP POLICY IF EXISTS "webinar_sessions_update_admin"  ON webinar_sessions;
DROP POLICY IF EXISTS "webinar_sessions_delete_admin"  ON webinar_sessions;

CREATE POLICY "webinar_sessions_select_member" ON webinar_sessions FOR SELECT TO authenticated
  USING (is_approved_member() AND EXISTS (
    SELECT 1 FROM events e WHERE e.id = event_id AND e.status = 'published'
  ));
CREATE POLICY "webinar_sessions_select_admin" ON webinar_sessions FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "webinar_sessions_insert_admin" ON webinar_sessions FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "webinar_sessions_update_admin" ON webinar_sessions FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "webinar_sessions_delete_admin" ON webinar_sessions FOR DELETE TO authenticated USING (is_admin());

-- ── webinar_speakers — ADMIN ONLY, every verb ──────────────────────
-- Only a hash is stored, so an admin listing the speakers cannot recover a
-- link. Guest speakers are authenticated by a service-role API route that
-- hashes the token from the URL and looks it up here.
DROP POLICY IF EXISTS "webinar_speakers_select_admin" ON webinar_speakers;
DROP POLICY IF EXISTS "webinar_speakers_insert_admin" ON webinar_speakers;
DROP POLICY IF EXISTS "webinar_speakers_update_admin" ON webinar_speakers;
DROP POLICY IF EXISTS "webinar_speakers_delete_admin" ON webinar_speakers;

CREATE POLICY "webinar_speakers_select_admin" ON webinar_speakers FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "webinar_speakers_insert_admin" ON webinar_speakers FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "webinar_speakers_update_admin" ON webinar_speakers FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "webinar_speakers_delete_admin" ON webinar_speakers FOR DELETE TO authenticated USING (is_admin());

-- ── webinar_chat_messages ──────────────────────────────────────────
DROP POLICY IF EXISTS "webinar_chat_select_attendee" ON webinar_chat_messages;
DROP POLICY IF EXISTS "webinar_chat_select_admin"    ON webinar_chat_messages;
DROP POLICY IF EXISTS "webinar_chat_insert_own"      ON webinar_chat_messages;
DROP POLICY IF EXISTS "webinar_chat_update_admin"    ON webinar_chat_messages;
DROP POLICY IF EXISTS "webinar_chat_delete_admin"    ON webinar_chat_messages;

CREATE POLICY "webinar_chat_select_attendee" ON webinar_chat_messages FOR SELECT TO authenticated
  USING (is_hidden = false AND is_webinar_attendee(session_id));
CREATE POLICY "webinar_chat_select_admin" ON webinar_chat_messages FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "webinar_chat_insert_own" ON webinar_chat_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (is_admin() OR is_webinar_attendee(session_id)));
-- moderation (pin / hide) is admin-only
CREATE POLICY "webinar_chat_update_admin" ON webinar_chat_messages FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "webinar_chat_delete_admin" ON webinar_chat_messages FOR DELETE TO authenticated USING (is_admin());

-- ── webinar_questions ──────────────────────────────────────────────
DROP POLICY IF EXISTS "webinar_questions_select_attendee" ON webinar_questions;
DROP POLICY IF EXISTS "webinar_questions_select_admin"    ON webinar_questions;
DROP POLICY IF EXISTS "webinar_questions_insert_own"      ON webinar_questions;
DROP POLICY IF EXISTS "webinar_questions_update_admin"    ON webinar_questions;
DROP POLICY IF EXISTS "webinar_questions_delete_admin"    ON webinar_questions;

CREATE POLICY "webinar_questions_select_attendee" ON webinar_questions FOR SELECT TO authenticated
  USING (status <> 'hidden' AND is_webinar_attendee(session_id));
CREATE POLICY "webinar_questions_select_admin" ON webinar_questions FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "webinar_questions_insert_own" ON webinar_questions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (is_admin() OR is_webinar_attendee(session_id)));
-- answering, pinning and hiding are admin-only
CREATE POLICY "webinar_questions_update_admin" ON webinar_questions FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "webinar_questions_delete_admin" ON webinar_questions FOR DELETE TO authenticated USING (is_admin());

-- ── webinar_resources ──────────────────────────────────────────────
DROP POLICY IF EXISTS "webinar_resources_select_attendee" ON webinar_resources;
DROP POLICY IF EXISTS "webinar_resources_select_admin"    ON webinar_resources;
DROP POLICY IF EXISTS "webinar_resources_insert_admin"    ON webinar_resources;
DROP POLICY IF EXISTS "webinar_resources_update_admin"    ON webinar_resources;
DROP POLICY IF EXISTS "webinar_resources_delete_admin"    ON webinar_resources;

CREATE POLICY "webinar_resources_select_attendee" ON webinar_resources FOR SELECT TO authenticated
  USING (is_webinar_attendee(session_id));
CREATE POLICY "webinar_resources_select_admin" ON webinar_resources FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "webinar_resources_insert_admin" ON webinar_resources FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "webinar_resources_update_admin" ON webinar_resources FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "webinar_resources_delete_admin" ON webinar_resources FOR DELETE TO authenticated USING (is_admin());

-- ── webinar_polls ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "webinar_polls_select_attendee" ON webinar_polls;
DROP POLICY IF EXISTS "webinar_polls_select_admin"    ON webinar_polls;
DROP POLICY IF EXISTS "webinar_polls_insert_admin"    ON webinar_polls;
DROP POLICY IF EXISTS "webinar_polls_update_admin"    ON webinar_polls;
DROP POLICY IF EXISTS "webinar_polls_delete_admin"    ON webinar_polls;

-- attendees never see drafts — only polls the host has actually launched
CREATE POLICY "webinar_polls_select_attendee" ON webinar_polls FOR SELECT TO authenticated
  USING (status <> 'draft' AND is_webinar_attendee(session_id));
CREATE POLICY "webinar_polls_select_admin" ON webinar_polls FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "webinar_polls_insert_admin" ON webinar_polls FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "webinar_polls_update_admin" ON webinar_polls FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "webinar_polls_delete_admin" ON webinar_polls FOR DELETE TO authenticated USING (is_admin());

-- ── webinar_poll_votes ─────────────────────────────────────────────
-- Individual votes are private. Tallies come from webinar_poll_results().
DROP POLICY IF EXISTS "webinar_poll_votes_select_own"   ON webinar_poll_votes;
DROP POLICY IF EXISTS "webinar_poll_votes_select_admin" ON webinar_poll_votes;
DROP POLICY IF EXISTS "webinar_poll_votes_insert_own"   ON webinar_poll_votes;
DROP POLICY IF EXISTS "webinar_poll_votes_update_own"   ON webinar_poll_votes;

CREATE POLICY "webinar_poll_votes_select_own" ON webinar_poll_votes FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "webinar_poll_votes_select_admin" ON webinar_poll_votes FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "webinar_poll_votes_insert_own" ON webinar_poll_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (is_admin() OR is_webinar_attendee(session_id)));
CREATE POLICY "webinar_poll_votes_update_own" ON webinar_poll_votes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── webinar_attendance ─────────────────────────────────────────────
DROP POLICY IF EXISTS "webinar_attendance_select_own"   ON webinar_attendance;
DROP POLICY IF EXISTS "webinar_attendance_select_admin" ON webinar_attendance;
DROP POLICY IF EXISTS "webinar_attendance_insert_own"   ON webinar_attendance;
DROP POLICY IF EXISTS "webinar_attendance_update_own"   ON webinar_attendance;

CREATE POLICY "webinar_attendance_select_own" ON webinar_attendance FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "webinar_attendance_select_admin" ON webinar_attendance FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "webinar_attendance_insert_own" ON webinar_attendance FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "webinar_attendance_update_own" ON webinar_attendance FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ═══════════════════════════════════════════════════════════════════
-- 11. VERIFY
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t TEXT;
  missing TEXT := '';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'webinar_sessions','webinar_speakers','webinar_chat_messages','webinar_questions',
    'webinar_resources','webinar_polls','webinar_poll_votes','webinar_attendance'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      missing := missing || t || ' ';
    END IF;
  END LOOP;

  IF missing <> '' THEN
    RAISE EXCEPTION 'Missing tables: %', missing;
  END IF;

  RAISE NOTICE 'Webinar schema OK. Remember the three manual dashboard steps at the top of this file.';
END $$;
