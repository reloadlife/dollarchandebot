import { expect, test } from "bun:test";
import { intervalLabel, parseEvery } from "./feeds";

test("parseEvery accepts the allowed gaps and an optional symbol", () => {
  expect(parseEvery("1h")).toEqual({ ok: true, off: false, everyMin: 60, symbol: null });
  expect(parseEvery("30m USD")).toEqual({ ok: true, off: false, everyMin: 30, symbol: "USD" });
  expect(parseEvery("USD 6h")).toEqual({ ok: true, off: false, everyMin: 360, symbol: "USD" });
  expect(parseEvery("1d")).toEqual({ ok: true, off: false, everyMin: 1440, symbol: null });
  expect(parseEvery("off")).toEqual({ ok: true, off: true });
  expect(parseEvery("5m").ok).toBe(false);
  expect(parseEvery("1h NOPE").ok).toBe(false);
  expect(parseEvery("")).toEqual({ ok: false, reason: "usage" });
});

test("interval labels stay short", () => {
  expect(intervalLabel(30, true)).toBe("30 دقیقه");
  expect(intervalLabel(60, false)).toBe("1h");
  expect(intervalLabel(1440, true)).toBe("1 روز");
});
