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
