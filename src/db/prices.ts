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

/** Align to 15-minute bucket (unix sec). */
export function align15m(tsSec = Math.floor(Date.now() / 1000)): number {
  return tsSec - (tsSec % 900);
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
  const ts = align15m(now);
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

/** Keep only last 48h of ticks + 90 days of OHLC. */
export async function prune(db: D1Database, now = Math.floor(Date.now() / 1000)): Promise<void> {
  const tickCutoff = now - 48 * 3600;
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
  const from = now - 24 * 3600;
  const { results } = await db
    .prepare(`SELECT ts, price FROM ticks WHERE symbol = ? AND ts >= ? ORDER BY ts ASC`)
    .bind(symbol, from)
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
