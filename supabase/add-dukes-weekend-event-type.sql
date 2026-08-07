-- Add 'Dukes Weekend' to the event_type enum
--
-- RUN THIS FIRST, before supabase/create-dukes-weekend.sql. It is a separate
-- file because ALTER TYPE ... ADD VALUE cannot be used by anything in the same
-- transaction that adds it, so it must not share a file with code that reads
-- the new value.
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'Dukes Weekend';

-- PostgREST caches the schema. Without this the admin form keeps rejecting
-- 'Dukes Weekend' even once the database itself accepts it.
NOTIFY pgrst, 'reload schema';
