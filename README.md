# DollarChande

Free-market IRR/Toman rates → Telegram channel **@AlanDollarChande** + bot **@DollarChandeBot**.

Built to be **cheap as hell** on Cloudflare free tier:

| Piece | Why it's cheap |
|--------|----------------|
| **1 Worker** | No Pages SPA. Cron + webhook + API in one script. |
| **D1** | Only `latest` (1 row/symbol), 48h of 15m ticks, 90d OHLC. Pruned every scrape. |
| **KV** | 10‑minute chart cache (`file_id` preferred). |
| **Queues** | Cron enqueues work; retries without double-cron logic. |
| **No R2 / Browser / AI** | Charts are pure PNG in-worker. No object storage. |
| **No third-party chart CDN** | Zero external chart bill. |

## What it does

**Sources**
- [bonbast.com](https://bonbast.com) — ~30 FX + gold + coins (Toman)
- [Tetherland API](https://service.tetherland.com/api/v5/currencies) — USDT (Toman)

**Channel schedule** (Asia/Tehran)
- Every **~10 minutes** — price list (scrape first, then post; last-cast KV so delayed cron still posts)
- **00:00 sharp** — charts (USD, USDT, EUR, GOLD18, EMAMI) + daily OHLC  
  (grace 00:00–00:09 for late CF cron; once per Tehran day)

**Bot**
- Text: `USD` / `/eur` → 24h chart image + price
- Inline: `@DollarChandeBot USDT` → cached photo if available, else article
- Responses cached **10 minutes** in KV

## Project layout

```
src/
  index.ts           fetch + cron + queue
  jobs.ts            scrape → cast pipeline
  symbols.ts         symbol registry (in code, not DB)
  scrape/            bonbast + tetherland
  db/prices.ts       minimal D1 writes + prune
  cast/messages.ts   channel posts
  telegram/          bot + API client
  lib/chart.ts       pure PNG line chart
  lib/format.ts
migrations/0001_init.sql
```

## Deploy

```bash
bun run deploy
```

That’s it. Tries `wrangler deploy` first; if this host’s CF API RTT trips wrangler’s **10s** connect timeout, falls back to a long-timeout API upload (`scripts/cf-deploy.py`) with the same bindings/secrets/cron. Secrets are kept either way.

Force plain wrangler: `bun run deploy:wrangler`.

## Setup

### 1. Install

```bash
cd DollarChande
bun install
```

### 2. Create Cloudflare resources

```bash
# login once
bunx wrangler login

# D1
bunx wrangler d1 create dollarchande
# paste database_id into wrangler.jsonc → d1_databases[0].database_id

# KV
bunx wrangler kv namespace create CACHE
# paste id into wrangler.jsonc → kv_namespaces[0].id

# Queues
bunx wrangler queues create dollarchande-jobs
bunx wrangler queues create dollarchande-jobs-dlq
```

### 3. Secrets

```bash
bunx wrangler secret put TELEGRAM_BOT_TOKEN
bunx wrangler secret put TELEGRAM_CHANNEL_ID   # e.g. -100xxxxxxxxxx or @AlanDollarChande
bunx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

Bot must be **admin** in the channel (post messages).

### Enable Guest Mode (BotFather)

Required so users can `@DollarChandeBot USD` in **any** chat (bot need not be a member):

1. Open [@BotFather](https://t.me/BotFather) → your bot → **Bot Settings** (Mini App)
2. Enable **Guest Mode**
3. Confirm `getMe` shows `"supports_guest_queries": true`

Webhook already listens for `guest_message` and answers via `answerGuestQuery`.

Local secrets: copy `.dev.vars.example` → `.dev.vars`.

### 4. Migrate + deploy

```bash
bun run db:local    # local D1
bun run db:remote   # production D1
bun run deploy
```

### 5. Point Telegram webhook

```bash
curl -X POST "https://dollarchande.<you>.workers.dev/admin/setup-webhook" \
  -H "x-admin-secret: $TELEGRAM_WEBHOOK_SECRET"
```

### 6. Manual scrape (optional)

```bash
curl -X POST "https://dollarchande.<you>.workers.dev/admin/run?type=scrape_and_cast" \
  -H "x-admin-secret: $TELEGRAM_WEBHOOK_SECRET"
```

## Local dev

```bash
bun run db:local
bun run dev
# cron test: curl http://127.0.0.1:8787/__scheduled
```

## Cost notes (free tier headroom)

- **Writes/day**: ~40 symbols × 4 ops × 96 scrapes ≈ **15k D1 writes** (free = 100k/day)
- **Ticks stored**: ~40 × 192 (48h @ 15m) ≈ **8k rows**
- **Channel posts**: 96 list + ~20 charts/day — well under Telegram limits
- **KV**: chart cache only, 10m TTL

If you ever approach limits: drop non-channel symbols from ticks, or scrape every 30m.

## Symbol cheat-sheet

| ID | Name |
|----|------|
| USD EUR GBP TRY CAD CHF … | FX |
| USDT | Tether (Tetherland) |
| MITHQAL GOLD18 OUNCE | Gold |
| EMAMI AZADI HALF QUARTER GERAMI | Coins |

## License

Private / your use.
