import { expect, test } from "bun:test";
import { channelActionRow } from "./messages";

test("channel row deep-links the four prices into the bot", () => {
  const html = channelActionRow("DollarChandeBot");
  expect(html).toContain("https://t.me/DollarChandeBot?start=USD");
  expect(html).toContain("?start=USDT");
  expect(html).toContain("?start=GOLD18");
  expect(html).toContain("?start=EMAMI");
  expect(html.startsWith("<tg-button-row>")).toBe(true);
});
