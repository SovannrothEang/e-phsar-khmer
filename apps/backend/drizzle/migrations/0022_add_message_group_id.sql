-- Add nullable group_id to messages for linking related images.
ALTER TABLE chat.messages ADD COLUMN group_id uuid;

-- Index for fetching all messages in a group (e.g. rendering an image grid).
CREATE INDEX messages_group_id_idx ON chat.messages (group_id) WHERE group_id IS NOT NULL;
