-- =============================================================================
-- THE DUKES' CLUB — Complete Row Level Security (RLS) Policies
-- =============================================================================
-- Run this entire script in the Supabase SQL Editor.
-- It will:
--   1. Create helper functions (is_admin, is_approved_member)
--   2. Enable RLS on all tables
--   3. Drop any existing policies (IF EXISTS)
--   4. Create all new policies grouped by table
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 0: HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Check if current user is an approved admin (admin, super_admin, or editor)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'editor')
      AND approval_status = 'approved'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is an approved member (any role, as long as approved)
CREATE OR REPLACE FUNCTION is_approved_member()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND approval_status = 'approved'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is a participant of a given conversation.
-- SECURITY DEFINER so it bypasses RLS on conversation_participants,
-- preventing infinite recursion when used inside RLS policies.
CREATE OR REPLACE FUNCTION is_conversation_participant(conv_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = conv_id
      AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Find or create a DM conversation between two users.
-- SECURITY DEFINER so it bypasses RLS (enforces its own auth checks).
CREATE OR REPLACE FUNCTION find_or_create_dm(user_a uuid, user_b uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _conv_id uuid;
BEGIN
  -- Caller must be one of the two participants
  IF auth.uid() IS NULL OR (auth.uid() <> user_a AND auth.uid() <> user_b) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  -- Cannot DM yourself
  IF user_a = user_b THEN
    RAISE EXCEPTION 'Cannot create a DM with yourself';
  END IF;

  -- Both users must be approved members
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = user_a AND approval_status = 'approved') THEN
    RAISE EXCEPTION 'User A is not an approved member';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = user_b AND approval_status = 'approved') THEN
    RAISE EXCEPTION 'User B is not an approved member';
  END IF;

  -- Serialize concurrent creation for the same pair
  PERFORM pg_advisory_xact_lock(
    hashtext(LEAST(user_a::text, user_b::text) || GREATEST(user_a::text, user_b::text))
  );

  -- Find existing DM
  SELECT cp1.conversation_id INTO _conv_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2 ON cp2.conversation_id = cp1.conversation_id
  JOIN conversations c ON c.id = cp1.conversation_id
  WHERE cp1.user_id = user_a AND cp2.user_id = user_b AND c.type = 'dm'
  LIMIT 1;

  IF _conv_id IS NOT NULL THEN
    RETURN _conv_id;
  END IF;

  -- Create new DM
  INSERT INTO conversations (type, created_by) VALUES ('dm', auth.uid()) RETURNING id INTO _conv_id;
  INSERT INTO conversation_participants (conversation_id, user_id, role)
  VALUES (_conv_id, user_a, 'owner'), (_conv_id, user_b, 'owner');

  RETURN _conv_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: CORE USER TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: profiles
-- ═══════════════════════════════════════════════════════════════════
-- Any authenticated user can read profiles (needed for directory, message
-- display names, comment author names, etc.). Users can update their own
-- profile. Admins can read and update all profiles.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;

CREATE POLICY "profiles_select_authenticated"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: password_reset_tokens
-- ═══════════════════════════════════════════════════════════════════
-- Only accessed via service_role API routes. No browser access needed.

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "password_reset_tokens_deny_all" ON password_reset_tokens;

-- No policies: service_role bypasses RLS; browser client gets zero access.

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: EVENTS TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: events
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_select_published" ON events;
DROP POLICY IF EXISTS "events_select_admin" ON events;
DROP POLICY IF EXISTS "events_insert_admin" ON events;
DROP POLICY IF EXISTS "events_update_admin" ON events;
DROP POLICY IF EXISTS "events_delete_admin" ON events;

