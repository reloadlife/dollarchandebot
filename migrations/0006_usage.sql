-- Daily totals only. No chat id, address, or name.
CREATE TABLE IF NOT EXISTS usage_daily (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind)
);
