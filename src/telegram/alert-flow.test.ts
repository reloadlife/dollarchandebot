import { expect, test } from "bun:test";
import { decodePending, encodePending, parseAlertAmount } from "./alert-flow";

test("parseAlertAmount accepts ascii, grouped, and persian digits", () => {
  expect(parseAlertAmount("180000")).toBe(180000);
  expect(parseAlertAmount("180,000")).toBe(180000);
  expect(parseAlertAmount("۱۸۰۰۰۰")).toBe(180000);
  expect(parseAlertAmount("2.5")).toBe(2.5);
  expect(parseAlertAmount("USD")).toBeNull();
  expect(parseAlertAmount("0")).toBeNull();
  expect(parseAlertAmount("")).toBeNull();
});

test("pending alert round-trips", () => {
  const p = { symbol: "USD", direction: "above" as const, threshold: 180000 };
  expect(decodePending(encodePending(p))).toEqual(p);
  expect(decodePending("nope")).toBeNull();
  expect(decodePending(null)).toBeNull();
});
