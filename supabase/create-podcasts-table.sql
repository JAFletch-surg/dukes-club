-- =============================================================================
-- THE DUKES' CLUB — Podcasts Table
-- =============================================================================
-- Run this in the Supabase SQL Editor to create the podcasts table and enable RLS.
-- Safe to re-run — all statements are idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS podcasts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  body JSONB,
  episode_number INTEGER,
  season_number INTEGER,
  duration_seconds INTEGER DEFAULT 0,
  thumbnail_url TEXT,
  subspecialties TEXT[] DEFAULT '{}',
  is_members_only BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  spotify_url TEXT,
  guest_name TEXT,
  guest_title TEXT
);

-- Ensure newer columns exist (in case table was created with old schema)
ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS spotify_url TEXT;
ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS guest_title TEXT;

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
