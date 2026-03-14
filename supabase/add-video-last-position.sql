-- Add last_position column to video_watch_progress
-- Separates resume position from actual watched time:
--   watched_seconds = actual seconds of video content watched (via Vimeo getPlayed())
--   last_position   = playback position for resume-from-where-you-left-off

ALTER TABLE video_watch_progress
  ADD COLUMN IF NOT EXISTS last_position INTEGER NOT NULL DEFAULT 0;

-- Seed last_position from existing watched_seconds (which were positions, not watch time)
UPDATE video_watch_progress SET last_position = watched_seconds;
