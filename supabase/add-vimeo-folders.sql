-- ═══════════════════════════════════════════════════════════════════
-- VIMEO SYNCED FOLDERS — standalone migration
-- ═══════════════════════════════════════════════════════════════════
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- This script is idempotent — safe to run multiple times.
--
-- Replaces the single VIMEO_FOLDER_ID environment variable with a table of
-- Vimeo folders managed from Admin → Videos → Manage Folders. While this
-- table has no active rows the sync route falls back to VIMEO_FOLDER_ID, so
-- running this migration on its own changes nothing until an admin adds a
-- folder in the UI.
--

-- 1. Create the table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS vimeo_folders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id      TEXT NOT NULL UNIQUE,   -- Vimeo project ID from /me/projects
  name           TEXT NOT NULL,          -- folder name, snapshotted when added
  is_active      BOOLEAN NOT NULL DEFAULT true,
  video_count    INTEGER,                -- last-known count from Vimeo, display only
  last_synced_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Record which folder each video came from.
--    Used for the Folder column in admin and to keep archiving honest.
ALTER TABLE videos ADD COLUMN IF NOT EXISTS vimeo_folder_id TEXT;

CREATE INDEX IF NOT EXISTS videos_vimeo_folder_id_idx ON videos (vimeo_folder_id);

-- 3. Ensure RLS is enabled
ALTER TABLE vimeo_folders ENABLE ROW LEVEL SECURITY;

-- 4. Drop and re-create policies (idempotent)
DROP POLICY IF EXISTS "vimeo_folders_all_admin" ON vimeo_folders;

-- Admins only — members never read this table.
-- Deliberately stricter than the shared is_admin() helper, which also allows
-- 'editor'. This matches the admin/super_admin guard on /api/vimeo/sync.
CREATE POLICY "vimeo_folders_all_admin"
  ON vimeo_folders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
        AND approval_status = 'approved'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
        AND approval_status = 'approved'
    )
  );

-- 5. Verify setup
DO $$
BEGIN
  RAISE NOTICE '✓ vimeo_folders table exists';
  RAISE NOTICE '✓ videos.vimeo_folder_id column exists';
  RAISE NOTICE '✓ RLS enabled with admin-only policy';
  RAISE NOTICE '✓ Add folders in Admin → Videos → Manage Folders';
END $$;
