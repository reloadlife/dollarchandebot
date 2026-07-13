-- Exchange USDT book (latest only — cheap: ~10 rows forever)
CREATE TABLE IF NOT EXISTS usdt_exchanges (
  exchange TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  buy INTEGER,   -- IRT to BUY 1 USDT from exchange (ask)
  sell INTEGER,  -- IRT you get SELLING 1 USDT to exchange (bid)
  mid INTEGER,
  updated_at INTEGER NOT NULL
);

-- Price alerts (one row per alert; prune on delete)
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL, -- above | below | move_pct
  threshold REAL NOT NULL,
  created_at INTEGER NOT NULL,
  last_fired_at INTEGER,
  last_price INTEGER
);

CREATE INDEX IF NOT EXISTS idx_alerts_chat ON alerts (chat_id);
CREATE INDEX IF NOT EXISTS idx_alerts_symbol ON alerts (symbol);

-- Per-user prefs (lang, default fee) — 1 row/user
CREATE TABLE IF NOT EXISTS user_settings (
  chat_id TEXT PRIMARY KEY,
  lang TEXT NOT NULL DEFAULT 'en',
  fee_pct REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
