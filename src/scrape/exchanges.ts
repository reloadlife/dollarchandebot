/**
 * Iranian USDT/IRT exchange buy/sell scrapers.
 * Fail-soft: each exchange is independent; one failure never blocks others.
 *
 * buy  = IRT/Toman paid to BUY 1 USDT (ask)
 * sell = IRT/Toman received when SELLING 1 USDT (bid)
 *
 * We include every major Iranian venue with a known public HTTP endpoint.
 * Many OTC shops have no public API — those cannot be scraped.
 */

import { fetchMaybeProxied } from "../lib/proxy";

export interface ExchangeQuote {
  exchange: string;
  name: string;
  buy: number | null;
  sell: number | null;
  mid: number | null;
}

// A self-identifying UA is a free WAF trigger. Browser headers cost nothing and
// clear naive rules — they do NOT beat the ASN-level blocks these venues use.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** USDT in free-market Toman is roughly 50k–500k. Outside → treat as Rial or junk. */
const TOMAN_MIN = 50_000;
const TOMAN_MAX = 500_000;

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Normalize to Toman; auto /10 when value looks like Rial (×10). */
function toToman(v: unknown): number | null {
  let n = toNum(v);
  if (n == null) return null;
  // Rial quote: ~1.7M–2.5M for USDT
  for (let i = 0; i < 3 && n > TOMAN_MAX; i++) n = Math.round(n / 10);
  if (n < TOMAN_MIN || n > TOMAN_MAX) return null;
  return Math.round(n);
}

function midOf(buy: number | null, sell: number | null): number | null {
  if (buy != null && sell != null) return Math.round((buy + sell) / 2);
  return buy ?? sell;
}

function quote(
  exchange: string,
  name: string,
  buyRaw: unknown,
  sellRaw: unknown,
  midRaw?: unknown,
): ExchangeQuote {
  const buy = toToman(buyRaw);
  const sell = toToman(sellRaw);
  const mid = toToman(midRaw) ?? midOf(buy, sell);
  if (mid == null && buy == null && sell == null) {
    throw new Error(`${exchange}: no usable USDT price`);
  }
  return { exchange, name, buy: buy ?? mid, sell: sell ?? mid, mid: mid ?? midOf(buy, sell) };
}

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetchMaybeProxied(url, {
    ...init,
    headers: {
      accept: "application/json, text/plain, */*",
      "user-agent": UA,
      "accept-language": "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7",
      "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      // Same-origin referer: several IR WAFs reject API hits with none.
      referer: new URL(url).origin + "/",
      origin: new URL(url).origin,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    // Unread bodies pile up against the concurrent-request limit.
    await res.body?.cancel();
    throw new Error(`${url} → ${res.status}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${url}: non-json`);
  }
}

/** Same headers as getJson, for the venues that only render prices into HTML. */
async function getText(url: string): Promise<string> {
  const res = await fetchMaybeProxied(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": UA,
      "accept-language": "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7",
      referer: new URL(url).origin + "/",
    },
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`${url} → ${res.status}`);
  }
  return res.text();
}

/**
 * Read only the first `maxBytes` of a response and cancel the rest.
 *
 * Pooleno's price page is 1.4MB and ignores Range requests, but the data sits
 * in a JSON-LD block ~3KB in. Buffering the whole thing every five minutes
 * would burn the free tier's CPU budget for no gain.
 */
