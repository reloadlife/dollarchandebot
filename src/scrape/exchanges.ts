/**
 * Iranian USDT/IRT exchange buy/sell scrapers.
 * Fail-soft: each exchange is independent; one failure never blocks others.
 *
 * buy  = IRT paid to BUY 1 USDT (ask / bestSell)
 * sell = IRT received when SELLING 1 USDT (bid / bestBuy)
 */

export interface ExchangeQuote {
  exchange: string;
  name: string;
  buy: number | null;
  sell: number | null;
  mid: number | null;
}

const UA = "DollarChande/1.0 (+cloudflare-worker; rates aggregator)";

function toInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  // nobitex sometimes returns rial (x10); if absurdly high, /10
  if (n > 5_000_000) return Math.round(n / 10);
  return Math.round(n);
}

function midOf(buy: number | null, sell: number | null): number | null {
  if (buy != null && sell != null) return Math.round((buy + sell) / 2);
  return buy ?? sell;
}

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      "user-agent": UA,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

/** Tetherland — already used for main USDT */
export async function scrapeTetherlandExchange(): Promise<ExchangeQuote> {
  const body = (await getJson("https://service.tetherland.com/api/v5/currencies")) as {
    data?: Array<{ symbol?: string; toman_amount?: number }>;
  };
  const rows = body.data ?? [];
  const usdt = rows.find((r) => (r.symbol ?? "").toUpperCase() === "USDT");
  const mid = toInt(usdt?.toman_amount);
  // tetherland is single mid; approximate ±0 for buy/sell
  return {
    exchange: "tetherland",
    name: "Tetherland",
    buy: mid,
    sell: mid,
    mid,
  };
}

/** Nobitex public market stats */
export async function scrapeNobitex(): Promise<ExchangeQuote> {
  const body = (await getJson("https://api.nobitex.ir/market/stats")) as {
    status?: string;
    stats?: Record<string, { bestSell?: string; bestBuy?: string }>;
  };
  const s = body.stats?.USDTIRT ?? body.stats?.usdtirt;
  if (!s) throw new Error("nobitex: no USDTIRT");
  const buy = toInt(s.bestSell); // ask
  const sell = toInt(s.bestBuy); // bid
  return {
    exchange: "nobitex",
    name: "Nobitex",
    buy,
    sell,
    mid: midOf(buy, sell),
  };
}

/** Wallex markets */
export async function scrapeWallex(): Promise<ExchangeQuote> {
  const body = (await getJson("https://api.wallex.ir/v1/markets")) as {
    result?: {
      symbols?: Record<
        string,
        { stats?: { bidPrice?: string; askPrice?: string }; symbol?: string }
      >;
    };
  };
  const syms = body.result?.symbols ?? {};
  // USDT TMN / IRT pairs
  const key =
    Object.keys(syms).find((k) => /^USDT[-_]?T(MN|OMAN|IRT)$/i.test(k)) ??
    Object.keys(syms).find((k) => k.toUpperCase().includes("USDT") && k.toUpperCase().includes("TMN"));
  if (!key) throw new Error("wallex: no USDT pair");
  const st = syms[key]?.stats;
  const sell = toInt(st?.bidPrice);
  const buy = toInt(st?.askPrice);
  return {
    exchange: "wallex",
    name: "Wallex",
    buy,
    sell,
    mid: midOf(buy, sell),
  };
}

/** Bitpin markets */
export async function scrapeBitpin(): Promise<ExchangeQuote> {
  const body = (await getJson("https://api.bitpin.ir/api/v1/mkt/markets/")) as
    | Array<{
        code?: string;
        currency1_code?: string;
        currency2_code?: string;
        price?: string | number;
        price_info?: { price?: string; change?: number };
        top_order_price?: { buy?: string; sell?: string };
      }>
    | { results?: unknown[] };

  const list = Array.isArray(body) ? body : [];
  const m =
    list.find(
      (x) =>
        (x.code ?? "").toUpperCase().includes("USDT") &&
        ((x.currency2_code ?? "").toUpperCase() === "IRT" ||
          (x.currency2_code ?? "").toUpperCase() === "TMN" ||
          (x.code ?? "").toUpperCase().includes("IRT")),
    ) ??
    list.find((x) => (x.code ?? "").toUpperCase() === "USDT_IRT");

  if (!m) throw new Error("bitpin: no USDT_IRT");
  const buy = toInt(m.top_order_price?.sell ?? m.price_info?.price ?? m.price);
  const sell = toInt(m.top_order_price?.buy ?? m.price_info?.price ?? m.price);
  return {
    exchange: "bitpin",
    name: "Bitpin",
    buy,
    sell,
    mid: midOf(buy, sell),
  };
}

