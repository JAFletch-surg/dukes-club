-- =============================================================================
-- THE DUKES' CLUB — Podcasts Table
-- =============================================================================
-- Run this in the Supabase SQL Editor to create the podcasts table and enable RLS.
-- Safe to re-run — all statements are idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS podcasts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  episode_number INTEGER,
  guest_name TEXT,
  guest_title TEXT,
  spotify_url TEXT,
  duration_seconds INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure spotify_url column exists (in case table was created with old schema)
ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS spotify_url TEXT;

-- Clean up old columns if they exist
ALTER TABLE podcasts DROP COLUMN IF EXISTS audio_url;
ALTER TABLE podcasts DROP COLUMN IF EXISTS external_url;

-- RLS Policies (published → approved members, admin CRUD)
ALTER TABLE podcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "podcasts_select_published" ON podcasts;
CREATE POLICY "podcasts_select_published" ON podcasts
  FOR SELECT TO authenticated
  USING (status = 'published' AND is_approved_member());

DROP POLICY IF EXISTS "podcasts_select_admin" ON podcasts;
CREATE POLICY "podcasts_select_admin" ON podcasts
  FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "podcasts_insert_admin" ON podcasts;
CREATE POLICY "podcasts_insert_admin" ON podcasts
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "podcasts_update_admin" ON podcasts;
CREATE POLICY "podcasts_update_admin" ON podcasts
  FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "podcasts_delete_admin" ON podcasts;
CREATE POLICY "podcasts_delete_admin" ON podcasts
  FOR DELETE TO authenticated
  USING (is_admin());
