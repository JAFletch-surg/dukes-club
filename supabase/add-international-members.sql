-- ═══════════════════════════════════════════════════════════════════
-- INTERNATIONAL MEMBERS — standalone migration
-- ═══════════════════════════════════════════════════════════════════
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- This script is idempotent — safe to run multiple times.
--
-- Adds the member category collected at registration:
--
--   * member_category — 'uk' for UK/Ireland trainees (the existing population),
--     'international' for members based anywhere else.
--   * country — where an international member is based. UK members leave this
--     null and set region (their deanery) instead.
--   * gmc_number — collected from UK trainees who register with a non-NHS,
--     non-academic email so an admin has something to verify identity against.
--     Auto-approved NHS/academic registrations are not asked for it.
--
-- Existing rows are backfilled to 'uk', which is what every account predating
-- this migration is.
--

-- 1. Columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS member_category TEXT NOT NULL DEFAULT 'uk';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gmc_number TEXT;

-- 2. Only the two categories the registration form offers are valid.
--    Dropped first so re-running after a value change doesn't fail.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_member_category_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_member_category_check
  CHECK (member_category IN ('uk', 'international'));

-- 3. Backfill anything that slipped in as null before the default applied.
UPDATE profiles SET member_category = 'uk' WHERE member_category IS NULL;

-- 4. Indexes for the admin members filters (International / GMC to verify)
--    and the directory's country filter.
CREATE INDEX IF NOT EXISTS profiles_member_category_idx ON profiles (member_category);
CREATE INDEX IF NOT EXISTS profiles_country_idx ON profiles (country);

-- 5. Documentation for anyone reading the schema in the dashboard.
COMMENT ON COLUMN profiles.member_category IS
  'uk = UK/Ireland trainee (picks a deanery in region), international = based overseas (picks a country)';
COMMENT ON COLUMN profiles.country IS
  'Country an international member is based in. Null for UK members.';
COMMENT ON COLUMN profiles.gmc_number IS
  'GMC reference number, collected from UK trainees registering with a non-NHS email so admins can verify identity.';
