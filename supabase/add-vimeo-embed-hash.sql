-- Add vimeo_embed_hash column to videos table
-- Required for embedding unlisted/private Vimeo videos (prevents 406 errors)
ALTER TABLE videos ADD COLUMN IF NOT EXISTS vimeo_embed_hash text;