CREATE POLICY "events_select_published"
  ON events FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "events_select_admin"
  ON events FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "events_insert_admin"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "events_update_admin"
  ON events FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "events_delete_admin"
  ON events FOR DELETE
  TO authenticated
  USING (is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: event_faculty
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE event_faculty ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_faculty_select_public" ON event_faculty;
DROP POLICY IF EXISTS "event_faculty_insert_admin" ON event_faculty;
DROP POLICY IF EXISTS "event_faculty_delete_admin" ON event_faculty;

CREATE POLICY "event_faculty_select_public"
  ON event_faculty FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "event_faculty_insert_admin"
  ON event_faculty FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "event_faculty_delete_admin"
  ON event_faculty FOR DELETE
  TO authenticated
  USING (is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: event_bookings
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE event_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_bookings_select_own" ON event_bookings;
DROP POLICY IF EXISTS "event_bookings_select_admin" ON event_bookings;
DROP POLICY IF EXISTS "event_bookings_insert_own" ON event_bookings;
DROP POLICY IF EXISTS "event_bookings_update_admin" ON event_bookings;
DROP POLICY IF EXISTS "event_bookings_delete_admin" ON event_bookings;

CREATE POLICY "event_bookings_select_own"
  ON event_bookings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "event_bookings_select_admin"
  ON event_bookings FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "event_bookings_insert_own"
  ON event_bookings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "event_bookings_update_admin"
  ON event_bookings FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "event_bookings_delete_admin"
  ON event_bookings FOR DELETE
  TO authenticated
  USING (is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: event_feedback_forms
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE event_feedback_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_feedback_forms_select_active" ON event_feedback_forms;
DROP POLICY IF EXISTS "event_feedback_forms_select_admin" ON event_feedback_forms;
DROP POLICY IF EXISTS "event_feedback_forms_insert_admin" ON event_feedback_forms;
DROP POLICY IF EXISTS "event_feedback_forms_update_admin" ON event_feedback_forms;
DROP POLICY IF EXISTS "event_feedback_forms_delete_admin" ON event_feedback_forms;

CREATE POLICY "event_feedback_forms_select_active"
  ON event_feedback_forms FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "event_feedback_forms_select_admin"
  ON event_feedback_forms FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "event_feedback_forms_insert_admin"
  ON event_feedback_forms FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "event_feedback_forms_update_admin"
  ON event_feedback_forms FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "event_feedback_forms_delete_admin"
  ON event_feedback_forms FOR DELETE
  TO authenticated
  USING (is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: event_feedback_responses
-- ═══════════════════════════════════════════════════════════════════
-- BUG FIX: Added admin SELECT policy so admins can view all feedback.

ALTER TABLE event_feedback_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_feedback_responses_select_own" ON event_feedback_responses;
DROP POLICY IF EXISTS "event_feedback_responses_select_admin" ON event_feedback_responses;
DROP POLICY IF EXISTS "event_feedback_responses_insert_own" ON event_feedback_responses;

CREATE POLICY "event_feedback_responses_select_own"
  ON event_feedback_responses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- *** BUG FIX: Admins can read ALL feedback responses ***
CREATE POLICY "event_feedback_responses_select_admin"
  ON event_feedback_responses FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "event_feedback_responses_insert_own"
  ON event_feedback_responses FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- FK so PostgREST can resolve profiles:user_id(...) joins
ALTER TABLE event_feedback_responses
  DROP CONSTRAINT IF EXISTS event_feedback_responses_user_id_fkey;
ALTER TABLE event_feedback_responses
  ADD CONSTRAINT event_feedback_responses_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id);

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: event_certificates
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE event_certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_certificates_select_own" ON event_certificates;
DROP POLICY IF EXISTS "event_certificates_select_admin" ON event_certificates;

CREATE POLICY "event_certificates_select_own"
  ON event_certificates FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "event_certificates_select_admin"
  ON event_certificates FOR SELECT
  TO authenticated
  USING (is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: video_faculty
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE video_faculty ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "video_faculty_select_public" ON video_faculty;
DROP POLICY IF EXISTS "video_faculty_insert_admin" ON video_faculty;
DROP POLICY IF EXISTS "video_faculty_delete_admin" ON video_faculty;

CREATE POLICY "video_faculty_select_public"
  ON video_faculty FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "video_faculty_insert_admin"
  ON video_faculty FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "video_faculty_delete_admin"
  ON video_faculty FOR DELETE
  TO authenticated
  USING (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: CONTENT TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: posts
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_select_published" ON posts;
DROP POLICY IF EXISTS "posts_select_admin" ON posts;
DROP POLICY IF EXISTS "posts_insert_admin" ON posts;
DROP POLICY IF EXISTS "posts_update_admin" ON posts;
DROP POLICY IF EXISTS "posts_delete_admin" ON posts;

CREATE POLICY "posts_select_published"
  ON posts FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "posts_select_admin"
  ON posts FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "posts_insert_admin"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "posts_update_admin"
  ON posts FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "posts_delete_admin"
  ON posts FOR DELETE
  TO authenticated
  USING (is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: videos
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "videos_select_published" ON videos;
DROP POLICY IF EXISTS "videos_select_admin" ON videos;
DROP POLICY IF EXISTS "videos_insert_admin" ON videos;
DROP POLICY IF EXISTS "videos_update_admin" ON videos;
DROP POLICY IF EXISTS "videos_delete_admin" ON videos;

CREATE POLICY "videos_select_published"
  ON videos FOR SELECT
  TO authenticated
  USING (status = 'published' AND is_approved_member());

CREATE POLICY "videos_select_admin"
  ON videos FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "videos_insert_admin"
  ON videos FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "videos_update_admin"
  ON videos FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "videos_delete_admin"
  ON videos FOR DELETE
  TO authenticated
  USING (is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: video_comments
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE video_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "video_comments_select_member" ON video_comments;
DROP POLICY IF EXISTS "video_comments_insert_member" ON video_comments;
DROP POLICY IF EXISTS "video_comments_update_own" ON video_comments;
DROP POLICY IF EXISTS "video_comments_update_admin" ON video_comments;
DROP POLICY IF EXISTS "video_comments_delete_own" ON video_comments;

CREATE POLICY "video_comments_select_member"
  ON video_comments FOR SELECT
  TO authenticated
  USING (is_approved_member());

CREATE POLICY "video_comments_insert_member"
  ON video_comments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_approved_member());

CREATE POLICY "video_comments_update_own"
  ON video_comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "video_comments_update_admin"
  ON video_comments FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "video_comments_delete_own"
  ON video_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: video_comment_likes
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE video_comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "video_comment_likes_select_member" ON video_comment_likes;
DROP POLICY IF EXISTS "video_comment_likes_insert_own" ON video_comment_likes;
DROP POLICY IF EXISTS "video_comment_likes_delete_own" ON video_comment_likes;

CREATE POLICY "video_comment_likes_select_member"
  ON video_comment_likes FOR SELECT
  TO authenticated
  USING (is_approved_member());

CREATE POLICY "video_comment_likes_insert_own"
  ON video_comment_likes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_approved_member());

CREATE POLICY "video_comment_likes_delete_own"
  ON video_comment_likes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: video_watch_progress
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS video_watch_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  watched_seconds INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  last_watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, video_id)
);

ALTER TABLE video_watch_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "video_watch_progress_select_own" ON video_watch_progress;
DROP POLICY IF EXISTS "video_watch_progress_select_admin" ON video_watch_progress;
DROP POLICY IF EXISTS "video_watch_progress_insert_own" ON video_watch_progress;
DROP POLICY IF EXISTS "video_watch_progress_update_own" ON video_watch_progress;

CREATE POLICY "video_watch_progress_select_own"
  ON video_watch_progress FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "video_watch_progress_select_admin"
  ON video_watch_progress FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "video_watch_progress_insert_own"
  ON video_watch_progress FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "video_watch_progress_update_own"
  ON video_watch_progress FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: QUESTIONS / QUIZ TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: questions
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "questions_select_published" ON questions;
DROP POLICY IF EXISTS "questions_select_admin" ON questions;
DROP POLICY IF EXISTS "questions_insert_admin" ON questions;
DROP POLICY IF EXISTS "questions_update_admin" ON questions;
DROP POLICY IF EXISTS "questions_delete_admin" ON questions;

CREATE POLICY "questions_select_published"
  ON questions FOR SELECT
  TO authenticated
  USING (status = 'published' AND is_active = true AND is_approved_member());

CREATE POLICY "questions_select_admin"
  ON questions FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "questions_insert_admin"
  ON questions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "questions_update_admin"
  ON questions FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "questions_delete_admin"
  ON questions FOR DELETE
  TO authenticated
  USING (is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: question_topics
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE question_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "question_topics_select_authenticated" ON question_topics;
DROP POLICY IF EXISTS "question_topics_insert_admin" ON question_topics;
DROP POLICY IF EXISTS "question_topics_update_admin" ON question_topics;
DROP POLICY IF EXISTS "question_topics_delete_admin" ON question_topics;

CREATE POLICY "question_topics_select_authenticated"
  ON question_topics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "question_topics_insert_admin"
  ON question_topics FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "question_topics_update_admin"
  ON question_topics FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "question_topics_delete_admin"
  ON question_topics FOR DELETE
  TO authenticated
  USING (is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: question_attempts
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "question_attempts_select_own" ON question_attempts;
DROP POLICY IF EXISTS "question_attempts_insert_own" ON question_attempts;

CREATE POLICY "question_attempts_select_own"
  ON question_attempts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "question_attempts_insert_own"
  ON question_attempts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: question_sessions
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE question_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "question_sessions_select_own" ON question_sessions;
DROP POLICY IF EXISTS "question_sessions_insert_own" ON question_sessions;

CREATE POLICY "question_sessions_select_own"
  ON question_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "question_sessions_insert_own"
  ON question_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: user_question_stats
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE user_question_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_question_stats_select_own" ON user_question_stats;
DROP POLICY IF EXISTS "user_question_stats_insert_own" ON user_question_stats;
DROP POLICY IF EXISTS "user_question_stats_update_own" ON user_question_stats;

CREATE POLICY "user_question_stats_select_own"
  ON user_question_stats FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_question_stats_insert_own"
  ON user_question_stats FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_question_stats_update_own"
  ON user_question_stats FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: question_flags
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE question_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "question_flags_insert_authenticated" ON question_flags;
DROP POLICY IF EXISTS "question_flags_select_admin" ON question_flags;
DROP POLICY IF EXISTS "question_flags_update_admin" ON question_flags;

CREATE POLICY "question_flags_insert_authenticated"
  ON question_flags FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "question_flags_select_admin"
  ON question_flags FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "question_flags_update_admin"
  ON question_flags FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: MESSAGING TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: conversations
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_select_participant" ON conversations;
DROP POLICY IF EXISTS "conversations_select_channel" ON conversations;
DROP POLICY IF EXISTS "conversations_insert_member" ON conversations;
DROP POLICY IF EXISTS "conversations_update_participant" ON conversations;

-- DMs: only visible to participants
CREATE POLICY "conversations_select_participant"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    is_approved_member()
    AND is_conversation_participant(id)
  );

-- Channels: browsable by any approved member
CREATE POLICY "conversations_select_channel"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    is_approved_member()
    AND type = 'channel'
  );

CREATE POLICY "conversations_insert_member"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (is_approved_member());

CREATE POLICY "conversations_update_participant"
  ON conversations FOR UPDATE
  TO authenticated
  USING (
    is_approved_member()
    AND is_conversation_participant(id)
  )
  WITH CHECK (
    is_approved_member()
    AND is_conversation_participant(id)
  );

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: conversation_participants
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversation_participants_select_member" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_select_own" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_select_co_members" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_insert_member" ON conversation_participants;

-- Allow users to see all participants in conversations they belong to.
-- Uses SECURITY DEFINER helper to avoid infinite recursion.
CREATE POLICY "conversation_participants_select_member"
  ON conversation_participants FOR SELECT
  TO authenticated
  USING (
    is_approved_member()
    AND is_conversation_participant(conversation_id)
  );

CREATE POLICY "conversation_participants_insert_member"
  ON conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (is_approved_member());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: messages
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_participant" ON messages;
DROP POLICY IF EXISTS "messages_insert_participant" ON messages;
DROP POLICY IF EXISTS "messages_update_own" ON messages;

CREATE POLICY "messages_select_participant"
  ON messages FOR SELECT
  TO authenticated
  USING (
    is_approved_member()
    AND is_conversation_participant(conversation_id)
  );

CREATE POLICY "messages_insert_participant"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND is_approved_member()
    AND is_conversation_participant(conversation_id)
  );

CREATE POLICY "messages_update_own"
  ON messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: message_reads
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_reads_select_own" ON message_reads;
DROP POLICY IF EXISTS "message_reads_insert_own" ON message_reads;
DROP POLICY IF EXISTS "message_reads_update_own" ON message_reads;

CREATE POLICY "message_reads_select_own"
  ON message_reads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "message_reads_insert_own"
  ON message_reads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "message_reads_update_own"
  ON message_reads FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6: PEOPLE / DIRECTORY TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: faculty
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "faculty_select_public" ON faculty;
DROP POLICY IF EXISTS "faculty_insert_admin" ON faculty;
DROP POLICY IF EXISTS "faculty_update_admin" ON faculty;
DROP POLICY IF EXISTS "faculty_delete_admin" ON faculty;

CREATE POLICY "faculty_select_public"
  ON faculty FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "faculty_insert_admin"
  ON faculty FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "faculty_update_admin"
  ON faculty FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "faculty_delete_admin"
  ON faculty FOR DELETE
  TO authenticated
  USING (is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: executive_committee
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE executive_committee ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "executive_committee_select_active" ON executive_committee;
DROP POLICY IF EXISTS "executive_committee_select_admin" ON executive_committee;
DROP POLICY IF EXISTS "executive_committee_insert_admin" ON executive_committee;
DROP POLICY IF EXISTS "executive_committee_update_admin" ON executive_committee;
DROP POLICY IF EXISTS "executive_committee_delete_admin" ON executive_committee;

CREATE POLICY "executive_committee_select_active"
  ON executive_committee FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "executive_committee_select_admin"
  ON executive_committee FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "executive_committee_insert_admin"
  ON executive_committee FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "executive_committee_update_admin"
  ON executive_committee FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "executive_committee_delete_admin"
  ON executive_committee FOR DELETE
  TO authenticated
  USING (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7: FELLOWSHIP TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: fellowships
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE fellowships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fellowships_select_member" ON fellowships;
DROP POLICY IF EXISTS "fellowships_select_admin" ON fellowships;
DROP POLICY IF EXISTS "fellowships_insert_admin" ON fellowships;
DROP POLICY IF EXISTS "fellowships_update_admin" ON fellowships;
DROP POLICY IF EXISTS "fellowships_delete_admin" ON fellowships;

CREATE POLICY "fellowships_select_member"
  ON fellowships FOR SELECT
  TO authenticated
  USING (is_approved_member());

CREATE POLICY "fellowships_select_admin"
  ON fellowships FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "fellowships_insert_admin"
  ON fellowships FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "fellowships_update_admin"
  ON fellowships FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "fellowships_delete_admin"
  ON fellowships FOR DELETE
  TO authenticated
  USING (is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: fellowship_institutions
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE fellowship_institutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fellowship_institutions_select_member" ON fellowship_institutions;
DROP POLICY IF EXISTS "fellowship_institutions_insert_admin" ON fellowship_institutions;
DROP POLICY IF EXISTS "fellowship_institutions_delete_admin" ON fellowship_institutions;

CREATE POLICY "fellowship_institutions_select_member"
  ON fellowship_institutions FOR SELECT
  TO authenticated
  USING (is_approved_member());

CREATE POLICY "fellowship_institutions_insert_admin"
  ON fellowship_institutions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "fellowship_institutions_delete_admin"
  ON fellowship_institutions FOR DELETE
  TO authenticated
  USING (is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: fellowship_faculty
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE fellowship_faculty ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fellowship_faculty_select_member" ON fellowship_faculty;
DROP POLICY IF EXISTS "fellowship_faculty_insert_admin" ON fellowship_faculty;
DROP POLICY IF EXISTS "fellowship_faculty_delete_admin" ON fellowship_faculty;

CREATE POLICY "fellowship_faculty_select_member"
  ON fellowship_faculty FOR SELECT
  TO authenticated
  USING (is_approved_member());

CREATE POLICY "fellowship_faculty_insert_admin"
  ON fellowship_faculty FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "fellowship_faculty_delete_admin"
  ON fellowship_faculty FOR DELETE
  TO authenticated
  USING (is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: institutions
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "institutions_select_member" ON institutions;
DROP POLICY IF EXISTS "institutions_insert_admin" ON institutions;
DROP POLICY IF EXISTS "institutions_update_admin" ON institutions;
DROP POLICY IF EXISTS "institutions_delete_admin" ON institutions;

CREATE POLICY "institutions_select_member"
  ON institutions FOR SELECT
  TO authenticated
  USING (is_approved_member());

CREATE POLICY "institutions_insert_admin"
  ON institutions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "institutions_update_admin"
  ON institutions FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "institutions_delete_admin"
  ON institutions FOR DELETE
  TO authenticated
  USING (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 8: ORGANISATION TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: sponsors
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sponsors_select_active" ON sponsors;
DROP POLICY IF EXISTS "sponsors_select_admin" ON sponsors;
DROP POLICY IF EXISTS "sponsors_insert_admin" ON sponsors;
DROP POLICY IF EXISTS "sponsors_update_admin" ON sponsors;
DROP POLICY IF EXISTS "sponsors_delete_admin" ON sponsors;

CREATE POLICY "sponsors_select_active"
  ON sponsors FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "sponsors_select_admin"
  ON sponsors FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "sponsors_insert_admin"
  ON sponsors FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "sponsors_update_admin"
  ON sponsors FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "sponsors_delete_admin"
  ON sponsors FOR DELETE
  TO authenticated
  USING (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 9: CALENDAR TABLE
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: calendar_dates
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE calendar_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_dates_select_public" ON calendar_dates;
DROP POLICY IF EXISTS "calendar_dates_insert_admin" ON calendar_dates;
DROP POLICY IF EXISTS "calendar_dates_update_admin" ON calendar_dates;
DROP POLICY IF EXISTS "calendar_dates_delete_admin" ON calendar_dates;

CREATE POLICY "calendar_dates_select_public"
  ON calendar_dates FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "calendar_dates_insert_admin"
  ON calendar_dates FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "calendar_dates_update_admin"
  ON calendar_dates FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "calendar_dates_delete_admin"
  ON calendar_dates FOR DELETE
  TO authenticated
  USING (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- FUTURE TABLES: media
-- ─────────────────────────────────────────────────────────────────────────────
-- These tables do not exist yet. When you create them, run the policies below.
--
-- ── media (admin-only CRUD for image management) ──
--
-- ALTER TABLE media ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "media_select_admin"  ON media FOR SELECT TO authenticated USING (is_admin());
-- CREATE POLICY "media_insert_admin"  ON media FOR INSERT TO authenticated WITH CHECK (is_admin());
-- CREATE POLICY "media_update_admin"  ON media FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
-- CREATE POLICY "media_delete_admin"  ON media FOR DELETE TO authenticated USING (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- PODCASTS TABLE (published → approved members, admin CRUD)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE podcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "podcasts_select_published" ON podcasts;
DROP POLICY IF EXISTS "podcasts_select_admin" ON podcasts;
DROP POLICY IF EXISTS "podcasts_insert_admin" ON podcasts;
DROP POLICY IF EXISTS "podcasts_update_admin" ON podcasts;
DROP POLICY IF EXISTS "podcasts_delete_admin" ON podcasts;

CREATE POLICY "podcasts_select_published" ON podcasts
  FOR SELECT TO authenticated
  USING (status = 'published' AND is_approved_member());

CREATE POLICY "podcasts_select_admin" ON podcasts
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "podcasts_insert_admin" ON podcasts
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "podcasts_update_admin" ON podcasts
  FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "podcasts_delete_admin" ON podcasts
  FOR DELETE TO authenticated
  USING (is_admin());

-- =============================================================================
-- END OF RLS POLICIES
-- =============================================================================
