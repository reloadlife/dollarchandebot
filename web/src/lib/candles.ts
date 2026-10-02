import { fa, faNumber } from "./utils";

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface TickPoint {
  ts: number;
  price: number;
}

const QUARTER = 15 * 60;
const HALF = 30 * 60;
const HOUR = 60 * 60;
/** Keep the 24h strip readable in the sidebar. */
const MAX_BARS = 32;

/** Finest of 15m, 30m, 60m that stays within MAX_BARS across the tick span. */
export function bucketForTicks(ticks: TickPoint[]): number {
  if (ticks.length < 2) return HOUR;
  const span = Math.max(0, ticks[ticks.length - 1].ts - ticks[0].ts);
  for (const bucket of [QUARTER, HALF, HOUR]) {
    if (Math.floor(span / bucket) + 1 <= MAX_BARS) return bucket;
  }
  return HOUR;
}

function candle(price: number): Candle {
  return { open: price, high: price, low: price, close: price };
}

/** One candle per bucket. A bucket with a single tick is a doji. Empty buckets are skipped. */
export function candlesFromTicks(ticks: TickPoint[], bucketSec = bucketForTicks(ticks)): Candle[] {
  const sorted = ticks
    .filter((tick) => Number.isFinite(tick.ts) && Number.isFinite(tick.price))
    .sort((a, b) => a.ts - b.ts);
  if (!sorted.length || bucketSec <= 0) return [];
  const buckets = new Map<number, Candle>();
  for (const tick of sorted) {
    const key = Math.floor(tick.ts / bucketSec) * bucketSec;
    const bar = buckets.get(key);
    if (!bar) {
      buckets.set(key, candle(tick.price));
      continue;
    }
    bar.high = Math.max(bar.high, tick.price);
    bar.low = Math.min(bar.low, tick.price);
    bar.close = tick.price;
  }
  return [...buckets.keys()].sort((a, b) => a - b).map((key) => buckets.get(key)!);
}

/** Short scale label. Millions use «م» so a narrow board can show the number. */
export function formatAxisPrice(n: number, span: number): string {
  if (Math.abs(n) >= 1_000_000 || span >= 1_000_000) {
    const digits = span >= 5_000_000 ? 0 : span >= 500_000 ? 1 : 2;
    return `${fa(Math.abs(n / 1_000_000).toFixed(digits))} م`;
  }
  return faNumber(n);
}

export interface DayBar {
  open: number;
  high: number;
  low: number;
  close: number;
}

/** Last `limit` daily bars, oldest first. */
export function candlesFromDays(days: DayBar[], limit = 7): Candle[] {
  const usable = days.filter(
    (day) =>
      Number.isFinite(day.open) &&
      Number.isFinite(day.high) &&
      Number.isFinite(day.low) &&
      Number.isFinite(day.close),
  );
  return usable.slice(-limit).map((day) => ({
    open: day.open,
    high: Math.max(day.high, day.open, day.close),
    low: Math.min(day.low, day.open, day.close),
    close: day.close,
  }));
}
