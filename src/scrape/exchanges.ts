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

export interface ExchangeQuote {
  exchange: string;
  name: string;
  buy: number | null;
  sell: number | null;
  mid: number | null;
}

const UA = "DollarChande/1.1 (+cloudflare-worker; rates aggregator)";

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
  const res = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json, text/plain, */*",
      "user-agent": UA,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${url}: non-json`);
  }
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
  try {
    const body = (await getJson("https://api.nobitex.ir/market/stats")) as {
      stats?: Record<string, { bestSell?: string; bestBuy?: string; latest?: string }>;
    };
    const s = body.stats?.USDTIRT ?? body.stats?.usdtirt;
    if (s) {
      return quote("nobitex", "Nobitex", s.bestSell, s.bestBuy, s.latest);
    }
  } catch {
    /* fall through */
  }
  // orderbook fallback
  const ob = (await getJson("https://api.nobitex.ir/v2/orderbook/USDTIRT")) as {
    asks?: Array<[string, string]>;
    bids?: Array<[string, string]>;
  };
  return quote("nobitex", "Nobitex", ob.asks?.[0]?.[0], ob.bids?.[0]?.[0]);
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

/** Bitpin */
export async function scrapeBitpin(): Promise<ExchangeQuote> {
  const body = (await getJson("https://api.bitpin.ir/api/v1/mkt/markets/")) as
    | Array<{
        code?: string;
        currency1_code?: string;
        currency2_code?: string;
        price?: string | number;
        price_info?: { price?: string };
        top_order_price?: { buy?: string; sell?: string };
      }>
    | { results?: unknown[] };

  const list = Array.isArray(body) ? body : [];
  const m =
    list.find((x) => {
      const code = (x.code ?? "").toUpperCase();
      const c2 = (x.currency2_code ?? "").toUpperCase();
      return (
        code.includes("USDT") &&
        (c2 === "IRT" || c2 === "TMN" || c2 === "RLS" || code.includes("IRT") || code.includes("TMN"))
      );
    }) ?? list.find((x) => (x.code ?? "").toUpperCase().replace(/[-_]/g, "") === "USDTIRT");

  if (!m) throw new Error("bitpin: no USDT_IRT");
  // top_order: sell = ask (user buy), buy = bid (user sell)
  return quote(
    "bitpin",
    "Bitpin",
    m.top_order_price?.sell ?? m.price_info?.price ?? m.price,
    m.top_order_price?.buy ?? m.price_info?.price ?? m.price,
  );
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
  const urls = [
    "https://api-web.tabdeal.org/r/plots/currency_prices/USDT/",
    "https://api1.tabdeal.org/r/plots/currency_prices/USDT/",
    "https://api.tabdeal.org/r/plots/currency_prices/USDT/",
  ];
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const body = (await getJson(url)) as {
        price?: number | string;
        buy_price?: number | string;
        sell_price?: number | string;
        usdt?: { buy?: number; sell?: number; price?: number };
      };
      const buy = body.buy_price ?? body.usdt?.buy ?? body.price ?? body.usdt?.price;
      const sell = body.sell_price ?? body.usdt?.sell ?? body.price ?? body.usdt?.price;
      return quote("tabdeal", "Tabdeal", buy, sell);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("tabdeal: all endpoints failed");
}

