/**
 * Tetherland public API — USDT (and friends) in Toman.
 * GET https://service.tetherland.com/api/v5/currencies
 */

const URL = "https://service.tetherland.com/api/v5/currencies";

export interface TetherlandQuote {
  sourceKey: string;
  price: number; // Toman
}

interface CoinRow {
  symbol?: string;
  toman_amount?: number;
  price?: string | number;
}

export async function scrapeTetherland(
  symbols: string[] = ["USDT"],
): Promise<TetherlandQuote[]> {
  const res = await fetch(URL, {
    headers: {
      accept: "application/json",
      "user-agent": "DollarChande/0.1 (+cloudflare-worker)",
    },
  });
  if (!res.ok) throw new Error(`tetherland ${res.status}`);
  const body = (await res.json()) as { data?: CoinRow[] } | CoinRow[];
  const rows = Array.isArray(body) ? body : (body.data ?? []);
  const want = new Set(symbols.map((s) => s.toUpperCase()));
  const out: TetherlandQuote[] = [];

  for (const row of rows) {
    const sym = (row.symbol ?? "").toUpperCase();
    if (!want.has(sym)) continue;
    const toman = row.toman_amount;
    if (typeof toman !== "number" || !Number.isFinite(toman) || toman <= 0) {
      continue;
    }
    out.push({ sourceKey: sym, price: Math.round(toman) });
  }

  if (!out.length) throw new Error("tetherland: no matching symbols");
  return out;
}
