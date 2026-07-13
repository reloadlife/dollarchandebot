/**
 * Bonbast free-market rates.
 * Flow: GET homepage → extract one-time param → POST /json
 * Prices are in Toman (site native).
 */

const UA =
  "Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const BASE = "https://bonbast.com";

export interface BonbastQuote {
  sourceKey: string;
  sell: number;
  buy: number | null;
  /** mid = sell when no buy, else round((buy+sell)/2) */
  price: number;
}

const FX_KEYS = [
  "usd", "eur", "gbp", "chf", "cad", "aud", "sek", "nok", "rub", "thb",
  "sgd", "hkd", "azn", "amd", "dkk", "aed", "jpy", "try", "cny", "sar",
  "inr", "myr", "afn", "kwd", "iqd", "bhd", "omr", "qar",
] as const;

/** sell key → buy key (bonbast is inconsistent for coins) */
const COIN_PAIRS: Array<[string, string]> = [
  ["emami1", "emami12"],
  ["azadi1", "azadi12"],
  ["azadi1_2", "azadi1_22"],
  ["azadi1_4", "azadi1_42"],
  ["azadi1g", "azadi1g2"],
];

const GOLD_KEYS = ["mithqal", "gol18", "ounce", "bitcoin"] as const;

function toInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

async function fetchToken(): Promise<{ token: string; cookie: string }> {
  const res = await fetch(`${BASE}/`, {
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
      referer: `${BASE}/`,
      cookie: "st_bb=0; cookieconsent_status=true",
    },
  });
  if (!res.ok) throw new Error(`bonbast main ${res.status}`);
  const html = await res.text();
  const m = html.match(/param\s*[=:]\s*"([^"]+)"/);
  if (!m?.[1]) throw new Error("bonbast: param token not found");
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const cookie =
    setCookie.map((c) => c.split(";")[0]).filter(Boolean).join("; ") ||
    "st_bb=0";
  return { token: m[1], cookie };
}

async function fetchJson(token: string, cookie: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/json`, {
    method: "POST",
    headers: {
      "user-agent": UA,
      accept: "application/json, text/javascript, */*; q=0.01",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
      origin: BASE,
      referer: `${BASE}/`,
      cookie: `${cookie}; st_bb=0`,
    },
    body: `param=${encodeURIComponent(token)}`,
  });
  if (!res.ok) throw new Error(`bonbast json ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  if ("reset" in data) throw new Error("bonbast: token expired (reset)");
  return data;
}

export async function scrapeBonbast(): Promise<BonbastQuote[]> {
  const { token, cookie } = await fetchToken();
  // tiny delay mimics browser; reduces reset rate
  await new Promise((r) => setTimeout(r, 400));
  const raw = await fetchJson(token, cookie);
  const out: BonbastQuote[] = [];

  for (const code of FX_KEYS) {
    const sell = toInt(raw[`${code}1`]);
    const buy = toInt(raw[`${code}2`]);
    if (sell == null) continue;
    out.push({
      sourceKey: code,
      sell,
      buy,
      price: buy != null ? Math.round((buy + sell) / 2) : sell,
    });
  }

  for (const [sellKey, buyKey] of COIN_PAIRS) {
    const sell = toInt(raw[sellKey]);
    const buy = toInt(raw[buyKey]);
    if (sell == null) continue;
    out.push({
      sourceKey: sellKey,
      sell,
      buy,
      price: buy != null ? Math.round((buy + sell) / 2) : sell,
    });
  }

  for (const g of GOLD_KEYS) {
    const price = toInt(raw[g]);
    if (price == null) continue;
    out.push({ sourceKey: g, sell: price, buy: null, price });
  }

  return out;
}
