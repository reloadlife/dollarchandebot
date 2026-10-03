import { expect, test } from "bun:test";
import { crossThreshold } from "./alert-flow";
import { parseCallback, symbolCardKeyboard } from "./ui";
import { formatUsage } from "../db/usage";

test("a crossing alert sits one unit above the printed price", () => {
  expect(crossThreshold(168450.4)).toEqual({ shown: 168450, threshold: 168451 });
  expect(crossThreshold(2650)).toEqual({ shown: 2650, threshold: 2651 });
});

test("the price screen offers the filled alert and both group actions", () => {
  const kb = symbolCardKeyboard("fa", "USD", 168450, "fx", "DollarChandeBot");
  const flat = kb.inline_keyboard.flat();
  const alert = flat.find((b) => b.callback_data === "a:at:USD");
  expect(alert?.text).toBe("وقتی از 168,450 گذشت خبر بده");
  expect(flat.some((b) => b.switch_inline_query === "USD")).toBe(true);
  expect(flat.some((b) => b.url === "https://t.me/DollarChandeBot?startgroup=feed_USD")).toBe(true);
  expect(parseCallback("a:at:usd")).toEqual({ type: "alertAt", id: "USD" });
});

test("usage text sums the three plugin downloads", () => {
  const text = formatUsage("fa", {
    day: "2026-10-03",
    today: { start: 2, dl_woocommerce: 3, dl_wordpress: 1 },
    total: { alert: 4, feed: 1, dl_whmcs: 2 },
  });
  expect(text).toContain("شروع ربات · 2");
  expect(text).toContain("دانلود افزونه · 4");
  expect(text).toContain("دانلود افزونه · 2");
  expect(text).not.toContain("chat");
});
