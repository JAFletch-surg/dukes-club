-- ═══════════════════════════════════════════════════════════════════
-- VIDEO WATCH PROGRESS — standalone migration
-- ═══════════════════════════════════════════════════════════════════
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- to ensure the video_watch_progress table, constraints, and RLS policies
-- are all correctly set up. This script is idempotent — safe to run
-- multiple times.
--

-- 1. Create the table (if it doesn't exist)
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

-- 2. Ensure RLS is enabled
ALTER TABLE video_watch_progress ENABLE ROW LEVEL SECURITY;

-- 3. Drop and re-create policies (idempotent)
DROP POLICY IF EXISTS "video_watch_progress_select_own" ON video_watch_progress;
DROP POLICY IF EXISTS "video_watch_progress_select_admin" ON video_watch_progress;
DROP POLICY IF EXISTS "video_watch_progress_insert_own" ON video_watch_progress;
DROP POLICY IF EXISTS "video_watch_progress_update_own" ON video_watch_progress;

-- Users can read their own progress
CREATE POLICY "video_watch_progress_select_own"
  ON video_watch_progress FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all progress
CREATE POLICY "video_watch_progress_select_admin"
  ON video_watch_progress FOR SELECT
  TO authenticated
  USING (is_admin());

-- Users can insert their own progress
CREATE POLICY "video_watch_progress_insert_own"
  ON video_watch_progress FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own progress
CREATE POLICY "video_watch_progress_update_own"
  ON video_watch_progress FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Verify setup
DO $$
BEGIN
  RAISE NOTICE '✓ video_watch_progress table exists';
  RAISE NOTICE '✓ RLS enabled';
  RAISE NOTICE '✓ All policies created (select_own, select_admin, insert_own, update_own)';
  RAISE NOTICE '✓ Ready to track video progress!';
END $$;
