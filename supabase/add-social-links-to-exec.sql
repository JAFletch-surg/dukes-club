-- Add a JSONB column to store multiple social media links per committee member.
-- Format: [{"platform": "twitter", "url": "https://twitter.com/...", "handle": "@..."}, ...]
-- Supported platforms: twitter, linkedin, instagram, tiktok, youtube, website

ALTER TABLE executive_committee
ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '[]'::jsonb;

-- Migrate existing single social media fields into the new column
UPDATE executive_committee
SET social_links = jsonb_build_array(
  jsonb_build_object(
    'platform',
    CASE
      WHEN social_media_url ILIKE '%twitter%' OR social_media_url ILIKE '%x.com%' THEN 'twitter'
      WHEN social_media_url ILIKE '%linkedin%' THEN 'linkedin'
      WHEN social_media_url ILIKE '%instagram%' THEN 'instagram'
      ELSE 'twitter'
    END,
    'url', social_media_url,
    'handle', social_media_tag
  )
)
WHERE social_media_url IS NOT NULL AND social_media_url <> '';
