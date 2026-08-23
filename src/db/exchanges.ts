import type { ExchangeQuote } from "../scrape/exchanges";

export async function saveExchangeQuotes(
  db: D1Database,
  quotes: ExchangeQuote[],
  now = Math.floor(Date.now() / 1000),
): Promise<void> {
  if (!quotes.length) return;
  const stmts = quotes.map((q) =>
    db
      .prepare(
        `INSERT INTO usdt_exchanges (exchange, name, buy, sell, mid, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(exchange) DO UPDATE SET
           name = excluded.name,
           buy = excluded.buy,
           sell = excluded.sell,
           mid = excluded.mid,
           updated_at = excluded.updated_at`,
      )
      .bind(q.exchange, q.name, q.buy, q.sell, q.mid, now),
  );
  await db.batch(stmts);
}

export interface ExchangeRow {
  exchange: string;
  name: string;
  buy: number | null;
  sell: number | null;
  mid: number | null;
  updated_at: number;
}

/**
 * Venues drop in and out (403/530 from CF egress), and a row that stopped
 * updating keeps its last price forever. Serving those alongside live ones
 * invents high/low and arbitrage spreads that do not exist, so stale rows are
 * filtered here — at the single point every caller goes through — rather than
 * in each renderer.
 */
export const EXCHANGE_MAX_AGE_SEC = 30 * 60;

export async function listExchanges(
  db: D1Database,
  maxAgeSec = EXCHANGE_MAX_AGE_SEC,
): Promise<ExchangeRow[]> {
  const cutoff = Math.floor(Date.now() / 1000) - maxAgeSec;
  const { results } = await db
    .prepare(
      `SELECT exchange, name, buy, sell, mid, updated_at FROM usdt_exchanges
       WHERE updated_at >= ?
       ORDER BY mid IS NULL, mid DESC`,
    )
    .bind(cutoff)
    .all<ExchangeRow>();
  return results ?? [];
}
