import { expect, test } from "bun:test";
import type { ExchangeRow } from "../db/exchanges";
import { channelActionRow, renderUsdtSection } from "./messages";

function venue(
  exchange: string,
  name: string,
  buy: number,
  sell: number,
): ExchangeRow {
  return { exchange, name, buy, sell, mid: Math.round((buy + sell) / 2), updated_at: 1 };
}

test("channel row deep-links the four prices into the bot", () => {
  const html = channelActionRow("DollarChandeBot");
  expect(html).toContain("https://t.me/DollarChandeBot?start=USD");
  expect(html).toContain("?start=USDT");
  expect(html).toContain("?start=GOLD18");
  expect(html).toContain("?start=EMAMI");
  expect(html.startsWith("<tg-button-row>")).toBe(true);
});

test("tether section is a summary table, then a collapsed buy/sell book", () => {
  const html = renderUsdtSection(
    179200,
    178850,
    [venue("wallex", "والکس", 179400, 179100), venue("nobitex", "نوبیتکس", 178900, 178400)],
    0,
  );
  expect(html).toContain("<h3>تتر</h3>");
  expect(html).toContain("179,200");
  expect(html).toContain("+350");
  expect(html).toContain("گران‌تر");
  expect(html).toContain("ارزان‌ترین خرید");
  expect(html).toContain("نوبیتکس · 178,900");
  expect(html).toContain("بهترین فروش");
  expect(html).toContain("والکس · 179,100");
  expect(html.indexOf("اختلاف با دلار")).toBeLessThan(html.indexOf("<details>"));
  expect(html).toContain("<summary>خرید و فروش</summary>");
  expect(html).not.toContain("آربیتراژ");
  expect(html).not.toContain("بالاترین");
});

test("a stale tether price is marked old and is not compared with the dollar", () => {
  const html = renderUsdtSection(179200, 178850, [], 40 * 60);
  expect(html).toContain("قدیمی");
  expect(html).not.toContain("اختلاف با دلار");
});
