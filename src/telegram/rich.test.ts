import { expect, test } from "bun:test";
import type { Env } from "../env";
import type { SymbolDef } from "../symbols";
import type { LatestRow } from "../db/prices";
import { richCompare, richExchanges, richHistory, richSymbolPrice } from "./rich";

const env = {
  CHANNEL_USERNAME: "AlanDollarChande",
  BOT_USERNAME: "DollarChandeBot",
} as Env;

const usd: SymbolDef = {
  id: "USD",
  sourceKey: "usd",
  source: "bonbast",
  name: "US Dollar",
  emoji: "💲",
  kind: "fx",
  aliases: [],
  channelList: true,
};

const row: LatestRow = {
  symbol: "USD",
  price: 178850,
  prev_price: 178730,
  buy: 178800,
  sell: 178900,
  source: "bonbast",
  updated_at: 1_700_000_000,
};

test("persian symbol card uses toman labels and the selected range", () => {
  const html = richSymbolPrice(
    env,
    usd,
    row,
    "https://example.test/chart/USD.png?r=7d",
    { high: 179200, low: 178400 },
    180000,
    "fa",
    "7d",
  );
  expect(html).toContain("تومان");
  expect(html).toContain("خرید");
  expect(html).toContain("فروش");
  expect(html).toContain("سقف امروز");
  expect(html).toContain("۷ روز");
  expect(html).not.toContain("free market");
  expect(html).not.toContain("24h pulse");
  expect(html).not.toContain("IRT");
});

test("english symbol card keeps english book labels and a 24h caption", () => {
  const html = richSymbolPrice(env, usd, row, "https://example.test/c.png", null, null, "en", "24h");
  expect(html).toContain("Toman");
  expect(html).toContain("Buy");
  expect(html).toContain("Day high");
  expect(html).toContain(">24h<");
});

test("exchange and history cards follow the chat language", () => {
  const ex = richExchanges(
    env,
    [{ name: "نوبیتکس", buy: 179000, sell: 178000, mid: 178500, updated_at: 1_700_000_000 }],
    "fa",
  );
  expect(ex).toContain("تتر در صرافی‌ها");
  expect(ex).toContain("می‌پردازی");

  const hist = richHistory(
    env,
    "USD",
    "💲",
    [{ day: "2026-09-01", open: 1, high: 2, low: 1, close: 2 }],
    "fa",
  );
  expect(hist).toContain("تاریخچه");
  expect(hist).toContain("باز");
  expect(hist).not.toContain(">O <");
});

test("compare uses the chat unit", () => {
  const html = richCompare(
    env,
    { id: "USD", name: "US Dollar", emoji: "💲", price: 100 },
    { id: "USDT", name: "Tether", emoji: "💰", price: 110 },
    "fa",
  );
  expect(html).toContain("تومان");
  expect(html).toContain("اختلاف");
});
