import { expect, test } from "bun:test";
import { fillMissing } from "./board";
import { parseTgju } from "./tgju";
import { parseAlanchand } from "./alanchand";
import { listBoards } from "../jobs";
import { scrapeAbanTether, scrapeBitbarg, scrapeRaastin } from "./exchanges";

const NOW = Date.parse("2026-10-02T12:00:00Z");

test("tgju maps rial, ounce, and the 10-yen / 10-dram / 100-dinar units", () => {
  const parsed = parseTgju(
    {
      current: {
        price_dollar_rl: { p: "2,584,650", ts: "2026-10-01 00:00:00" },
        price_jpy: { p: "1,632,110", ts: "2026-10-01 00:00:00" },
        price_amd: { p: "7,310", ts: "2026-10-01 00:00:00" },
        price_iqd: { p: "1,698", ts: "2026-10-01 00:00:00" },
        price_gbp: { p: "3,424,200", ts: "2018-05-29 14:00:00" },
        price_kwd: { p: "83,919,000", ts: "2026-10-01 00:00:00" },
        ons: { p: "4,142.22", ts: "2026-10-03 00:31:16" },
        geram18: { p: "256,944,000", ts: "2026-10-01 00:00:00" },
        sekee: { p: "2,603,950,000", ts: "2026-10-01 00:00:00" },
        "crypto-tether-irr": { p: "2,619,560", ts: "2026-10-02 00:00:00" },
        "usdt-irr": { p: "273,000", ts: "2020-11-11 17:00:00" },
      },
    },
    NOW,
  );
  const price = (key: string) => parsed.quotes.find((q) => q.sourceKey === key)?.price;
  expect(price("usd")).toBe(258465);
  expect(price("jpy")).toBe(16321);
  expect(price("amd")).toBe(7310);
  expect(price("iqd")).toBe(16980);
  expect(price("ounce")).toBe(4142);
  expect(price("gol18")).toBe(25694400);
  expect(price("emami1")).toBe(260395000);
  expect(price("gbp")).toBeUndefined();
  expect(price("kwd")).toBeUndefined();
  expect(parsed.usdt).toBe(261956);
  expect(parsed.quotes.every((q) => q.source === "tgju")).toBe(true);
});

test("alanchand reads toman cells and scales 100-yen and 100-dram", () => {
  const html = `
    <tr onclick="window.location='https://alanchand.com/currencies-price/usd'">
      <td class="buyPrice text-center">۲۶۱,۲۵۰</td>
      <td class="sellPrice text-center"> ۲۶۳,۹۰۰<span class="x"></span></td>
    </tr>
    <tr onclick="window.location='https://alanchand.com/currencies-price/usd-ist'">
      <td class="buyPrice text-center">۲۰۰,۰۰۰</td>
      <td class="sellPrice text-center">۲۱۰,۰۰۰</td>
    </tr>
    <tr onclick="window.location='https://alanchand.com/currencies-price/jpy'">
      <td class="buyPrice text-center">۱۶۳,۹۰۰</td>
      <td class="sellPrice text-center">۱۶۷,۲۰۰</td>
    </tr>
    <tr onclick="window.location='https://alanchand.com/currencies-price/amd'">
      <td class="buyPrice text-center">۷۱,۳۴۰</td>
      <td class="sellPrice text-center">۷۲,۸۰۰</td>
    </tr>
    <tr onclick="window.location='https://alanchand.com/currencies-price/iqd'">
      <td class="buyPrice text-center">۱۶,۴۲۰</td>
      <td class="sellPrice text-center">۱۶,۷۶۰</td>
    </tr>
    <a href="https://alanchand.com/gold-price/18ayar" class="fs-6 fw-bold">طلا</a>
    <span class="priceSymbol no_change fs-4 fw-bold">۲۵,۷۰۰,۰۰۰ تومان</span>
    <a href="https://alanchand.com/gold-price/usd_xau" class="fs-6 fw-bold">انس</a>
    <span class="priceSymbol no_change fs-4 fw-bold">۱۱۲,۰۰۰,۰۰۰ تومان</span>
    <a href="https://alanchand.com/crypto-price/usdt">تتر</a>
    <span class="fw-bold text-primary fs-5"> ۲۶۲,۵۰۰ </span>
  `;
  const parsed = parseAlanchand(html);
  const row = (key: string) => parsed.quotes.find((q) => q.sourceKey === key);
  expect(row("usd")?.price).toBe(262575);
  expect(row("usd")?.buy).toBe(261250);
  expect(row("usd")?.sell).toBe(263900);
  expect(row("jpy")?.price).toBe(16555);
  expect(row("amd")?.price).toBe(7207);
  expect(row("iqd")?.price).toBe(16590);
  expect(row("usd-ist")).toBeUndefined();
  expect(row("gol18")?.price).toBe(25700000);
  expect(row("ounce")).toBeUndefined();
  expect(parsed.usdt?.mid).toBe(262500);
  expect(parsed.quotes.every((q) => q.source === "alanchand")).toBe(true);
});

