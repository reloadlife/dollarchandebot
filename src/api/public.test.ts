import { expect, test } from "bun:test";
import { matchApiPath } from "./public";

const DOCUMENTED = [
  "GET /api/v1/latest",
  "GET /api/v1/symbols",
  "GET /api/v1/symbols/:id",
  "GET /api/v1/symbols/:id/ticks",
  "GET /api/v1/symbols/:id/ohlc",
  "GET /api/v1/exchanges",
  "GET /chart/{ID}.png",
] as const;

test("route matcher covers the documented public paths", () => {
  expect(matchApiPath("/api/v1/latest")).toEqual({ kind: "latest" });
  expect(matchApiPath("/api/v1/symbols")).toEqual({ kind: "symbols" });
  expect(matchApiPath("/api/v1/symbols/USD")).toEqual({ kind: "symbol", id: "USD" });
  expect(matchApiPath("/api/v1/symbols/USD/ticks")).toEqual({ kind: "ticks", id: "USD" });
  expect(matchApiPath("/api/v1/symbols/USD/ohlc")).toEqual({ kind: "ohlc", id: "USD" });
  expect(matchApiPath("/api/v1/exchanges")).toEqual({ kind: "exchanges" });
  expect(matchApiPath("/chart/USD.png")).toBeNull();
});

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

test("built API document lists routes, fields, and the key rule", async () => {
  const html = await Bun.file(new URL("../../web/out/developers/index.html", import.meta.url)).text();
  for (const path of DOCUMENTED) {
    expect(html).toContain(path);
  }
  for (const field of ["price", "prev_price", "buy", "sell", "unit", "toman", "updated_at"]) {
    expect(html).toContain(field);
  }
  expect(html).toContain("1");
  expect(html).toContain("90");
  expect(html).toContain("Origin");
  expect(html).toContain("401");
  expect(html).toContain("افزونه بدون کلید کار نمی‌کند");
  expect(html).not.toContain("No API key");
  expect(html).not.toMatch(/افزونه[^<]{0,80}کلید نمی‌خواهد/);
});
