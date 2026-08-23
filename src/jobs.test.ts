import { expect, test } from "bun:test";
import { medianUsdt } from "./jobs";

test("medianUsdt ignores nulls, averages even counts", () => {
  expect(medianUsdt([])).toBe(null);
  expect(medianUsdt([{ mid: null }])).toBe(null);
  expect(medianUsdt([{ mid: 3 }, { mid: 1 }, { mid: 2 }])).toBe(2);
  expect(medianUsdt([{ mid: 100 }, { mid: 101 }, { mid: null }])).toBe(101); // rounds .5 up
});

import { scrapeTgjuUsdt } from "./scrape/tgju";

test("tgju parses the rial tether quote into toman", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ current: { "crypto-tether-irr": { p: "1,978,000" }, "usdt-irr": { p: "273,000" } } }),
      { headers: { "content-type": "application/json" } },
    )) as typeof fetch;
  try {
    expect(await scrapeTgjuUsdt()).toBe(197800);
  } finally {
    globalThis.fetch = orig;
  }
});

test("tgju rejects an out-of-range quote instead of publishing it", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ current: { "crypto-tether-irr": { p: "12" } } }))) as typeof fetch;
  try {
    await expect(scrapeTgjuUsdt()).rejects.toThrow(/unusable/);
  } finally {
    globalThis.fetch = orig;
  }
});

import { scrapeUbitex, scrapeArzplus } from "./scrape/exchanges";

function stubHtml(html: string) {
  const orig = globalThis.fetch;
  globalThis.fetch = (async () => new Response(html, { headers: { "content-type": "text/html" } })) as typeof fetch;
  return () => {
    globalThis.fetch = orig;
  };
}

test("ubitex price is read from the row anchored on the USDT icon", async () => {
  const restore = stubHtml(
    '<img src="/_next/image?url=https%3A%2F%2Fapi.ubitex.io%2Fcdn%2Ficons%2Fusdt.svg&w=64"/>' +
      '<span>تتر</span><span>USDT</span></div><div class="x">197,985</div><div>$1</div>',
  );
  try {
    expect((await scrapeUbitex()).mid).toBe(197985);
  } finally {
    restore();
  }
});

test("arzplus price parses persian digits", async () => {
  const restore = stubHtml('<p class="symbol">USDT</p><div class="price"><p class="toman"> ۱۹۷,۷۲۳ <span>تومان</span></p>');
  try {
    expect((await scrapeArzplus()).mid).toBe(197723);
  } finally {
    restore();
  }
});

import { scrapeBit24, scrapePooleno } from "./scrape/exchanges";

test("bit24 reads each_price from the OTC host", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        data: { results: [{ symbol: "BTC", each_price: "15135474024" }, { symbol: "USDT", each_price: "196613.2" }] },
      }),
    )) as typeof fetch;
  try {
    expect((await scrapeBit24()).mid).toBe(196613);
  } finally {
    globalThis.fetch = orig;
  }
});

test("pooleno reads the schema.org block without buffering the whole page", async () => {
  const orig = globalThis.fetch;
  const head = '<script type="application/ld+json">{"@type":"ExchangeRateSpecification","price":197336,"priceCurrency":"IRR"}</script>';
  globalThis.fetch = (async () => new Response(head + "x".repeat(500_000))) as typeof fetch;
  try {
    expect((await scrapePooleno()).mid).toBe(197336);
  } finally {
    globalThis.fetch = orig;
  }
});
