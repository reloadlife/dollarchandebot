/**
 * Alanchand (الان چند) public homepage.
 * Their JSON API at api.alanchand.com requires a bearer token and is not called.
 * The homepage already server-renders buy/sell in toman.
 *
 * JPY and AMD cells are 100 units; this project stores 10 yen and 10 dram, so those ÷10.
 * IQD on this page is already 100 dinar. Ounce is kept only when it is a USD figure.
 */

import { fetchMaybeProxied } from "../lib/proxy";
import { dropUnitErrors, single, type BoardQuote } from "./board";

const PAGE = "https://alanchand.com/";

const USDT_MIN = 50_000;
const USDT_MAX = 500_000;

const FX = new Set([
  "usd", "eur", "gbp", "chf", "cad", "aud", "try", "aed", "cny", "jpy",
  "sek", "nok", "dkk", "rub", "thb", "sgd", "hkd", "azn", "amd", "sar",
  "inr", "myr", "afn", "kwd", "iqd", "bhd", "omr", "qar",
]);

/** Slug on /gold-price/{slug} → symbol sourceKey. sekkeh is Emami, not Azadi. */
const GOLD: Array<{ slug: string; sourceKey: string }> = [
  { slug: "abshodeh", sourceKey: "mithqal" },
  { slug: "18ayar", sourceKey: "gol18" },
  { slug: "sekkeh", sourceKey: "emami1" },
];

export interface AlanUsdt {
  exchange: "alanchand";
  name: "Alanchand";
  buy: number;
  sell: number;
  mid: number;
}

export interface AlanParsed {
  quotes: BoardQuote[];
  usdt: AlanUsdt | null;
}

function faDigits(s: string): string {
  return s
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

function parseFa(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(faDigits(raw).replace(/,/g, "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** 100 yen / 100 dram on the page → the 10-unit symbol this project stores. */
function scaleFx(slug: string, n: number): number {
  if (slug === "jpy" || slug === "amd") return Math.round(n / 10);
  return Math.round(n);
}

function goldPrice(html: string, slug: string): number | null {
  const at = html.indexOf(`gold-price/${slug}`);
  if (at < 0) return null;
  const m = /fs-4 fw-bold">\s*([^<]+)/.exec(html.slice(at, at + 700));
  return parseFa(m?.[1]);
}

export function parseAlanchand(html: string): AlanParsed {
  const quotes: BoardQuote[] = [];
  const rowRe =
    /currencies-price\/([a-z0-9-]+)'[\s\S]{0,700}?buyPrice[^>]*>\s*([^<]*?)\s*<[\s\S]{0,180}?sellPrice[^>]*>\s*([^<]*?)\s*</g;

  for (const m of html.matchAll(rowRe)) {
    const slug = m[1] ?? "";
    if (!FX.has(slug)) continue;
    const buy = parseFa(m[2]);
    const sell = parseFa(m[3]);
    if (buy == null && sell == null) continue;
    // Page "buy" is the shop's bid (lower); "sell" is the shop's ask (higher). Same sides as bonbast.
    const buyT = buy == null ? null : scaleFx(slug, buy);
    const sellT = sell == null ? null : scaleFx(slug, sell);
    const price =
      buyT != null && sellT != null ? Math.round((buyT + sellT) / 2) : (sellT ?? buyT)!;
    quotes.push({
      sourceKey: slug,
      price,
      buy: buyT,
      sell: sellT ?? price,
      source: "alanchand",
    });
  }

  for (const g of GOLD) {
    const n = goldPrice(html, g.slug);
    if (n == null) continue;
    quotes.push(single(g.sourceKey, Math.round(n), "alanchand"));
  }

  const ounce = goldPrice(html, "usd_xau");
  if (ounce != null && ounce >= 500 && ounce <= 20_000) {
    quotes.push(single("ounce", Math.round(ounce), "alanchand"));
  }

  let usdt: AlanUsdt | null = null;
  const at = html.indexOf("crypto-price/usdt");
  if (at >= 0) {
    const m = /fs-5">\s*([^<]+)/.exec(html.slice(at, at + 900));
    const n = parseFa(m?.[1]);
    if (n != null && n >= USDT_MIN && n <= USDT_MAX) {
      const mid = Math.round(n);
      usdt = { exchange: "alanchand", name: "Alanchand", buy: mid, sell: mid, mid };
    }
  }

  return { quotes: dropUnitErrors(quotes), usdt };
}

export async function scrapeAlanchand(): Promise<AlanParsed> {
  const res = await fetchMaybeProxied(PAGE, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "accept-language": "fa-IR,fa;q=0.9,en;q=0.8",
      referer: PAGE,
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`alanchand ${res.status}`);
  }
  return parseAlanchand(await res.text());
}