async function getTextHead(url: string, maxBytes = 64 * 1024): Promise<string> {
  const res = await fetchMaybeProxied(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": UA,
      "accept-language": "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7",
      referer: new URL(url).origin + "/",
    },
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`${url} → ${res.status}`);
  }
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let out = "";
  try {
    while (out.length < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      out += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return out;
}

/** Persian/Arabic-Indic digits → ASCII, so "۱۹۷,۷۲۳" parses. */
function faDigits(s: string): string {
  return s
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

// ─── Scrapers ────────────────────────────────────────────────────────────────

/** Tetherland (aggregator / OTC mid) */
export async function scrapeTetherlandExchange(): Promise<ExchangeQuote> {
  const body = (await getJson("https://service.tetherland.com/api/v5/currencies")) as {
    data?: Array<{ symbol?: string; toman_amount?: number; price?: number }>;
  };
  const usdt = (body.data ?? []).find((r) => (r.symbol ?? "").toUpperCase() === "USDT");
  if (!usdt) throw new Error("tetherland: no USDT");
  const mid = usdt.toman_amount ?? usdt.price;
  return quote("tetherland", "Tetherland", mid, mid, mid);
}

/** Nobitex — largest IR exchange */
export async function scrapeNobitex(): Promise<ExchangeQuote> {
  // apiv2 answers from CF egress while api.nobitex.ir returns 530, and the key
  // is "usdt-rls" — not "USDTIRT", which is why the old lookup missed even on
  // the cycles the request did get through. Prices are Rial; toToman handles it.
  const body = (await getJson("https://apiv2.nobitex.ir/market/stats")) as {
    stats?: Record<string, { bestSell?: string; bestBuy?: string; latest?: string }>;
  };
  const stats = body.stats ?? {};
  const s = stats["usdt-rls"] ?? stats["usdt-irt"] ?? stats.USDTIRT;
  if (!s) throw new Error("nobitex: no USDT pair");
  return quote("nobitex", "Nobitex", s.bestBuy, s.bestSell, s.latest);
}

/** Wallex */
export async function scrapeWallex(): Promise<ExchangeQuote> {
  try {
    const body = (await getJson("https://api.wallex.ir/v1/markets")) as {
      result?: {
        symbols?: Record<string, { stats?: { bidPrice?: string; askPrice?: string; lastPrice?: string } }>;
      };
    };
    const syms = body.result?.symbols ?? {};
    const key =
      Object.keys(syms).find((k) => /^USDT[-_]?T(MN|OMAN|IRT)$/i.test(k)) ??
      Object.keys(syms).find(
        (k) => k.toUpperCase().includes("USDT") && (k.toUpperCase().includes("TMN") || k.toUpperCase().includes("IRT")),
      );
    if (key) {
      const st = syms[key]?.stats;
      return quote("wallex", "Wallex", st?.askPrice, st?.bidPrice, st?.lastPrice);
    }
  } catch {
    /* fall through */
  }
  const depth = (await getJson("https://api.wallex.ir/v1/depth?symbol=USDTTMN")) as {
    result?: { ask?: Array<{ price?: string }>; bid?: Array<{ price?: string }> };
  };
  return quote(
    "wallex",
    "Wallex",
    depth.result?.ask?.[0]?.price,
    depth.result?.bid?.[0]?.price,
  );
}

/** Bitpin — last USDT_IRT trade. The price is already toman. The markets list does not answer. */
export async function scrapeBitpin(): Promise<ExchangeQuote> {
  const body = (await getJson("https://api.bitpin.ir/api/v1/mth/matches/USDT_IRT/")) as
    | Array<{ price?: string | number }>
    | { results?: Array<{ price?: string | number }> };
  const list = Array.isArray(body) ? body : (body.results ?? []);
  const price = list[0]?.price;
  if (price == null) throw new Error("bitpin: no USDT_IRT");
  return quote("bitpin", "Bitpin", price, price, price);
}

/** Ramzinex — often quotes Rial */
export async function scrapeRamzinex(): Promise<ExchangeQuote> {
  const body = (await getJson(
    "https://publicapi.ramzinex.com/exchange/api/v1.0/exchange/pairs",
  )) as {
    data?: Array<{
      base_currency_symbol?: { en?: string };
      quote_currency_symbol?: { en?: string };
      buy?: number;
      sell?: number;
      price?: number;
    }>;
  };
  const p = (body.data ?? []).find(
    (x) =>
      (x.base_currency_symbol?.en ?? "").toUpperCase() === "USDT" &&
      ["IRR", "IRT", "TMN", "RLS"].includes((x.quote_currency_symbol?.en ?? "").toUpperCase()),
  );
  if (!p) throw new Error("ramzinex: no USDT pair");
  // API: buy/sell from exchange POV may be swapped; try both via toToman
  return quote("ramzinex", "Ramzinex", p.sell ?? p.price, p.buy ?? p.price, p.price);
}

/** Exir */
export async function scrapeExir(): Promise<ExchangeQuote> {
  const body = (await getJson("https://api.exir.io/v1/orderbooks?symbol=usdt-irt")) as {
    "usdt-irt"?: { bids?: Array<[string, string]>; asks?: Array<[string, string]> };
  };
  const book = body["usdt-irt"];
  return quote("exir", "Exir", book?.asks?.[0]?.[0], book?.bids?.[0]?.[0]);
}

/** Tabdeal */
export async function scrapeTabdeal(): Promise<ExchangeQuote> {
  // Only the depth endpoint answers from CF egress; the old plots path 404s.
  const body = (await getJson("https://api.tabdeal.org/api/v1/depth/?symbol=USDTIRT")) as {
    asks?: Array<[string, string]>;
    bids?: Array<[string, string]>;
  };
  // Best ask = what you pay to buy, best bid = what you get selling.
  const sell = body.asks?.[0]?.[0];
  const buy = body.bids?.[0]?.[0];
  if (sell == null && buy == null) throw new Error("tabdeal: empty book");
  return quote("tabdeal", "Tabdeal", buy, sell);
}

/** Aban Tether — the OTC book is `data.markets.USDTIRT`, not a flat list. */
export async function scrapeAbanTether(): Promise<ExchangeQuote> {
  const body = (await getJson("https://api.abantether.com/api/v1/manager/otc/ticker")) as {
    data?: { markets?: Record<string, { buy_price?: string; sell_price?: string }> };
  };
  const row = body.data?.markets?.USDTIRT;
  if (!row) throw new Error("abantether: no USDTIRT");
  // buy_price is what you pay; sell_price is what you receive. Already toman.
  return quote("abantether", "Aban Tether", row.buy_price, row.sell_price);
}

/** Raastin — public depth. Prices are already toman. */
export async function scrapeRaastin(): Promise<ExchangeQuote> {
  const body = (await getJson("https://api.raastin.com/api/v1/market/depth/USDTIRT/")) as {
    asks?: Array<{ price?: string }>;
    bids?: Array<{ price?: string }>;
    last_trade?: { price?: string };
  };
  const ask = body.asks?.[0]?.price;
  const bid = body.bids?.[0]?.price;
  if (ask == null && bid == null) throw new Error("raastin: empty book");
  return quote("raastin", "Raastin", ask, bid, body.last_trade?.price);
}

/** OMPFinex */
export async function scrapeOmpfinex(): Promise<ExchangeQuote> {
  const body = (await getJson("https://api.ompfinex.com/v1/market")) as {
    data?: Array<{
      base_currency?: { id?: string };
      quote_currency?: { id?: string };
      last_price?: string | number;
      min_price?: string | number;
      max_price?: string | number;
    }>;
  };
  // The pair is identified by nested currency objects; `id` is a numeric row id,
  // which is why the old string match never hit. Prices are Rial (toToman /10s).
  const m = (body.data ?? []).find(
    (x) =>
      (x.base_currency?.id ?? "").toUpperCase() === "USDT" &&
      ["IRR", "IRT", "TMN", "RLS"].includes((x.quote_currency?.id ?? "").toUpperCase()),
  );
  if (!m) throw new Error("ompfinex: no USDT pair");
  return quote("ompfinex", "OMPFinex", m.last_price, m.last_price, m.last_price);
}

/**
 * Bit24 OTC. `?base=USDT` lists other coins priced in tether, not the tether
 * book. `?symbol=USDT` is the toman quote. The pro API wants a key.
 */
export async function scrapeBit24(): Promise<ExchangeQuote> {
  const body = (await getJson("https://otc-api.bit24.cash/api/v1/coins/markets?symbol=USDT")) as {
    data?: { results?: Array<{ symbol?: string; each_price?: string | number }> };
  };
  const row = (body.data?.results ?? []).find((r) => (r.symbol ?? "").toUpperCase() === "USDT");
  if (!row?.each_price) throw new Error("bit24: no USDT quote");
  return quote("bit24", "Bit24", row.each_price, row.each_price, row.each_price);
}

/**
 * Pooleno — no public API, but the price page embeds a schema.org
 * ExchangeRateSpecification near the top. Their JSON-LD labels the value IRR
 * while it is actually Toman; toToman leaves it alone at this magnitude, and
 * the sanity range catches it if they ever fix the label.
 */
export async function scrapePooleno(): Promise<ExchangeQuote> {
  const head = await getTextHead("https://pooleno.ir/price/usdt");
  const m = /"priceTMN\\?":\\?"(\d+)/.exec(head) ?? /"price":(\d{5,7}),"priceCurrency":"IRR"/.exec(head);
  if (!m?.[1]) throw new Error("pooleno: no USDT price in page head");
  return quote("pooleno", "Pooleno", m[1], m[1], m[1]);
}

/**
 * Bitbarg — `price` is the coin's USD peg (1 for USDT). The toman series is `chart`.
 */
export async function scrapeBitbarg(): Promise<ExchangeQuote> {
  const body = (await getJson("https://api.bitbarg.com/api/v1/currencies")) as {
    result?: { items?: Array<{ coin?: string; chart?: number[] }> };
  };
  const row = (body.result?.items ?? []).find((x) => (x.coin ?? "").toUpperCase() === "USDT");
  const last = row?.chart?.at(-1);
  if (last == null) throw new Error("bitbarg: no USDT chart");
  return quote("bitbarg", "Bitbarg", last, last, last);
}

/** Wallex-style OTC “Tetherland v2” mirror sometimes used by bots */
export async function scrapeTetherlandAlt(): Promise<ExchangeQuote> {
  const body = (await getJson("https://api.tetherland.com/currencies")) as {
    data?: { currencies?: Array<{ symbol?: string; price?: number; toman_amount?: number }> } | Array<{
      symbol?: string;
      price?: number;
      toman_amount?: number;
    }>;
  };
  const raw = body.data;
  const nested = Array.isArray(raw) ? raw : raw?.currencies;
  // API sometimes answers 200 with `currencies` as an object map, not a list.
  const list = Array.isArray(nested) ? nested : [];
  const usdt = list.find((r) => (r.symbol ?? "").toUpperCase() === "USDT");
  if (!usdt) throw new Error("tetherland-alt: no USDT");
  const mid = usdt.toman_amount ?? usdt.price;
  return quote("tetherland_api", "Tetherland API", mid, mid, mid);
}

/**
 * Ubitex — no reachable JSON endpoint, but the homepage server-renders the
 * price table. Anchored on the USDT icon URL rather than the Tailwind classes,
 * which change every build; the sanity range is the real guard.
 */
export async function scrapeUbitex(): Promise<ExchangeQuote> {
  const html = await getText("https://ubitex.io/");
  const at = html.indexOf("icons%2Fusdt.svg");
  if (at < 0) throw new Error("ubitex: no USDT row");
  const m = />([\d,]{6,})</.exec(html.slice(at, at + 4000));
  const raw = m?.[1];
  if (!raw) throw new Error("ubitex: no price near USDT row");
  return quote("ubitex", "Ubitex", raw, raw, raw);
}

/**
 * SwapWallet — the public coin page server-renders the buy side for 1 USDT.
 * The sell tab is client-side and is not in the HTML. Their API wants a key.
 */
export async function scrapeSwapWallet(): Promise<ExchangeQuote> {
  const html = await getTextHead("https://swapwallet.app/coins/USDT");
  const amount = /aria-label="مقدار USDT"[^>]*value="([\d.]+)"/.exec(html);
  if (amount && amount[1] !== "1") throw new Error("swapwallet: amount is not 1 USDT");
  const m = /aria-label="مبلغ به تومان"[^>]*value="([\d,]+)"/.exec(html);
  if (!m?.[1]) throw new Error("swapwallet: no toman buy price");
  return quote("swapwallet", "SwapWallet", m[1], null);
}

/** Arzplus — same story, but the markup is semantic and stable. */
export async function scrapeArzplus(): Promise<ExchangeQuote> {
  const html = await getText("https://arzplus.net/");
  const at = html.indexOf(">USDT</p>");
  if (at < 0) throw new Error("arzplus: no USDT row");
  const m = /class="toman">\s*([\u06F0-\u06F9\d,]{6,})/.exec(html.slice(at, at + 1500));
  if (!m?.[1]) throw new Error("arzplus: no price near USDT row");
  const raw = faDigits(m[1]);
  return quote("arzplus", "Arzplus", raw, raw, raw);
}

// ─── Registry ────────────────────────────────────────────────────────────────

type Scraper = () => Promise<ExchangeQuote>;

/**
 * Every scraper with one working public URL. Fail-soft; order does not matter.
 * Poulyar and Iranicard still have no confirmed public tether price.
 */
const SCRAPERS: Array<{ id: string; run: Scraper }> = [
  { id: "tetherland", run: scrapeTetherlandExchange },
  { id: "tetherland_api", run: scrapeTetherlandAlt },
  { id: "nobitex", run: scrapeNobitex },
  { id: "wallex", run: scrapeWallex },
  { id: "bitpin", run: scrapeBitpin },
  { id: "ramzinex", run: scrapeRamzinex },
  { id: "exir", run: scrapeExir },
  { id: "tabdeal", run: scrapeTabdeal },
  { id: "raastin", run: scrapeRaastin },
  { id: "abantether", run: scrapeAbanTether },
  { id: "ompfinex", run: scrapeOmpfinex },
  { id: "bit24", run: scrapeBit24 },
  { id: "pooleno", run: scrapePooleno },
  { id: "ubitex", run: scrapeUbitex },
  { id: "bitbarg", run: scrapeBitbarg },
  { id: "arzplus", run: scrapeArzplus },
  { id: "swapwallet", run: scrapeSwapWallet },
];

export function listScraperIds(): string[] {
  return SCRAPERS.map((s) => s.id);
}

export async function scrapeAllUsdtExchanges(): Promise<{
  quotes: ExchangeQuote[];
  errors: string[];
}> {
  const results = await Promise.allSettled(SCRAPERS.map((s) => s.run()));
  const quotes: ExchangeQuote[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    const id = SCRAPERS[i]!.id;
    if (r.status === "fulfilled" && r.value.mid != null) {
      // dedupe by exchange id (tetherland + tetherland_api → keep first good)
      const key = r.value.exchange.startsWith("tetherland") ? "tetherland" : r.value.exchange;
      if (seen.has(key)) continue;
      // prefer canonical name for tetherland
      if (key === "tetherland") {
        quotes.push({ ...r.value, exchange: "tetherland", name: "Tetherland" });
      } else {
        quotes.push(r.value);
      }
      seen.add(key);
    } else if (r.status === "rejected") {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      errors.push(`${id}: ${msg}`);
    } else {
      errors.push(`${id}: empty quote`);
    }
  }

  // sort cheapest mid first for arb UX
  quotes.sort((a, b) => (a.mid ?? 0) - (b.mid ?? 0));
  return { quotes, errors };
}
