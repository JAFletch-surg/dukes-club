-- podcast_faculty junction table
-- Mirrors event_faculty / video_faculty pattern
CREATE TABLE IF NOT EXISTS podcast_faculty (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  podcast_id uuid REFERENCES podcasts(id) ON DELETE CASCADE NOT NULL,
  faculty_id uuid REFERENCES faculty(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'Guest',
  created_at timestamptz DEFAULT now(),
  UNIQUE(podcast_id, faculty_id)
);

ALTER TABLE podcast_faculty ENABLE ROW LEVEL SECURITY;

CREATE POLICY "podcast_faculty_select_public"
  ON podcast_faculty FOR SELECT
  USING (true);

CREATE POLICY "podcast_faculty_insert_admin"
  ON podcast_faculty FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "podcast_faculty_delete_admin"
  ON podcast_faculty FOR DELETE
  USING (is_admin());