/** Aban Tether — USDT specialist */
export async function scrapeAbanTether(): Promise<ExchangeQuote> {
  const urls = [
    "https://api.abantether.com/api/v1/manager/otc/ticker",
    "https://abantether.com/api/v1/otc/coin-price/?coin=USDT",
    "https://api.abantether.com/api/v1/otc/coin-price?coin=USDT",
  ];
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const body = (await getJson(url)) as Record<string, unknown> | Array<Record<string, unknown>>;
      // ticker list form
      if (Array.isArray(body)) {
        const usdt = body.find(
          (r) =>
            String(r.symbol ?? r.coin ?? r.currency ?? "").toUpperCase() === "USDT" ||
            String(r.name ?? "").toUpperCase().includes("TETHER"),
        );
        if (usdt) {
          return quote(
            "abantether",
            "Aban Tether",
            usdt.buy_price ?? usdt.buy ?? usdt.ask ?? usdt.price,
            usdt.sell_price ?? usdt.sell ?? usdt.bid ?? usdt.price,
            usdt.price ?? usdt.last,
          );
        }
      }
      // object form: { data: [...] } or { USDT: {...} } or flat
      const data = (body as { data?: unknown }).data ?? body;
      if (Array.isArray(data)) {
        const usdt = data.find(
          (r: Record<string, unknown>) =>
            String(r.symbol ?? r.coin ?? r.currency ?? "").toUpperCase() === "USDT",
        ) as Record<string, unknown> | undefined;
        if (usdt) {
          return quote(
            "abantether",
            "Aban Tether",
            usdt.buy_price ?? usdt.buy ?? usdt.ask ?? usdt.price,
            usdt.sell_price ?? usdt.sell ?? usdt.bid ?? usdt.price,
          );
        }
      }
      const flat = body as Record<string, unknown>;
      const usdtObj = (flat.USDT ?? flat.usdt ?? flat) as Record<string, unknown>;
      return quote(
        "abantether",
        "Aban Tether",
        usdtObj.buy_price ?? usdtObj.buy ?? usdtObj.ask ?? usdtObj.price ?? flat.buy_price,
        usdtObj.sell_price ?? usdtObj.sell ?? usdtObj.bid ?? usdtObj.price ?? flat.sell_price,
        usdtObj.price ?? flat.price,
      );
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("abantether: failed");
}

/** OMPFinex */
export async function scrapeOmpfinex(): Promise<ExchangeQuote> {
  const urls = [
    "https://api.ompfinex.com/v1/market",
    "https://api.ompfinex.com/v2/market",
    "https://www.ompfinex.com/public/api/v1/market",
  ];
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const body = (await getJson(url)) as
        | Array<Record<string, unknown>>
        | { data?: Array<Record<string, unknown>>; result?: Array<Record<string, unknown>> };
      const list = Array.isArray(body)
        ? body
        : (body.data ?? body.result ?? []);
      const m = list.find((x) => {
        const id = String(x.id ?? x.symbol ?? x.pair ?? x.market ?? "").toUpperCase();
        return (
          id.includes("USDT") &&
          (id.includes("IRT") || id.includes("TMN") || id.includes("IRR") || id.includes("RLS"))
        );
      });
      if (!m) continue;
      return quote(
        "ompfinex",
        "OMPFinex",
        m.sell ?? m.ask ?? m.best_sell ?? m.price,
        m.buy ?? m.bid ?? m.best_buy ?? m.price,
        m.last ?? m.price,
      );
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("ompfinex: no USDT market");
}

