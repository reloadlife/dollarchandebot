/**
 * TGJU market feed — reachable from Cloudflare egress when the exchange APIs
 * are not (200 in ~20ms while tetherland 504s and most venues 403/530).
 *
 * `crypto-tether-irr` is the live USDT quote, in RIAL. Everything else in this
 * project is Toman.
 */

const URL_CALL1 = "https://call1.tgju.org/ajax.json";

/** USDT in free-market Toman. Outside this range the feed is junk, not news. */
const TOMAN_MIN = 50_000;
const TOMAN_MAX = 500_000;

interface TgjuRow {
  p?: string | number;
  ts?: string;
}

/** "1,978,000" (Rial) → 197800 (Toman). */
function rialToToman(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  const toman = Math.round(n / 10);
  return toman >= TOMAN_MIN && toman <= TOMAN_MAX ? toman : null;
}

/** USDT mid in Toman, or null when the feed is unreachable or stale-shaped. */
export async function scrapeTgjuUsdt(): Promise<number | null> {
  const res = await fetch(URL_CALL1, {
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "fa-IR,fa;q=0.9,en;q=0.8",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      referer: "https://www.tgju.org/",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`tgju ${res.status}`);
  }
  const body = (await res.json()) as { current?: Record<string, TgjuRow> } | Record<string, TgjuRow>;
  const cur = (body as { current?: Record<string, TgjuRow> }).current ?? (body as Record<string, TgjuRow>);

  // `usdt-irr` exists but has been frozen since 2020 — do not fall back to it.
  const row = cur["crypto-tether-irr"];
  if (!row) throw new Error("tgju: no crypto-tether-irr");
  const toman = rialToToman(row.p);
  if (toman == null) throw new Error(`tgju: unusable price ${String(row.p)}`);
  return toman;
}
