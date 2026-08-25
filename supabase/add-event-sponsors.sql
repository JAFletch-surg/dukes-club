-- ═══════════════════════════════════════════════════════════════════
-- event_sponsors junction table
--
-- Attaches sponsors already on the sponsors table to an event, so a
-- course can thank the company backing it without that thanks being
-- typed into the description by hand. Mirrors the event_faculty /
-- podcast_faculty pattern: role is the per-event label ("Course
-- Sponsor", "Supported by"), sort_order fixes the running order.
--
-- Written to be additive: some databases already carry an
-- event_sponsors table from an earlier schema, so every step below
-- either creates what is missing or leaves what is already right
-- alone. Existing rows are kept and given the default role.
--
-- Run this before deploying — the admin event form writes to this
-- table on every save. Safe to re-run.
--
-- To see what the table looks like afterwards:
--   select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'event_sponsors'
--   order by ordinal_position;
-- ═══════════════════════════════════════════════════════════════════

-- 1. The table itself, for a database that has never had one.
CREATE TABLE IF NOT EXISTS public.event_sponsors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  sponsor_id uuid REFERENCES sponsors(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. A table left over from an earlier schema has to name the two rows
--    it joins, or nothing below can be trusted to line up.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'event_sponsors' AND column_name = 'event_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'event_sponsors' AND column_name = 'sponsor_id'
  ) THEN
    RAISE EXCEPTION 'public.event_sponsors already exists without event_id / sponsor_id columns. Inspect it with the query at the top of this file and rename or drop it before re-running.';
  END IF;
END $$;

-- 3. The columns this feature adds. Separate from the CREATE above so
--    they land on an existing table too — which is what the first run
--    of this migration tripped over.
ALTER TABLE public.event_sponsors ADD COLUMN IF NOT EXISTS role text DEFAULT 'Sponsor';
ALTER TABLE public.event_sponsors ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
ALTER TABLE public.event_sponsors ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.event_sponsors SET role = 'Sponsor' WHERE role IS NULL;
UPDATE public.event_sponsors SET sort_order = 0 WHERE sort_order IS NULL;

COMMENT ON COLUMN public.event_sponsors.role IS
  'Per-event label shown above the logo — e.g. "Course Sponsor", "Supported by", "Exhibitor".';

-- 4. One row per sponsor per event. Added as a unique index rather than
--    a constraint so it can be created conditionally; skipped when the
--    table already has a unique constraint or index over the same pair.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.event_sponsors'::regclass
      AND i.indisunique
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname)
        FROM pg_attribute a
        WHERE a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
      ) = ARRAY['event_id', 'sponsor_id']
  ) THEN
    -- A table carried over from an earlier schema may hold duplicates,
    -- which would make the index fail; keep the earliest of each pair.
    DELETE FROM public.event_sponsors a
    USING public.event_sponsors b
    WHERE a.ctid > b.ctid
      AND a.event_id = b.event_id
      AND a.sponsor_id = b.sponsor_id;

    CREATE UNIQUE INDEX event_sponsors_event_sponsor_key
      ON public.event_sponsors (event_id, sponsor_id);
  END IF;
END $$;

-- 5. Deleting an event (or a sponsor) has to take its join rows with it.
--    A table carried over from an earlier schema may have a foreign key
--    that restricts instead, which would block the admin's delete button,
--    or none at all. Added NOT VALID so existing rows are not re-checked:
--    the rule binds every row written from here on, and cascades work
--    regardless. Any pre-existing row pointing at a deleted event is
--    reported below rather than quietly removed.
DO $$
DECLARE
  target record;
  existing record;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('event_id', 'events', 'event_sponsors_event_id_fkey'),
      ('sponsor_id', 'sponsors', 'event_sponsors_sponsor_id_fkey')
    ) AS t(col, reftable, conname)
  LOOP
    SELECT c.conname, c.confdeltype INTO existing
    FROM pg_constraint c
    WHERE c.conrelid = 'public.event_sponsors'::regclass
      AND c.contype = 'f'
      AND c.confrelid = ('public.' || target.reftable)::regclass
      AND c.conkey = ARRAY[(
        SELECT a.attnum FROM pg_attribute a
        WHERE a.attrelid = c.conrelid AND a.attname = target.col
      )]::smallint[]
    LIMIT 1;

    -- 'c' is ON DELETE CASCADE; anything else has to be replaced.
    IF existing.conname IS NOT NULL AND existing.confdeltype <> 'c' THEN
      EXECUTE format('ALTER TABLE public.event_sponsors DROP CONSTRAINT %I', existing.conname);
      existing.conname := NULL;
    END IF;

    IF existing.conname IS NULL THEN
      EXECUTE format(
        'ALTER TABLE public.event_sponsors ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON DELETE CASCADE NOT VALID',
        target.conname, target.col, target.reftable
      );

      BEGIN
        EXECUTE format('ALTER TABLE public.event_sponsors VALIDATE CONSTRAINT %I', target.conname);
      EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'event_sponsors holds rows whose % no longer exists; the rule binds new rows only. List them with: select * from event_sponsors es where not exists (select 1 from % t where t.id = es.%);',
          target.col, target.reftable, target.col;
      END;
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS event_sponsors_event_id_idx ON public.event_sponsors(event_id);
CREATE INDEX IF NOT EXISTS event_sponsors_sponsor_id_idx ON public.event_sponsors(sponsor_id);

-- 6. Read by anyone, written by admins — same as event_faculty.
ALTER TABLE public.event_sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_sponsors_select_public" ON public.event_sponsors;
DROP POLICY IF EXISTS "event_sponsors_insert_admin" ON public.event_sponsors;
DROP POLICY IF EXISTS "event_sponsors_update_admin" ON public.event_sponsors;
DROP POLICY IF EXISTS "event_sponsors_delete_admin" ON public.event_sponsors;

CREATE POLICY "event_sponsors_select_public"
  ON public.event_sponsors FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "event_sponsors_insert_admin"
  ON public.event_sponsors FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "event_sponsors_update_admin"
  ON public.event_sponsors FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "event_sponsors_delete_admin"
  ON public.event_sponsors FOR DELETE
  TO authenticated
  USING (is_admin());
