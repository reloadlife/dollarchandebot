import { expect, test } from "bun:test";
import { bucketForTicks, candlesFromDays, candlesFromTicks, formatAxisPrice } from "./candles";

test("a single tick is one doji", () => {
  const bars = candlesFromTicks([{ ts: 1_700_000_000, price: 100 }]);
  expect(bars).toEqual([{ ts: 1_699_999_200, open: 100, high: 100, low: 100, close: 100 }]);
});

test("ticks inside two hours use 15 minute candles", () => {
  const start = 1_699_999_200;
  const ticks = [0, 10 * 60, 20 * 60, 50 * 60, 70 * 60].map((offset, index) => ({
    ts: start + offset,
    price: 100 + index,
  }));
  expect(bucketForTicks(ticks)).toBe(15 * 60);
  const bars = candlesFromTicks(ticks);
  expect(bars).toHaveLength(4);
  expect(bars[0]).toEqual({ ts: start, open: 100, high: 101, low: 100, close: 101 });
  expect(bars[3]).toEqual({ ts: start + 60 * 60, open: 104, high: 104, low: 104, close: 104 });
});

test("a full day of ticks becomes hourly candles", () => {
  const start = 1_700_000_000;
  const ticks = Array.from({ length: 288 }, (_, index) => ({
    ts: start + index * 5 * 60,
    price: 200 + (index % 12),
  }));
  expect(bucketForTicks(ticks)).toBe(60 * 60);
  const bars = candlesFromTicks(ticks);
  expect(bars.length).toBeGreaterThanOrEqual(23);
  expect(bars.length).toBeLessThanOrEqual(25);
  expect(bars[0].high).toBeGreaterThan(bars[0].low);
});

test("daily candles keep the last seven days", () => {
  const days = Array.from({ length: 14 }, (_, index) => ({
    open: index,
    high: index + 2,
    low: index - 1,
    close: index + 1,
  }));
  const bars = candlesFromDays(days, 7);
  expect(bars).toHaveLength(7);
  expect(bars[0].open).toBe(7);
  expect(bars[6].close).toBe(14);
});

test("axis labels stay short for a coin and exact for a dollar", () => {
  expect(formatAxisPrice(258_650, 2_000)).toBe("۲۵۸٬۶۵۰");
  const coin = formatAxisPrice(256_760_000, 4_000_000);
  expect(coin.endsWith("م")).toBe(true);
  expect(coin.length).toBeLessThan(10);
});

test("empty input draws nothing", () => {
  expect(candlesFromTicks([])).toEqual([]);
  expect(candlesFromDays([])).toEqual([]);
});
