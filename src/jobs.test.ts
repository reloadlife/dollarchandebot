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
