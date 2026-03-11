-- =============================================================================
-- THE DUKES' CLUB — Podcasts Table
-- =============================================================================
-- Run this in the Supabase SQL Editor to create the podcasts table and enable RLS.
-- =============================================================================

CREATE TABLE podcasts (
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

-- RLS Policies (published → approved members, admin CRUD)
ALTER TABLE podcasts ENABLE ROW LEVEL SECURITY;

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
