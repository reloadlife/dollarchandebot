import { expect, test } from "bun:test";
import { calculatePrice } from "./calculator";
import { freshness } from "./freshness";
test("merchant calculation validates inputs and rounds money", () => {
  expect(calculatePrice("100", 250_000, "1.1")).toBe(27_500_000);
  expect(calculatePrice("0", 250_000, "1")).toBe(0);
  for (const input of ["", "-1", "Infinity", "abc"]) expect(calculatePrice(input, 250_000, "1")).toBeNull();
  expect(calculatePrice("100", null, "1")).toBeNull();
  expect(calculatePrice("100", 250_000, "0")).toBeNull();
  expect(calculatePrice("1e300", 250_000, "1")).toBeNull();
});
test("freshness handles timestamp units and warns after twenty minutes", () => {
  const now = 1_800_000_000_000;
  expect(freshness(now / 1000 - 19 * 60, now).stale).toBe(false);
  expect(freshness(now - 20 * 60_000, now).stale).toBe(true);
  expect(freshness(null, now).stale).toBe(true);
  expect(freshness(now + 60_000, now).text).toContain("همین حالا");
});
