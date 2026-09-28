-- A group can ask for a fresh silent post on a fixed interval.
CREATE TABLE IF NOT EXISTS group_feeds (
  chat_id TEXT PRIMARY KEY,
  every_min INTEGER NOT NULL,
  symbol TEXT,
  last_sent_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
