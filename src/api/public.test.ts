import { expect, test } from "bun:test";
import { matchApiPath } from "./public";

test("public api paths", () => {
  expect(matchApiPath("/health")).toBeNull();
  expect(matchApiPath("/api/v1")).toEqual({ kind: "index" });
  expect(matchApiPath("/api/v1/")).toEqual({ kind: "index" });
  expect(matchApiPath("/api/v1/latest")).toEqual({ kind: "latest" });
  expect(matchApiPath("/api/v1/symbols")).toEqual({ kind: "symbols" });
  expect(matchApiPath("/api/v1/exchanges")).toEqual({ kind: "exchanges" });
  expect(matchApiPath("/api/v1/symbols/usd")).toEqual({ kind: "symbol", id: "USD" });
  expect(matchApiPath("/api/v1/symbols/GOLD18/ohlc")).toEqual({ kind: "ohlc", id: "GOLD18" });
  expect(matchApiPath("/api/v1/symbols/USDT/ticks")).toEqual({ kind: "ticks", id: "USDT" });
  expect(matchApiPath("/api/v1/nope")).toEqual({ kind: "unknown" });
});
