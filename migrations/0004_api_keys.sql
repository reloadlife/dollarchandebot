-- One API key per Telegram chat. Only the hash is stored.
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  chat_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
