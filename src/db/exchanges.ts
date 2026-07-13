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

export async function listExchanges(db: D1Database): Promise<ExchangeRow[]> {
  const { results } = await db
    .prepare(
      `SELECT exchange, name, buy, sell, mid, updated_at FROM usdt_exchanges
       ORDER BY mid IS NULL, mid DESC`,
    )
    .all<ExchangeRow>();
  return results ?? [];
}
