/**
 * TGJU free-market board. One keyless JSON, reachable from Cloudflare egress.
 * `current[key].p` is Rial except `ons`, which is the gold ounce in USD.
 *
 * Do not read `usdt-irr` (frozen since 2020). Live tether is `crypto-tether-irr`.
 * Do not read `ice_*` or the per-shop `*_sell` rows; those are other boards and
 * often a day behind the canonical `price_*` / coin keys.
 */

import { dropUnitErrors, single, type BoardQuote } from "./board";

const URL_CALL1 = "https://call1.tgju.org/ajax.json";

/** USDT in free-market toman. Outside this range the tether row is junk, not news. */
const USDT_MIN = 50_000;
const USDT_MAX = 500_000;

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

interface TgjuRow {
  p?: string | number;
  ts?: string;
}

type Scale = "rial" | "usd" | "jpy100" | "amd1" | "iqd1";

/**
 * How the raw `p` becomes this project's unit.
 * - rial: ÷10 → toman
 * - usd: ounce, already dollars. Do not ÷10.
 * - jpy100: raw is 100 yen in rial. ÷100 → toman for 10 yen.
 * - amd1: raw rial for 1 dram equals toman for 10 dram, so the digits stay.
 * - iqd1: raw is 1 dinar in rial. ×10 → toman for 100 dinar.
 */
const ROWS: Array<{ key: string; sourceKey: string; scale: Scale }> = [
  { key: "price_dollar_rl", sourceKey: "usd", scale: "rial" },
  { key: "price_eur", sourceKey: "eur", scale: "rial" },
  { key: "price_gbp", sourceKey: "gbp", scale: "rial" },
  { key: "price_chf", sourceKey: "chf", scale: "rial" },
  { key: "price_cad", sourceKey: "cad", scale: "rial" },
  { key: "price_aud", sourceKey: "aud", scale: "rial" },
  { key: "price_try", sourceKey: "try", scale: "rial" },
  { key: "price_aed", sourceKey: "aed", scale: "rial" },
  { key: "price_cny", sourceKey: "cny", scale: "rial" },
  { key: "price_jpy", sourceKey: "jpy", scale: "jpy100" },
  { key: "price_sek", sourceKey: "sek", scale: "rial" },
  { key: "price_nok", sourceKey: "nok", scale: "rial" },
  { key: "price_dkk", sourceKey: "dkk", scale: "rial" },
  { key: "price_rub", sourceKey: "rub", scale: "rial" },
  { key: "price_thb", sourceKey: "thb", scale: "rial" },
  { key: "price_sgd", sourceKey: "sgd", scale: "rial" },
  { key: "price_hkd", sourceKey: "hkd", scale: "rial" },
  { key: "price_azn", sourceKey: "azn", scale: "rial" },
  { key: "price_amd", sourceKey: "amd", scale: "amd1" },
  { key: "price_sar", sourceKey: "sar", scale: "rial" },
  { key: "price_inr", sourceKey: "inr", scale: "rial" },
  { key: "price_myr", sourceKey: "myr", scale: "rial" },
  { key: "price_afn", sourceKey: "afn", scale: "rial" },
  { key: "price_kwd", sourceKey: "kwd", scale: "rial" },
  { key: "price_iqd", sourceKey: "iqd", scale: "iqd1" },
  { key: "price_bhd", sourceKey: "bhd", scale: "rial" },
  { key: "price_omr", sourceKey: "omr", scale: "rial" },
  { key: "price_qar", sourceKey: "qar", scale: "rial" },
  { key: "geram18", sourceKey: "gol18", scale: "rial" },
  { key: "mesghal", sourceKey: "mithqal", scale: "rial" },
  { key: "ons", sourceKey: "ounce", scale: "usd" },
  { key: "sekee", sourceKey: "emami1", scale: "rial" },
  { key: "sekeb", sourceKey: "azadi1", scale: "rial" },
  { key: "nim", sourceKey: "azadi1_2", scale: "rial" },
  { key: "rob", sourceKey: "azadi1_4", scale: "rial" },
  { key: "gerami", sourceKey: "azadi1g", scale: "rial" },
];

function parseNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Accept a missing stamp. Reject a row frozen for a week. Allow a day of clock skew. */
function fresh(ts: string | undefined, now: number): boolean {
  if (!ts) return true;
  const iso = ts.includes("T") ? ts : `${ts.replace(" ", "T")}Z`;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return true;
  const age = now - ms;
  return age < STALE_MS && age > -2 * 24 * 60 * 60 * 1000;
}

function scaled(n: number, scale: Scale): number {
  switch (scale) {
    case "usd":
      return Math.round(n);
    case "rial":
      return Math.round(n / 10);
    case "jpy100":
      return Math.round(n / 100);
    case "amd1":
      return Math.round(n);
    case "iqd1":
      return Math.round(n * 10);
  }
}

export interface TgjuParsed {
  quotes: BoardQuote[];
  /** Toman, or null when the live tether row is missing or outside the USDT band. */
  usdt: number | null;
  usdtState: "ok" | "missing" | "unusable";
}

export function parseTgju(body: unknown, now = Date.now()): TgjuParsed {
  const cur =
    (body as { current?: Record<string, TgjuRow> } | null)?.current ??
    (body as Record<string, TgjuRow> | null) ??
    {};

  const quotes: BoardQuote[] = [];
  for (const row of ROWS) {
    const item = cur[row.key];
    if (!item || !fresh(item.ts, now)) continue;
    const n = parseNum(item.p);
    if (n == null) continue;
    quotes.push(single(row.sourceKey, scaled(n, row.scale), "tgju"));
  }

  const tether = cur["crypto-tether-irr"];
  let usdt: number | null = null;
  let usdtState: TgjuParsed["usdtState"] = "missing";
  if (tether && fresh(tether.ts, now)) {
    const n = parseNum(tether.p);
    const toman = n == null ? null : Math.round(n / 10);
    if (toman != null && toman >= USDT_MIN && toman <= USDT_MAX) {
      usdt = toman;
      usdtState = "ok";
    } else {
      usdtState = "unusable";
    }
  }

  return { quotes: dropUnitErrors(quotes), usdt, usdtState };
}

async function fetchTgju(): Promise<TgjuParsed> {
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
  return parseTgju(await res.json());
}

/** Full board plus the tether row, one request. */
export async function scrapeTgju(): Promise<TgjuParsed> {
  return fetchTgju();
}

/** USDT mid in toman. Throws when the live row is missing or unusable. */
export async function scrapeTgjuUsdt(): Promise<number> {
  const parsed = await fetchTgju();
  if (parsed.usdtState === "missing") throw new Error("tgju: no crypto-tether-irr");
  if (parsed.usdt == null) throw new Error("tgju: unusable price");
  return parsed.usdt;
}
