-- Create the password_reset_tokens table used by the custom password reset flow.
-- Written to and read from exclusively by the service-role API routes:
--   POST /api/auth/forgot-password  (insert)
--   POST /api/auth/reset-password   (select / update / delete)
--
-- rls-policies.sql enables RLS on this table but never created it, so run this
-- first on any environment where the reset email silently fails to send.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Token lookup on redemption, and per-user cleanup when a new link is issued.
CREATE INDEX IF NOT EXISTS password_reset_tokens_token_hash_idx
  ON password_reset_tokens (token_hash);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx
  ON password_reset_tokens (user_id);

-- Only accessed via service_role API routes. No browser access needed:
-- service_role bypasses RLS, and with no policies the browser client gets
-- zero access.
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- The forgot-password route looks members up by profiles.email, so that
-- lookup needs to be indexed and case-insensitive.
CREATE INDEX IF NOT EXISTS profiles_email_lower_idx
  ON profiles (lower(email));