/** Bit24 */
export async function scrapeBit24(): Promise<ExchangeQuote> {
  const urls = [
    "https://api.bit24.cash/api/v3/markets",
    "https://bit24.cash/api/v3/markets",
    "https://api.bit24.cash/api/v1/ticker",
  ];
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const body = (await getJson(url)) as
        | Array<Record<string, unknown>>
        | { data?: Array<Record<string, unknown>>; result?: Record<string, unknown> };
      const list = Array.isArray(body)
        ? body
        : Array.isArray((body as { data?: unknown }).data)
          ? ((body as { data: Array<Record<string, unknown>> }).data)
          : [];
      if (list.length) {
        const m = list.find((x) => {
          const s = String(x.symbol ?? x.pair ?? x.name ?? x.market ?? "").toUpperCase();
          return s.includes("USDT") && (s.includes("IRT") || s.includes("TMN") || s.includes("IRR"));
        });
        if (m) {
          return quote(
            "bit24",
            "Bit24",
            m.ask ?? m.sell ?? m.buy_price ?? m.price,
            m.bid ?? m.buy ?? m.sell_price ?? m.price,
            m.last ?? m.price,
          );
        }
      }
      // flat ticker object
      const flat = (body as { result?: Record<string, unknown> }).result ?? (body as Record<string, unknown>);
      if (flat && (flat.USDTIRT || flat.usdt_irt || flat.USDT)) {
        const u = (flat.USDTIRT ?? flat.usdt_irt ?? flat.USDT) as Record<string, unknown>;
        return quote("bit24", "Bit24", u.ask ?? u.sell ?? u.price, u.bid ?? u.buy ?? u.price);
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("bit24: failed");
}

/** OK-Ex (اوکی‌اکسچنج) */
export async function scrapeOkEx(): Promise<ExchangeQuote> {
  const urls = [
    "https://api.ok-ex.io/oapi/v1/market/overview",
    "https://www.ok-ex.io/api/v1/market/ticker?symbol=USDT-IRT",
    "https://api.okex.ir/api/v1/market/ticker?symbol=USDTIRT",
  ];
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const body = (await getJson(url)) as
        | Array<Record<string, unknown>>
        | { data?: Array<Record<string, unknown>> | Record<string, unknown>; result?: unknown };
      const data = (body as { data?: unknown }).data ?? body;
      const list = Array.isArray(data) ? data : [];
      if (list.length) {
        const m = list.find((x) => {
          const s = String(x.symbol ?? x.market ?? x.pair ?? "").toUpperCase();
          return s.includes("USDT") && (s.includes("IRT") || s.includes("TMN") || s.includes("IRR"));
        });
        if (m) {
          return quote(
            "okex",
            "OK-Ex",
            m.sell ?? m.ask ?? m.highest_buy ?? m.price,
            m.buy ?? m.bid ?? m.lowest_sell ?? m.price,
            m.last ?? m.price,
          );
        }
      }
      if (data && typeof data === "object" && !Array.isArray(data)) {
        const d = data as Record<string, unknown>;
        return quote(
          "okex",
          "OK-Ex",
          d.ask ?? d.sell ?? d.price,
          d.bid ?? d.buy ?? d.price,
          d.last ?? d.price,
        );
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("okex: failed");
}

/** Pooleno (پول‌نو) */
export async function scrapePooleno(): Promise<ExchangeQuote> {
  const urls = [
    "https://api.pooleno.ir/v1/price",
    "https://api.pooleno.ir/v1/public/price",
    "https://pooleno.ir/api/v1/price/usdt",
  ];
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const body = (await getJson(url)) as Record<string, unknown> | Array<Record<string, unknown>>;
      if (Array.isArray(body)) {
        const u = body.find((x) => String(x.symbol ?? x.coin ?? "").toUpperCase() === "USDT");
        if (u) return quote("pooleno", "Pooleno", u.buy ?? u.ask ?? u.price, u.sell ?? u.bid ?? u.price);
      }
      const d = (body as { data?: unknown }).data ?? body;
      if (Array.isArray(d)) {
        const u = d.find((x: Record<string, unknown>) => String(x.symbol ?? x.coin ?? "").toUpperCase() === "USDT");
        if (u) return quote("pooleno", "Pooleno", u.buy ?? u.price, u.sell ?? u.price);
      }
      const flat = (typeof d === "object" && d ? d : body) as Record<string, unknown>;
      const usdt = (flat.USDT ?? flat.usdt ?? flat) as Record<string, unknown>;
      return quote(
        "pooleno",
        "Pooleno",
        usdt.buy ?? usdt.buyPrice ?? usdt.price ?? flat.buy,
        usdt.sell ?? usdt.sellPrice ?? usdt.price ?? flat.sell,
      );
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("pooleno: failed");
}

/** Sarmayex (سرمایکس) */
export async function scrapeSarmayex(): Promise<ExchangeQuote> {
  const urls = [
    "https://api.sarmayex.com/api/v2/currency",
    "https://api.sarmayex.com/api/v1/currency",
    "https://market.sarmayex.com/api/v1/market/USDT_IRT",
  ];
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const body = (await getJson(url)) as
        | Array<Record<string, unknown>>
        | { data?: Array<Record<string, unknown>> | Record<string, unknown> };
      const data = (body as { data?: unknown }).data ?? body;
      const list = Array.isArray(data) ? data : [];
      if (list.length) {
        const u = list.find((x) => {
          const s = String(x.symbol ?? x.slug ?? x.name ?? x.pair ?? "").toUpperCase();
          return s === "USDT" || s.includes("USDT");
        });
        if (u) {
          return quote(
            "sarmayex",
            "Sarmayex",
            u.sell_price ?? u.sell ?? u.ask ?? u.price,
            u.buy_price ?? u.buy ?? u.bid ?? u.price,
            u.price ?? u.last,
          );
        }
      }
      if (data && typeof data === "object" && !Array.isArray(data)) {
        const d = data as Record<string, unknown>;
        return quote("sarmayex", "Sarmayex", d.ask ?? d.sell ?? d.price, d.bid ?? d.buy ?? d.price);
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("sarmayex: failed");
}

/** Ubitex */
export async function scrapeUbitex(): Promise<ExchangeQuote> {
  const urls = [
    "https://api.ubitex.io/api/v1/Market/GetMarketStats",
    "https://api.ubitex.io/api/v1/Market/GetTicker?symbol=USDTIRT",
  ];
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const body = (await getJson(url)) as
        | Array<Record<string, unknown>>
        | { data?: Array<Record<string, unknown>> | Record<string, unknown>; result?: unknown };
      const data = (body as { data?: unknown }).data ?? (body as { result?: unknown }).result ?? body;
      const list = Array.isArray(data) ? data : [];
      if (list.length) {
        const m = list.find((x) => {
          const s = String(x.symbol ?? x.market ?? x.pair ?? "").toUpperCase();
          return s.includes("USDT") && (s.includes("IRT") || s.includes("TMN") || s.includes("IRR"));
        });
        if (m) {
          return quote(
            "ubitex",
            "Ubitex",
            m.ask ?? m.sell ?? m.bestAsk ?? m.price,
            m.bid ?? m.buy ?? m.bestBid ?? m.price,
            m.last ?? m.price,
          );
        }
      }
      if (data && typeof data === "object" && !Array.isArray(data)) {
        const d = data as Record<string, unknown>;
        return quote("ubitex", "Ubitex", d.ask ?? d.sell ?? d.price, d.bid ?? d.buy ?? d.price);
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("ubitex: failed");
}

/** Bitbarg */
export async function scrapeBitbarg(): Promise<ExchangeQuote> {
  const urls = [
    "https://api.bitbarg.com/api/v1/currencies",
    "https://api.bitbarg.com/v1/currencies",
    "https://api.bitbarg.com/api/v1/currencies/usdt",
  ];
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const body = (await getJson(url)) as
        | Array<Record<string, unknown>>
        | { data?: Array<Record<string, unknown>> | Record<string, unknown> };
      const data = (body as { data?: unknown }).data ?? body;
      const list = Array.isArray(data) ? data : [];
      if (list.length) {
        const u = list.find((x) => String(x.symbol ?? x.slug ?? x.name ?? "").toUpperCase().includes("USDT"));
        if (u) {
          return quote(
            "bitbarg",
            "Bitbarg",
            u.buyPrice ?? u.buy ?? u.ask ?? u.price,
            u.sellPrice ?? u.sell ?? u.bid ?? u.price,
          );
        }
      }
      if (data && typeof data === "object" && !Array.isArray(data)) {
        const d = data as Record<string, unknown>;
        return quote("bitbarg", "Bitbarg", d.buy ?? d.ask ?? d.price, d.sell ?? d.bid ?? d.price);
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("bitbarg: failed");
}

/**
 * SwapWallet / کیف‌پول من style OTC — try common public endpoints.
 * (Brand names vary: swapwallet, kifpool, wallex-wallet apps)
 */
export async function scrapeSwapWallet(): Promise<ExchangeQuote> {
  const urls = [
    "https://api.swapwallet.ir/v1/price/usdt",
    "https://api.swapwallet.app/v1/price/usdt",
    "https://swapwallet.ir/api/v1/price",
    "https://api.kifpool.me/api/v1/price",
    "https://api.mykifpool.ir/api/v1/otc/usdt",
  ];
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const body = (await getJson(url)) as Record<string, unknown>;
      const d = (body.data as Record<string, unknown> | undefined) ?? body;
      const usdt = (d.USDT ?? d.usdt ?? d) as Record<string, unknown>;
      return quote(
        "swapwallet",
        "SwapWallet",
        usdt.buy ?? usdt.buyPrice ?? usdt.ask ?? usdt.price ?? d.buy,
        usdt.sell ?? usdt.sellPrice ?? usdt.bid ?? usdt.price ?? d.sell,
        usdt.price ?? d.price,
      );
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("swapwallet: failed");
}

/** Arzplus */
export async function scrapeArzplus(): Promise<ExchangeQuote> {
  const urls = [
    "https://api.arzplus.net/api/v1/price/usdt",
    "https://panel.arzplus.net/api/v1/price/usdt",
    "https://api.arzplus.net/v1/currencies/usdt",
  ];
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const body = (await getJson(url)) as Record<string, unknown>;
      const d = (body.data as Record<string, unknown> | undefined) ?? body;
      return quote(
        "arzplus",
        "Arzplus",
        d.buy ?? d.buy_price ?? d.ask ?? d.price,
        d.sell ?? d.sell_price ?? d.bid ?? d.price,
      );
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("arzplus: failed");
}

/** Hamtapay */
export async function scrapeHamtapay(): Promise<ExchangeQuote> {
  const urls = [
    "https://api.hamtapay.com/v1/rates",
    "https://api.hamtapay.net/v1/price/usdt",
    "https://hamtapay.com/api/v1/rates",
  ];
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const body = (await getJson(url)) as
        | Array<Record<string, unknown>>
        | { data?: Array<Record<string, unknown>> | Record<string, unknown> };
      const data = (body as { data?: unknown }).data ?? body;
      const list = Array.isArray(data) ? data : [];
      if (list.length) {
        const u = list.find((x) => String(x.symbol ?? x.coin ?? "").toUpperCase().includes("USDT"));
        if (u) return quote("hamtapay", "Hamtapay", u.buy ?? u.price, u.sell ?? u.price);
      }
      if (data && typeof data === "object" && !Array.isArray(data)) {
        const d = data as Record<string, unknown>;
        const usdt = (d.USDT ?? d.usdt ?? d) as Record<string, unknown>;
        return quote("hamtapay", "Hamtapay", usdt.buy ?? usdt.price, usdt.sell ?? usdt.price);
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("hamtapay: failed");
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
  const list = Array.isArray(raw) ? raw : (raw?.currencies ?? []);
  const usdt = list.find((r) => (r.symbol ?? "").toUpperCase() === "USDT");
  if (!usdt) throw new Error("tetherland-alt: no USDT");
  const mid = usdt.toman_amount ?? usdt.price;
  return quote("tetherland_api", "Tetherland API", mid, mid, mid);
}

// ─── Registry ────────────────────────────────────────────────────────────────

type Scraper = () => Promise<ExchangeQuote>;

/**
 * Every scraper we know. Fail-soft; order does not matter (sorted by mid later).
 * OTC-only shops without public APIs are intentionally absent.
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
  { id: "abantether", run: scrapeAbanTether },
  { id: "ompfinex", run: scrapeOmpfinex },
  { id: "bit24", run: scrapeBit24 },
  { id: "okex", run: scrapeOkEx },
  { id: "pooleno", run: scrapePooleno },
  { id: "sarmayex", run: scrapeSarmayex },
  { id: "ubitex", run: scrapeUbitex },
  { id: "bitbarg", run: scrapeBitbarg },
  { id: "swapwallet", run: scrapeSwapWallet },
  { id: "arzplus", run: scrapeArzplus },
  { id: "hamtapay", run: scrapeHamtapay },
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
