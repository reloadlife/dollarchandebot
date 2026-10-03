import { expect, test } from "bun:test";
import type { Env } from "../env";
import { SYMBOLS, type SymbolDef } from "../symbols";
import type { LatestRow } from "../db/prices";
import { richCompare, richExchanges, richHelp, richHistory, richHome, richMulti, richSymbolPrice, richSymbols } from "./rich";

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
  expect(html).toContain("<tg-button-row>");
  expect(html).toContain('style="primary"');
  expect(html).toContain('data="s:USD:7d"');
  expect(html).toContain('data="a:new:USD"');
  expect(html).not.toContain("copy_text");
  const rows = html.split("<tg-button-row>").length - 1;
  expect(rows).toBe(2);
  expect(html).toContain("<table compact");
  expect(html).not.toContain("<pre>");
  expect(html).toContain("۷ روز");
  expect(html).not.toContain("free market");
  expect(html).not.toContain("24h pulse");
  expect(html).not.toContain("IRT");
});

test("silver card is نقره in toman and the ounce card is dollars", () => {
  const silver = SYMBOLS.find((s) => s.id === "SILVER")!;
  const xag = SYMBOLS.find((s) => s.id === "XAG")!;
  const silverHtml = richSymbolPrice(env, silver, { ...row, symbol: "SILVER", price: 522820 }, undefined, null, null, "fa");
  const ounceHtml = richSymbolPrice(env, xag, { ...row, symbol: "XAG", price: 60 }, undefined, null, null, "fa");
  expect(silverHtml).toContain("نقره");
  expect(silverHtml).toContain("تومان");
  expect(silverHtml).not.toContain("Silver Gram");
  expect(ounceHtml).toContain("انس نقره");
  expect(ounceHtml).toContain("دلار");
  expect(ounceHtml).not.toContain("تومان");
});

test("english symbol card keeps english book labels and a 24h caption", () => {
  const html = richSymbolPrice(env, usd, row, "https://example.test/c.png", null, null, "en", "24h");
  expect(html).toContain("Toman");
  expect(html).toContain("Buy");
  expect(html).toContain("Day high");
  expect(html).toContain("24h</tg-button>");
  expect(html).toContain("<tg-emoji");
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
  expect(hist).toContain("<table compact");
  expect(hist).toContain("تاریخچه");
  expect(hist).toContain("باز");
  expect(hist).not.toContain(">O <");
});

test("home shows the main prices and help hides the command list", () => {
  const quotes = new Map([
    ["USD", { price: 178850, prev_price: 178000 }],
    ["USDT", { price: 179000, prev_price: 179000 }],
  ]);
  const home = richHome(env, "fa", quotes);
  expect(home).toContain("دلار");
  expect(home).toContain("178,850");
  expect(home).toContain("سکه");
  expect(home).toContain("نقره");
  expect(home).not.toContain("جستجو · مرور");

  const help = richHelp(env, "fa");
  expect(help).toContain("<details>");
  expect(help).toContain("دستورها");
  expect(help.indexOf("نرخ بازار آزاد")).toBeLessThan(help.indexOf("<details>"));
});

test("exchange screen leads with the cheapest buy and an open book", () => {
  const ex = richExchanges(
    env,
    [
      { name: "نوبیتکس", buy: 178900, sell: 178400, mid: 178650, updated_at: 1 },
      { name: "والکس", buy: 179400, sell: 179100, mid: 179250, updated_at: 1 },
    ],
    "fa",
  );
  expect(ex).toContain("ارزان‌ترین خرید");
  expect(ex).toContain("بهترین فروش");
  expect(ex).toContain("<table compact");
  expect(ex).not.toContain("<details>");
  expect(ex).not.toContain("بالاترین");
  expect(ex.indexOf("ارزان‌ترین خرید")).toBeLessThan(ex.indexOf("نوبیتکس ·"));
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
  expect(html).toContain("دلار");
});

test("ounce history and a mixed snapshot keep dollars off the toman gram", () => {
  const hist = richHistory(
    env,
    "XAG",
    "⚪",
    [{ day: "2026-10-02", open: 58, high: 61, low: 57, close: 60 }],
    "fa",
  );
  expect(hist).toContain("انس نقره");
  expect(hist).toContain("دلار");
  expect(hist).not.toContain("تومان");

  const snap = richMulti(env, [{ id: "SILVER", emoji: "🥈", price: 522820 }, { id: "XAG", emoji: "⚪", price: 60 }], "fa");
  expect(snap).toContain("نقره");
  expect(snap).toContain("تومان");
  expect(snap).toContain("انس نقره");
  expect(snap).toContain("دلار");

  const list = richSymbols("fa");
  expect(list).toContain("طلا و نقره");
  expect(list).toContain("نقره");
  expect(list).not.toContain("Silver Gram");
});
