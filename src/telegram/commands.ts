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
  { command: "start", description: "🏠 Home" },
  { command: "help", description: "❓ How to use the bot" },
  { command: "symbols", description: "📋 Browse symbols" },
  { command: "exchanges", description: "🏦 USDT by exchange" },
  { command: "compare", description: "⚖️ Compare two symbols" },
  { command: "history", description: "📅 7-day history" },
  { command: "alert", description: "🔔 Price alert" },
  { command: "alerts", description: "🔔 Your alerts" },
  { command: "settings", description: "⚙️ Language and fee" },
  { command: "key", description: "🔑 API key for plugins" },
  { command: "calc", description: "🧮 Calculator" },
];

export const COMMANDS_FA: BotCommand[] = [
  { command: "start", description: "🏠 خانه" },
  { command: "help", description: "❓ راهنما" },
  { command: "symbols", description: "📋 نمادها" },
  { command: "exchanges", description: "🏦 تتر در صرافی‌ها" },
  { command: "compare", description: "⚖️ مقایسه دو نماد" },
  { command: "history", description: "📅 تاریخچه ۷ روز" },
  { command: "alert", description: "🔔 هشدار قیمت" },
  { command: "alerts", description: "🔔 هشدارهای شما" },
  { command: "settings", description: "⚙️ زبان و کارمزد" },
  { command: "key", description: "🔑 کلید API" },
  { command: "calc", description: "🧮 ماشین‌حساب" },
];

/** Shown in groups instead of the private command list. */
export const GROUP_COMMANDS_EN: BotCommand[] = [
  { command: "every", description: "⏱ Post the board on a timer" },
  { command: "start", description: "🏠 Price now" },
  { command: "help", description: "❓ Help" },
];

export const GROUP_COMMANDS_FA: BotCommand[] = [
  { command: "every", description: "⏱ پیام گروه، با فاصله" },
  { command: "start", description: "🏠 نرخ الان" },
  { command: "help", description: "❓ راهنما" },
];

const SHORT_EN = "Free-market FX, gold, silver & USDT · charts · calc";
const SHORT_FA = "نرخ آزاد ارز، طلا، نقره و تتر · نمودار · ماشین‌حساب";

const DESC_EN = [
  "Live Iranian free-market rates: FX, gold, silver, and USDT (Toman).",
  "",
  "• Send USD or $USDT for price + 24h chart",
  "• Calculator: 10 USDT + 5 EUR",
  "• Inline: @DollarChandeBot USD",
  "• /exchanges · /alert · /compare · /help",
  "",
  "Channel: @AlanDollarChande",
].join("\n");

const DESC_FA = [
  "نرخ زنده بازار آزاد: ارز، طلا، نقره و تتر (تومان).",
  "",
  "• بفرست USD یا $USDT → قیمت + نمودار ۲۴س",
  "• ماشین‌حساب: 10 USDT + 5 EUR",
  "• اینلاین: @DollarChandeBot USD",
  "• /exchanges · /alert · /compare · /help",
  "",
  "کانال: @AlanDollarChande",
].join("\n");

/** Bump when the command list changes so the next cron calls setMyCommands. */
export const BOT_MENU_VER = "2026-10-02-silver";
export const BOT_MENU_KV = "bot:menu_ver";

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
      // In groups these commands are visible only to the person who sent them.
      commands: loc.commands.map((c) => ({ ...c, is_ephemeral: true })),
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

  const groupLocales: Array<{ code?: string; commands: BotCommand[] }> = [
    { commands: GROUP_COMMANDS_EN },
    { code: "en", commands: GROUP_COMMANDS_EN },
    { code: "fa", commands: GROUP_COMMANDS_FA },
  ];
  for (const loc of groupLocales) {
    await callTelegram(env, "setMyCommands", {
      commands: loc.commands,
      ...(loc.code ? { language_code: loc.code } : {}),
      scope: { type: "all_group_chats" },
    });
  }

  // Menu button = commands list (opens "/" menu)
  await callTelegram(env, "setChatMenuButton", {
    menu_button: { type: "commands" },
  });

  return { ok: true, locales: done };
}

/** setMyCommands now, and record the version so cron does not repeat it. */
export async function publishBotMenu(env: Env): Promise<{ ok: true; locales: string[] }> {
  const menu = await setupBotMenu(env);
  await env.CACHE.put(BOT_MENU_KV, BOT_MENU_VER);
  return menu;
}
