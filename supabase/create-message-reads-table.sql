-- Create the message_reads table for tracking which messages each user has read
-- This table is required by the messaging system to track unread counts

CREATE TABLE IF NOT EXISTS message_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Enable RLS
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

-- Users can only see their own read receipts
DROP POLICY IF EXISTS "message_reads_select_own" ON message_reads;
CREATE POLICY "message_reads_select_own"
  ON message_reads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can only insert their own read receipts
DROP POLICY IF EXISTS "message_reads_insert_own" ON message_reads;
CREATE POLICY "message_reads_insert_own"
  ON message_reads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can only update their own read receipts
DROP POLICY IF EXISTS "message_reads_update_own" ON message_reads;
CREATE POLICY "message_reads_update_own"
  ON message_reads FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
