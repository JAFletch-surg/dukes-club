-- Junction table linking videos to faculty members (speakers/presenters)
-- Mirrors event_faculty pattern used for events
CREATE TABLE IF NOT EXISTS video_faculty (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'speaker',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(video_id, faculty_id)
);

-- Enable Row Level Security
ALTER TABLE video_faculty ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "video_faculty_select_public" ON video_faculty;
DROP POLICY IF EXISTS "video_faculty_insert_admin" ON video_faculty;
DROP POLICY IF EXISTS "video_faculty_delete_admin" ON video_faculty;

-- Public read — speakers are public info shown alongside videos
CREATE POLICY "video_faculty_select_public"
  ON video_faculty FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only admins can add speakers to videos
CREATE POLICY "video_faculty_insert_admin"
  ON video_faculty FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Only admins can remove speakers from videos
CREATE POLICY "video_faculty_delete_admin"
  ON video_faculty FOR DELETE
  TO authenticated
  USING (is_admin());
