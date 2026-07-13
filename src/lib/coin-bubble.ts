/**
 * حباب سکه — market price vs melt value from 18k gold/gram.
 *
 * Specs: official Bahar Azadi family (weight × 900 fineness).
 * melt = pure_gold_g × (GOLD18_per_g / 0.750)
 * bubble = market − melt
 */

export interface CoinSpec {
  id: string;
  /** Total weight in grams */
  weightG: number;
  /** Fineness 0–1 (Iranian coins are 900 / 0.900) */
  fineness: number;
}

/** Pure gold grams = weight × fineness */
export function pureGoldGrams(spec: CoinSpec): number {
  return spec.weightG * spec.fineness;
}

/**
 * Iranian free-market coin specs (CBI-style weights, 900 fine).
 * Emami / Azadi full: 8.133g · half 4.0665 · quarter 2.03325 · gerami ~1.011g
 */
export const COIN_SPECS: Record<string, CoinSpec> = {
  EMAMI: { id: "EMAMI", weightG: 8.133, fineness: 0.9 },
  AZADI: { id: "AZADI", weightG: 8.133, fineness: 0.9 },
  HALF: { id: "HALF", weightG: 4.0665, fineness: 0.9 },
  QUARTER: { id: "QUARTER", weightG: 2.03325, fineness: 0.9 },
  GERAMI: { id: "GERAMI", weightG: 1.011, fineness: 0.9 },
};

/** 18k (750) → pure gold price per gram */
export function pureGoldPerGramFrom18k(gold18PerG: number): number {
  return gold18PerG / 0.75;
}

export interface CoinBubble {
  pureG: number;
  /** Equivalent grams of 18k metal */
  gold18EqG: number;
  melt: number;
  market: number;
  bubble: number;
  bubblePct: number;
}

/**
 * @param market Coin mid/market price (Toman)
 * @param gold18PerG 18k gold price per gram (Toman)
 */
export function calcCoinBubble(market: number, gold18PerG: number, spec: CoinSpec): CoinBubble {
  const pureG = pureGoldGrams(spec);
  const purePerG = pureGoldPerGramFrom18k(gold18PerG);
  const melt = pureG * purePerG;
  const gold18EqG = pureG / 0.75;
  const bubble = market - melt;
  const bubblePct = melt > 0 ? (bubble / melt) * 100 : 0;
  return { pureG, gold18EqG, melt, market, bubble, bubblePct };
}
