import { expect, test } from "bun:test";
import { medianUsdt } from "./jobs";

test("medianUsdt ignores nulls, averages even counts", () => {
  expect(medianUsdt([])).toBe(null);
  expect(medianUsdt([{ mid: null }])).toBe(null);
  expect(medianUsdt([{ mid: 3 }, { mid: 1 }, { mid: 2 }])).toBe(2);
  expect(medianUsdt([{ mid: 100 }, { mid: 101 }, { mid: null }])).toBe(101); // rounds .5 up
});