/** Ramzinex orderbook pair id 11 is often USDT/IRR — best-effort */
export async function scrapeRamzinex(): Promise<ExchangeQuote> {
  // public price endpoint
  const body = (await getJson(
    "https://publicapi.ramzinex.com/exchange/api/v1.0/exchange/pairs",
  )) as {
    data?: Array<{
      id?: number;
      base_currency_symbol?: { en?: string };
      quote_currency_symbol?: { en?: string };
      buy?: number;
      sell?: number;
      price?: number;
    }>;
  };
  const pairs = body.data ?? [];
  const p = pairs.find(
    (x) =>
      (x.base_currency_symbol?.en ?? "").toUpperCase() === "USDT" &&
      ["IRR", "IRT", "TMN", "RLS"].includes((x.quote_currency_symbol?.en ?? "").toUpperCase()),
  );
  if (!p) throw new Error("ramzinex: no USDT pair");
  let buy = toInt(p.sell ?? p.price); // exchange sell = user buy
  let sell = toInt(p.buy ?? p.price);
  // rial → toman if needed
  if (buy != null && buy > 5_000_000) buy = Math.round(buy / 10);
  if (sell != null && sell > 5_000_000) sell = Math.round(sell / 10);
  return {
    exchange: "ramzinex",
    name: "Ramzinex",
    buy,
    sell,
    mid: midOf(buy, sell),
  };
}

/** Exir orderbook */
export async function scrapeExir(): Promise<ExchangeQuote> {
  const body = (await getJson("https://api.exir.io/v1/orderbooks?symbol=usdt-irt")) as {
    "usdt-irt"?: { bids?: Array<[string, string]>; asks?: Array<[string, string]> };
  };
  const book = body["usdt-irt"];
  const sell = toInt(book?.bids?.[0]?.[0]); // best bid
  const buy = toInt(book?.asks?.[0]?.[0]); // best ask
  if (buy == null && sell == null) throw new Error("exir: empty book");
  return {
    exchange: "exir",
    name: "Exir",
    buy,
    sell,
    mid: midOf(buy, sell),
  };
}

/** Tabdeal / similar public ticker — best effort */
export async function scrapeTabdeal(): Promise<ExchangeQuote> {
  const body = (await getJson("https://api-web.tabdeal.org/r/plots/currency_prices/USDT/")) as {
    price?: number | string;
    buy_price?: number | string;
    sell_price?: number | string;
  };
  const buy = toInt(body.buy_price ?? body.price);
  const sell = toInt(body.sell_price ?? body.price);
  if (buy == null && sell == null) throw new Error("tabdeal: no price");
  return {
    exchange: "tabdeal",
    name: "Tabdeal",
    buy,
    sell,
    mid: midOf(buy, sell),
  };
}

const SCRAPERS: Array<() => Promise<ExchangeQuote>> = [
  scrapeTetherlandExchange,
  scrapeNobitex,
  scrapeWallex,
  scrapeBitpin,
  scrapeRamzinex,
  scrapeExir,
  scrapeTabdeal,
];

export async function scrapeAllUsdtExchanges(): Promise<{
  quotes: ExchangeQuote[];
  errors: string[];
}> {
  const results = await Promise.allSettled(SCRAPERS.map((fn) => fn()));
  const quotes: ExchangeQuote[] = [];
  const errors: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.mid != null) {
      quotes.push(r.value);
    } else if (r.status === "rejected") {
      errors.push(String(r.reason?.message ?? r.reason));
    }
  }
  return { quotes, errors };
}