test("alanchand keeps a USD ounce and ignores a toman one", () => {
  const html = `
    <tr onclick="window.location='https://alanchand.com/currencies-price/usd'">
      <td class="buyPrice">۲۶۰,۰۰۰</td><td class="sellPrice">۲۶۰,۰۰۰</td>
    </tr>
    <a href="https://alanchand.com/gold-price/usd_xau"></a>
    <span class="fs-4 fw-bold">۴,۱۴۲</span>
  `;
  expect(parseAlanchand(html).quotes.find((q) => q.sourceKey === "ounce")?.price).toBe(4142);
});

test("fillMissing keeps the first board for a symbol", () => {
  const out = fillMissing(
    [{ sourceKey: "usd", price: 1, buy: 1, sell: 1, source: "bonbast" }],
    [
      { sourceKey: "USD", price: 9, buy: null, sell: 9, source: "tgju" },
      { sourceKey: "eur", price: 2, buy: null, sell: 2, source: "tgju" },
    ],
  );
  expect(out.map((q) => `${q.sourceKey}:${q.source}`)).toEqual(["usd:bonbast", "eur:tgju"]);
});

test("listBoards appends tgju and alanchand and sorts by mid", () => {
  const listed = listBoards(
    [{ exchange: "nobitex", name: "Nobitex", buy: 263000, sell: 261000, mid: 262000 }],
    261500,
    { buy: 262500, sell: 262500, mid: 262500 },
  );
  expect(listed.map((q) => q.exchange)).toEqual(["tgju", "nobitex", "alanchand"]);
});

function stubJson(body: unknown) {
  const orig = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } })) as typeof fetch;
  return () => {
    globalThis.fetch = orig;
  };
}

test("raastin ask is the buy and bid is the sell", async () => {
  const restore = stubJson({
    asks: [{ price: "263000" }],
    bids: [{ price: "261261" }],
    last_trade: { price: "262238" },
  });
  try {
    const q = await scrapeRaastin();
    expect(q.exchange).toBe("raastin");
    expect(q.buy).toBe(263000);
    expect(q.sell).toBe(261261);
    expect(q.mid).toBe(262238);
  } finally {
    restore();
  }
});

test("abantether reads the USDTIRT market", async () => {
  const restore = stubJson({
    data: { markets: { USDTIRT: { symbol: "USDT", buy_price: "263242", sell_price: "261793" } } },
  });
  try {
    const q = await scrapeAbanTether();
    expect(q.buy).toBe(263242);
    expect(q.sell).toBe(261793);
  } finally {
    restore();
  }
});

test("bitbarg uses the last chart point, not the USD peg", async () => {
  const restore = stubJson({
    result: { items: [{ coin: "USDT", price: 1, chart: [260000, 264500] }] },
  });
  try {
    expect((await scrapeBitbarg()).mid).toBe(264500);
  } finally {
    restore();
  }
});
