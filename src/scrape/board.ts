/** A free-market board quote already scaled into this project's units. */
export type BoardSource = "bonbast" | "tgju" | "alanchand";

export interface BoardQuote {
  sourceKey: string;
  price: number;
  buy: number | null;
  sell: number | null;
  source: BoardSource;
}

/** One published figure, no invented spread. `sell` carries it so a gold-style row still has a side. */
export function single(sourceKey: string, price: number, source: BoardSource): BoardQuote {
  return { sourceKey, price, buy: null, sell: price, source };
}

/** Keep the first board that produced a symbol. Callers put the preferred board first. */
export function fillMissing(primary: BoardQuote[], extra: BoardQuote[]): BoardQuote[] {
  const have = new Set(primary.map((q) => q.sourceKey.toLowerCase()));
  const out = primary.slice();
  for (const q of extra) {
    const key = q.sourceKey.toLowerCase();
    if (have.has(key)) continue;
    have.add(key);
    out.push(q);
  }
  return out;
}

/** Absolute bands. Ounce, silver ounce, and platinum are USD. A forgotten ÷10 on the dollar lands above the USD cap. */
const ABSOLUTE: Record<string, [number, number]> = {
  ounce: [500, 20_000],
  xag: [8, 250],
  platinum: [400, 8_000],
  usd: [20_000, 2_000_000],
  gol18: [500_000, 500_000_000],
  gol24: [1_000_000, 150_000_000],
  silver: [50_000, 2_000_000],
  mithqal: [1_000_000, 2_000_000_000],
  emami1: [1_000_000, 5_000_000_000],
  azadi1: [1_000_000, 5_000_000_000],
  azadi1_2: [100_000, 3_000_000_000],
  azadi1_4: [100_000, 3_000_000_000],
  azadi1g: [100_000, 3_000_000_000],
};

function absoluteOk(sourceKey: string, n: number): boolean {
  const [min, max] = ABSOLUTE[sourceKey] ?? [100, 20_000_000];
  return n >= min && n <= max;
}

/**
 * Price ÷ USD-toman for the symbols whose unit is not "1 of that currency".
 * JPY is 10 yen, AMD is 10 dram, IQD is 100 dinar. Gold is toman per unit.
 * 0.4×–2.5× of this ratio still passes; a 10× unit mistake does not.
 */
const PER_USD: Record<string, number> = {
  eur: 1.12,
  gbp: 1.32,
  chf: 1.2,
  cad: 0.7,
  aud: 0.7,
  aed: 0.27,
  try: 0.02,
  cny: 0.15,
  kwd: 3.23,
  sar: 0.27,
  qar: 0.27,
  bhd: 2.65,
  omr: 2.6,
  azn: 0.59,
  sgd: 0.78,
  hkd: 0.13,
  sek: 0.1,
  nok: 0.1,
  dkk: 0.15,
  rub: 0.012,
  thb: 0.03,
  inr: 0.011,
  myr: 0.23,
  afn: 0.015,
  jpy: 1 / 15.8,
  amd: 1 / 36,
  iqd: 1 / 15,
  gol18: 100,
  gol24: 133,
  silver: 2,
  mithqal: 430,
  emami1: 1000,
  azadi1: 970,
  azadi1_2: 520,
  azadi1_4: 280,
  azadi1g: 140,
};

/** Drop rows whose unit scaling is off relative to the dollar in the same payload. */
export function dropUnitErrors(quotes: BoardQuote[]): BoardQuote[] {
  const kept = quotes.filter((q) => absoluteOk(q.sourceKey, q.price));
  const usd = kept.find((q) => q.sourceKey === "usd")?.price;
  if (!usd) return kept;
  return kept.filter((q) => {
    const per = PER_USD[q.sourceKey];
    if (!per) return true;
    const ratio = q.price / usd / per;
    return ratio > 0.4 && ratio < 2.5;
  });
}
