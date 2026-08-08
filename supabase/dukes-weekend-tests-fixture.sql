-- ═══════════════════════════════════════════════════════════════════
-- DUKES WEEKEND — local test fixture
-- ═══════════════════════════════════════════════════════════════════
--
-- LOCAL ONLY. Do not run this against the real database — it creates the
-- tables the Dukes Weekend migrations extend, so on a live database it would
-- collide with the real ones.
--
-- This is a stand-in for the parts of the production schema the weekend
-- touches, so the migrations and supabase/dukes-weekend-tests.sql can be run
-- against a throwaway Postgres:
--
--   createdb dukes_local
--   psql -d dukes_local -v ON_ERROR_STOP=1 \
--     -f supabase/dukes-weekend-tests-fixture.sql \
--     -f supabase/add-dukes-weekend-event-type.sql \
--     -f supabase/create-dukes-weekend.sql \
--     -f supabase/dukes-weekend-functions.sql \
--     -f supabase/dukes-weekend-tests.sql
--
-- WHY THE COLUMN TYPES MATTER
--
-- event_type, the two status columns, and the profile's region and training
-- stage are all ENUMS in production — the same way exec_role is (see
-- add-egs-lead-exec-role.sql). An earlier version of this fixture declared
-- them as TEXT, and every rule check passed against a schema that did not
-- match the real one: the migration had never added 'Dukes Weekend' to the
-- enum, so creating a weekend failed in the admin UI with "invalid input value
-- for enum event_type" while the tests stayed green. It happened a second time
-- with profiles.training_stage, which the fixture still called TEXT: booking
-- failed for every member with "invalid input value for enum training_stage"
-- and the suite was green throughout.
--
-- Keep every one of these as an enum. A fixture that is looser than production
-- does not test anything, it only agrees with you. If you add a column here,
-- check its real type first — \d+ profiles on the live database, not a guess.
--

DO $$ BEGIN CREATE ROLE anon;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA IF NOT EXISTS auth;

-- The tests act as different members by setting a GUC; on Supabase the real
-- auth.uid() reads the request JWT instead.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('test.uid', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- ── Enum types, as production has them ─────────────────────────────
-- 'Dukes Weekend' is deliberately absent: add-dukes-weekend-event-type.sql is
-- what adds it, and the tests prove it must.

CREATE TYPE event_type AS ENUM (
  'Webinar', 'Online Lecture', 'Practical Workshop',
  'In Person Course', 'Hybrid', 'Conference'
);

CREATE TYPE event_status AS ENUM ('draft', 'published', 'archived');

CREATE TYPE access_level AS ENUM ('public', 'registered', 'members_only', 'invite_only');

CREATE TYPE booking_status AS ENUM (
  'pending', 'approved', 'confirmed', 'rejected', 'cancelled', 'waitlisted'
);

CREATE TYPE user_role AS ENUM ('trainee', 'member', 'editor', 'admin', 'super_admin');

CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');

-- The member's own attributes. Labels taken from the pickers on
-- app/members/profile/page.tsx, which is what production is populated from.
CREATE TYPE training_stage AS ENUM (
  'FY1', 'FY2', 'CT1', 'CT2', 'ST3', 'ST4', 'ST5', 'ST6', 'ST7', 'ST8',
  'Post-CCT', 'Consultant', 'SAS', 'Academic', 'Other'
);

CREATE TYPE region AS ENUM (
  'North East', 'North West (Mersey)', 'North West (North Western)',
  'Yorkshire and the Humber', 'East Midlands', 'West Midlands',
  'East of England', 'London', 'Kent, Surrey and Sussex', 'Thames Valley',
  'Wessex', 'South West (Peninsula)', 'South West (Severn)',
  'Scotland', 'Wales', 'Northern Ireland', 'Republic of Ireland'
);

-- ── Tables ─────────────────────────────────────────────────────────

CREATE TABLE profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       TEXT,
  email           TEXT,
  role            user_role,
  approval_status approval_status,
  region          region,
  training_stage  training_stage,
  avatar_url      TEXT,
  acpgbi_number   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE events (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                       TEXT,
  slug                        TEXT,
  starts_at                   TIMESTAMPTZ,
  ends_at                     TIMESTAMPTZ,
  location                    TEXT,
  address                     TEXT,
  description_html            TEXT,
  description_plain           TEXT,
  event_type                  event_type,
  capacity                    INTEGER,
  price_pence                 INTEGER DEFAULT 0,
  member_price_pence          INTEGER,
  status                      event_status DEFAULT 'draft',
  is_featured                 BOOLEAN DEFAULT false,
  booking_url                 TEXT,
  access_level                access_level DEFAULT 'public',
  featured_image_url          TEXT,
  subspecialties              JSONB DEFAULT '[]',
  timetable_data              JSONB,
  published_at                TIMESTAMPTZ,
  applications_enabled        BOOLEAN DEFAULT false,
  eligibility_criteria        TEXT,
  eligibility_training_levels JSONB DEFAULT '[]',
  application_deadline        TIMESTAMPTZ,
  application_questions       JSONB DEFAULT '[]',
  places_available            INTEGER,
  auto_approve                BOOLEAN DEFAULT false,
  confirmation_message        TEXT,
  stream_type                 TEXT,
  zoom_url                    TEXT,
  zoom_meeting_id             TEXT,
  zoom_passcode               TEXT,
  vimeo_live_id               TEXT,
  vimeo_live_embed_url        TEXT
);

CREATE TABLE event_bookings (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                 UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id                  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status                   booking_status DEFAULT 'pending',
  applicant_name           TEXT,
  applicant_email          TEXT,
  applicant_training_level TEXT,
  applicant_hospital       TEXT,
  applicant_deanery        TEXT,
  motivation               TEXT,
  answers                  JSONB,
  admin_notes              TEXT,
  cancelled_at             TIMESTAMPTZ,
  reviewed_at              TIMESTAMPTZ,
  feedback_requested_at    TIMESTAMPTZ,
  feedback_completed_at    TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE TABLE faculty (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      TEXT,
  position_title TEXT,
  hospital       TEXT,
  photo_url      TEXT
);

CREATE TABLE sponsors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT,
  logo_url    TEXT,
  tier        TEXT,
  website_url TEXT,
  description TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT true
);

CREATE TABLE event_feedback_forms (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID REFERENCES events(id) ON DELETE CASCADE,
  title               TEXT,
  description         TEXT,
  questions           JSONB DEFAULT '[]',
  is_active           BOOLEAN DEFAULT false,
  opens_at            TIMESTAMPTZ,
  closes_at           TIMESTAMPTZ,
  certificate_enabled BOOLEAN DEFAULT false,
  certificate_title   TEXT,
  cpd_points          INTEGER
);

CREATE TABLE event_feedback_responses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id        UUID REFERENCES event_feedback_forms(id) ON DELETE CASCADE,
  event_id       UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id     UUID REFERENCES event_bookings(id) ON DELETE SET NULL,
  answers        JSONB,
  overall_rating INTEGER,
  submitted_at   TIMESTAMPTZ DEFAULT now()
);

-- ── Helpers the RLS policies and weekend functions depend on ───────

CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'editor')
      AND approval_status = 'approved'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_approved_member() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND approval_status = 'approved'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DO $$
BEGIN
  RAISE NOTICE '✓ Local fixture ready — enum columns match production';
  RAISE NOTICE '→ Next: add-dukes-weekend-event-type.sql, create-dukes-weekend.sql, dukes-weekend-functions.sql';
END $$;
