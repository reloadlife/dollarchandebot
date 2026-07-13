import type { Env } from "../env";
import { SYMBOLS } from "../symbols";

export interface LatestRow {
  symbol: string;
  price: number;
  prev_price: number | null;
  buy: number | null;
  sell: number | null;
  source: string;
  updated_at: number;
}

export interface QuoteIn {
  symbol: string;
  price: number;
  buy: number | null;
  sell: number | null;
  source: string;
}

/** Align to 5-minute bucket (unix sec). */
export function align5m(tsSec = Math.floor(Date.now() / 1000)): number {
  return tsSec - (tsSec % 300);
}

/**
 * Absolute unix sec of the next :00/:05/:10/… mark.
 * KV requires ≥60s remaining; if closer than that, jump one more bucket.
 */
export function next5mExpiration(nowSec = Math.floor(Date.now() / 1000)): number {
  let next = align5m(nowSec) + 300;
  if (next - nowSec < 60) next += 300;
  return next;
}

/** Seconds until next 5m mark (for Telegram cache_time, min 1). */
export function ttlUntilNext5m(nowSec = Math.floor(Date.now() / 1000)): number {
  return Math.max(1, next5mExpiration(nowSec) - nowSec);
}

export function dayKey(tsSec: number): string {
  return new Date(tsSec * 1000).toISOString().slice(0, 10);
}

/**
 * Upsert latest + one tick + rolling daily OHLC.
 * Batched statements = fewer D1 billable ops.
 */
