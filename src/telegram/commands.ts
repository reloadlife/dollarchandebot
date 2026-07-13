/**
 * Bot command menu (setMyCommands) + profile descriptions.
 * Telegram shows these in the "/" menu per user language.
 */

import type { Env } from "../env";
import { callTelegram } from "./api";

export interface BotCommand {
  command: string;
  description: string;
}

/** Primary menu — keep short; full list lives in /help */
export const COMMANDS_EN: BotCommand[] = [
  { command: "start", description: "Home · browse · alerts" },
  { command: "help", description: "How to use the bot" },
  { command: "symbols", description: "Browse symbols by category" },
  { command: "exchanges", description: "USDT buy/sell by exchange" },
  { command: "compare", description: "Compare two symbols" },
  { command: "history", description: "7-day OHLC history" },
  { command: "alert", description: "Price alert (once or every)" },
  { command: "alerts", description: "Your alerts (tap to manage)" },
  { command: "settings", description: "Language & default fee" },
  { command: "calc", description: "Currency calculator" },
];

export const COMMANDS_FA: BotCommand[] = [
  { command: "start", description: "خانه · مرور · هشدار" },
  { command: "help", description: "راهنمای کامل" },
  { command: "symbols", description: "مرور نمادها بر اساس دسته" },
  { command: "exchanges", description: "قیمت تتر در صرافی‌ها" },
  { command: "compare", description: "مقایسه دو نماد" },
  { command: "history", description: "تاریخچه ۷ روزه" },
  { command: "alert", description: "هشدار قیمت (یک‌بار یا تکراری)" },
  { command: "alerts", description: "هشدارها (مدیریت با دکمه)" },
  { command: "settings", description: "زبان و کارمزد" },
  { command: "calc", description: "ماشین‌حساب ارز" },
];

const SHORT_EN = "Free-market FX, gold & USDT · charts · calc";
const SHORT_FA = "نرخ آزاد ارز، طلا و تتر · نمودار · ماشین‌حساب";

const DESC_EN = [
  "Live Iranian free-market rates (Toman).",
  "",
  "• Send USD or $USDT for price + 24h chart",
  "• Calculator: 10 USDT + 5 EUR",
  "• Inline: @DollarChandeBot USD",
  "• /exchanges · /alert · /compare · /help",
  "",
  "Channel: @AlanDollarChande",
].join("\n");

const DESC_FA = [
  "نرخ زنده بازار آزاد (تومان).",
  "",
  "• بفرست USD یا $USDT → قیمت + نمودار ۲۴س",
  "• ماشین‌حساب: 10 USDT + 5 EUR",
  "• اینلاین: @DollarChandeBot USD",
  "• /exchanges · /alert · /compare · /help",
  "",
  "کانال: @AlanDollarChande",
].join("\n");

/** language_code for setMyCommands / descriptions. Empty = default (fallback). */
const LOCALES: Array<{ code?: string; commands: BotCommand[]; short: string; desc: string }> = [
  { commands: COMMANDS_EN, short: SHORT_EN, desc: DESC_EN }, // default fallback
  { code: "en", commands: COMMANDS_EN, short: SHORT_EN, desc: DESC_EN },
  { code: "fa", commands: COMMANDS_FA, short: SHORT_FA, desc: DESC_FA },
  // Note: Telegram language_code is ISO 639-1 (e.g. "fa"), not "fa-IR"
];

export async function setupBotMenu(env: Env): Promise<{ ok: true; locales: string[] }> {
  const done: string[] = [];

  for (const loc of LOCALES) {
    const tag = loc.code ?? "default";
    await callTelegram(env, "setMyCommands", {
      commands: loc.commands,
      ...(loc.code ? { language_code: loc.code } : {}),
      scope: { type: "default" },
    });
    await callTelegram(env, "setMyShortDescription", {
      short_description: loc.short,
      ...(loc.code ? { language_code: loc.code } : {}),
    });
    await callTelegram(env, "setMyDescription", {
      description: loc.desc,
      ...(loc.code ? { language_code: loc.code } : {}),
    });
    done.push(tag);
  }

  // Menu button = commands list (opens "/" menu)
  await callTelegram(env, "setChatMenuButton", {
    menu_button: { type: "commands" },
  });

  return { ok: true, locales: done };
}
