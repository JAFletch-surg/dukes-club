-- ═══════════════════════════════════════════════════════════════════
-- event_sponsors junction table
--
-- Attaches sponsors already on the sponsors table to an event, so a
-- course can thank the company backing it without that thanks being
-- typed into the description by hand. Mirrors the event_faculty /
-- podcast_faculty pattern: role is the per-event label ("Course
-- Sponsor", "Supported by"), sort_order fixes the running order.
--
-- Run this before deploying — the admin event form writes to this
-- table on every save. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS event_sponsors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  sponsor_id uuid REFERENCES sponsors(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'Sponsor',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, sponsor_id)
);

CREATE INDEX IF NOT EXISTS event_sponsors_event_id_idx ON event_sponsors(event_id);
CREATE INDEX IF NOT EXISTS event_sponsors_sponsor_id_idx ON event_sponsors(sponsor_id);

COMMENT ON COLUMN event_sponsors.role IS
  'Per-event label shown above the logo — e.g. "Course Sponsor", "Supported by", "Exhibitor".';

ALTER TABLE event_sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_sponsors_select_public" ON event_sponsors;
DROP POLICY IF EXISTS "event_sponsors_insert_admin" ON event_sponsors;
DROP POLICY IF EXISTS "event_sponsors_update_admin" ON event_sponsors;
DROP POLICY IF EXISTS "event_sponsors_delete_admin" ON event_sponsors;

CREATE POLICY "event_sponsors_select_public"
  ON event_sponsors FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "event_sponsors_insert_admin"
  ON event_sponsors FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "event_sponsors_update_admin"
  ON event_sponsors FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "event_sponsors_delete_admin"
  ON event_sponsors FOR DELETE
  TO authenticated
  USING (is_admin());