export async function saveQuotes(db: D1Database, quotes: QuoteIn[], now = Math.floor(Date.now() / 1000)): Promise<void> {
  if (!quotes.length) return;
  const ts = align5m(now);
  const day = dayKey(now);
  const stmts: D1PreparedStatement[] = [];

  for (const q of quotes) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO latest (symbol, price, prev_price, buy, sell, source, updated_at)
           VALUES (?, ?, NULL, ?, ?, ?, ?)
           ON CONFLICT(symbol) DO UPDATE SET
             prev_price = latest.price,
             price = excluded.price,
             buy = excluded.buy,
             sell = excluded.sell,
             source = excluded.source,
             updated_at = excluded.updated_at`,
        )
        .bind(q.symbol, q.price, q.buy, q.sell, q.source, now),
    );

    stmts.push(
      db
        .prepare(
          `INSERT INTO ticks (symbol, ts, price) VALUES (?, ?, ?)
           ON CONFLICT(symbol, ts) DO UPDATE SET price = excluded.price`,
        )
        .bind(q.symbol, ts, q.price),
    );

    stmts.push(
      db
        .prepare(
          `INSERT INTO ohlc_daily (symbol, day, open, high, low, close)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(symbol, day) DO UPDATE SET
             high = MAX(ohlc_daily.high, excluded.high),
             low  = MIN(ohlc_daily.low, excluded.low),
             close = excluded.close`,
        )
        .bind(q.symbol, day, q.price, q.price, q.price, q.price),
    );
  }

  // D1 batch limit ~1000; we do ~40*3 = 120
  await db.batch(stmts);
}

/** Keep last 8d of ticks (for 7d charts) + 90 days of OHLC. */
export async function prune(db: D1Database, now = Math.floor(Date.now() / 1000)): Promise<void> {
  const tickCutoff = now - 8 * 24 * 3600;
  const dayCutoff = dayKey(now - 90 * 86400);
  await db.batch([
    db.prepare(`DELETE FROM ticks WHERE ts < ?`).bind(tickCutoff),
    db.prepare(`DELETE FROM ohlc_daily WHERE day < ?`).bind(dayCutoff),
  ]);
}

export async function getLatest(db: D1Database, symbol: string): Promise<LatestRow | null> {
  return (
    (await db
      .prepare(`SELECT symbol, price, prev_price, buy, sell, source, updated_at FROM latest WHERE symbol = ?`)
      .bind(symbol)
      .first<LatestRow>()) ?? null
  );
}

export async function getAllLatest(db: D1Database): Promise<LatestRow[]> {
  const { results } = await db
    .prepare(
      `SELECT symbol, price, prev_price, buy, sell, source, updated_at FROM latest ORDER BY symbol`,
    )
    .all<LatestRow>();
  return results ?? [];
}

export async function getTicks24h(
  db: D1Database,
  symbol: string,
  now = Math.floor(Date.now() / 1000),
): Promise<Array<{ ts: number; price: number }>> {
  return getTicksSince(db, symbol, now - 24 * 3600);
}

export async function getTicksSince(
  db: D1Database,
  symbol: string,
  fromTs: number,
): Promise<Array<{ ts: number; price: number }>> {
  const { results } = await db
    .prepare(`SELECT ts, price FROM ticks WHERE symbol = ? AND ts >= ? ORDER BY ts ASC`)
    .bind(symbol, fromTs)
    .all<{ ts: number; price: number }>();
  return results ?? [];
}

export async function getOhlcDays(
  db: D1Database,
  symbol: string,
  days = 30,
): Promise<Array<{ day: string; open: number; high: number; low: number; close: number }>> {
  const { results } = await db
    .prepare(
      `SELECT day, open, high, low, close FROM ohlc_daily
       WHERE symbol = ? ORDER BY day DESC LIMIT ?`,
    )
    .bind(symbol, days)
    .all<{ day: string; open: number; high: number; low: number; close: number }>();
  return (results ?? []).reverse();
}

/** Day high/low for "today" (UTC day key used by ohlc_daily), with ticks fallback. */
export async function getDayHighLow(
  db: D1Database,
  symbol: string,
  now = Math.floor(Date.now() / 1000),
): Promise<{ high: number; low: number } | null> {
  const day = dayKey(now);
  const bar = await db
    .prepare(`SELECT high, low FROM ohlc_daily WHERE symbol = ? AND day = ?`)
    .bind(symbol, day)
    .first<{ high: number; low: number }>();
  if (bar && bar.high > 0 && bar.low > 0) {
    return { high: bar.high, low: bar.low };
  }

  // Fallback: max/min of last 24h ticks
  const ticks = await getTicks24h(db, symbol, now);
  if (!ticks.length) return null;
  let high = ticks[0]!.price;
  let low = ticks[0]!.price;
  for (const t of ticks) {
    if (t.price > high) high = t.price;
    if (t.price < low) low = t.price;
  }
  return { high, low };
}

/**
 * Price ~24h ago from ticks (closest sample at or before now-24h; else oldest tick).
 */
export async function getPrice24hAgo(
  db: D1Database,
  symbol: string,
  now = Math.floor(Date.now() / 1000),
): Promise<number | null> {
  const target = now - 24 * 3600;
  // Prefer the last tick at or before target
  const before = await db
    .prepare(
      `SELECT price FROM ticks WHERE symbol = ? AND ts <= ? ORDER BY ts DESC LIMIT 1`,
    )
    .bind(symbol, target)
    .first<{ price: number }>();
  if (before?.price) return before.price;

  // Else earliest tick we have in the 24h window
  const first = await db
    .prepare(
      `SELECT price FROM ticks WHERE symbol = ? AND ts >= ? ORDER BY ts ASC LIMIT 1`,
    )
    .bind(symbol, target)
    .first<{ price: number }>();
  return first?.price ?? null;
}

/** Map scraped source keys → symbol ids and persist. */
export async function ingestScrapes(
  env: Env,
  bonbast: Array<{ sourceKey: string; price: number; buy: number | null; sell: number | null }>,
  tether: Array<{ sourceKey: string; price: number }>,
): Promise<number> {
  const bySourceKey = new Map(SYMBOLS.map((s) => [s.sourceKey.toLowerCase(), s]));
  const quotes: QuoteIn[] = [];

  for (const q of bonbast) {
    const def = bySourceKey.get(q.sourceKey.toLowerCase());
    if (!def || def.source !== "bonbast") continue;
    quotes.push({
      symbol: def.id,
      price: q.price,
      buy: q.buy,
      sell: q.sell,
      source: "bonbast",
    });
  }

  for (const q of tether) {
    const def = bySourceKey.get(q.sourceKey.toLowerCase()) ?? SYMBOLS.find((s) => s.id === q.sourceKey);
    if (!def || def.source !== "tetherland") continue;
    quotes.push({
      symbol: def.id,
      price: q.price,
      buy: null,
      sell: null,
      source: "tetherland",
    });
  }

  await saveQuotes(env.DB, quotes);
  await prune(env.DB);
  return quotes.length;
}
