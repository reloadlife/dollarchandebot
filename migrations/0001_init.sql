-- Minimal schema. Aim: <1MB forever on free D1.
-- ticks: ~40 symbols × 96 samples/day × 2 days ≈ 7.7k rows
-- ohlc:  ~40 symbols × 90 days ≈ 3.6k rows
-- latest: 1 row per symbol

CREATE TABLE IF NOT EXISTS latest (
  symbol TEXT PRIMARY KEY,
  price INTEGER NOT NULL,
  prev_price INTEGER,
  buy INTEGER,
  sell INTEGER,
  source TEXT NOT NULL DEFAULT 'bonbast',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ticks (
  symbol TEXT NOT NULL,
  ts INTEGER NOT NULL,
  price INTEGER NOT NULL,
  PRIMARY KEY (symbol, ts)
);

CREATE INDEX IF NOT EXISTS idx_ticks_ts ON ticks (ts);

CREATE TABLE IF NOT EXISTS ohlc_daily (
  symbol TEXT NOT NULL,
  day TEXT NOT NULL,
  open INTEGER NOT NULL,
  high INTEGER NOT NULL,
  low INTEGER NOT NULL,
  close INTEGER NOT NULL,
  PRIMARY KEY (symbol, day)
);

CREATE INDEX IF NOT EXISTS idx_ohlc_day ON ohlc_daily (day);
