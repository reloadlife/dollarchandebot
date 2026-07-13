/**
 * Screen-based bot UI: keyboards, HTML shells, edit-or-send.
 * Callback data is short and stateless (see plan).
 */

import type { Env } from "../env";
import type { Lang } from "../db/settings";
import type { AlertRow } from "../db/alerts";
import type { SymbolDef, SymbolKind } from "../symbols";
import { popularSymbols, symbolsByKind } from "../symbols";
import { t } from "../lib/i18n";
import { escapeHtml } from "../lib/format";
import {
  editRichMessage,
  sendMessage,
  sendRichMessage,
  TelegramError,
} from "./api";
import {
  richHelp,
  richSettings,
  richStart,
  richExchanges,
  richHistory,
  richSymbolPrice,
} from "./rich";
import type { LatestRow } from "../db/prices";
import type { ChartRange } from "../chart/serve";

export type InlineBtn = {
  text: string;
  callback_data?: string;
  url?: string;
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
};

export type InlineKeyboard = { inline_keyboard: InlineBtn[][] };

export type Screen = {
  html: string;
  keyboard: InlineKeyboard;
};

export type ShowTarget = {
  chatId: string | number;
  /** If set, edit this message instead of sending a new one */
  messageId?: number;
  /** Reply-to for new sends only */
  replyTo?: number;
};

const PAGE_SIZE = 9; // 3×3
const COLS = 3;

function channelUrl(env: Env): string {
  return `https://t.me/${env.CHANNEL_USERNAME}`;
}

function btn(text: string, data: string): InlineBtn {
  return { text, callback_data: data };
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// —— Keyboards ——

export function homeKeyboard(env: Env, lang: Lang): InlineKeyboard {
  const pop = popularSymbols().slice(0, 5);
  const popRow = pop.map((s) => btn(`${s.emoji} ${s.id}`, `s:${s.id}`));
  // wrap popular into rows of 3
  const popRows = chunk(popRow, 3);
  return {
    inline_keyboard: [
      ...popRows,
      [
        btn(t(lang, "uiBrowse"), "b:c"),
        {
          text: t(lang, "uiSearch"),
          switch_inline_query_current_chat: "",
        },
      ],
      [btn(t(lang, "uiExchanges"), "x"), btn(t(lang, "uiAlerts"), "a")],
      [btn(t(lang, "uiSettings"), "set"), btn(t(lang, "uiHelp"), "help")],
      [
        {
          text: t(lang, "uiShare"),
          switch_inline_query: "USD",
        },
        { text: t(lang, "uiChannel"), url: channelUrl(env) },
      ],
    ],
  };
}

export function categoriesKeyboard(lang: Lang): InlineKeyboard {
  return {
    inline_keyboard: [
      [btn(t(lang, "uiCatFx"), "b:fx:0"), btn(t(lang, "uiCatGold"), "b:gold:0")],
      [
        btn(t(lang, "uiCatCoin"), "b:coin:0"),
        btn(t(lang, "uiCatCrypto"), "b:crypto:0"),
      ],
      [
        {
          text: t(lang, "uiSearch"),
          switch_inline_query_current_chat: "",
        },
        btn(t(lang, "uiHome"), "h"),
      ],
    ],
  };
}

export function symbolListKeyboard(
  lang: Lang,
  kind: SymbolKind,
  page: number,
): InlineKeyboard {
  const all = symbolsByKind(kind);
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const p = Math.min(Math.max(0, page), pages - 1);
  const slice = all.slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE);

  const rows: InlineBtn[][] = chunk(
    slice.map((s) => btn(`${s.emoji} ${s.id}`, `s:${s.id}`)),
    COLS,
  );

  if (pages > 1) {
    const prev = p > 0 ? btn("◀", `b:${kind}:${p - 1}`) : btn("·", "noop");
    const next =
      p < pages - 1 ? btn("▶", `b:${kind}:${p + 1}`) : btn("·", "noop");
    rows.push([
      prev,
      btn(`${p + 1}/${pages}`, "noop"),
      next,
    ]);
  }

  rows.push([
    btn(t(lang, "uiBack"), "b:c"),
    btn(t(lang, "uiHome"), "h"),
  ]);

  return { inline_keyboard: rows };
}

export function symbolCardKeyboard(
  lang: Lang,
  symbolId: string,
  range: ChartRange,
  backKind?: SymbolKind,
): InlineKeyboard {
  const r24 = range === "24h" ? "· 24h ·" : "24h";
  const r7 = range === "7d" ? "· 7d ·" : "7d";
  const back = backKind ? `b:${backKind}:0` : "b:c";
  return {
    inline_keyboard: [
      [
        btn(r24, `s:${symbolId}:24h`),
        btn(r7, `s:${symbolId}:7d`),
        btn(t(lang, "uiRefresh"), `s:${symbolId}:${range}`),
      ],
      [
        btn(t(lang, "uiHistory"), `s:${symbolId}:hi`),
        btn(t(lang, "uiAlertHow"), "a:help"),
      ],
      [btn(t(lang, "uiBack"), back), btn(t(lang, "uiHome"), "h")],
    ],
  };
}

export function historyKeyboard(lang: Lang, symbolId: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        btn(t(lang, "uiBack"), `s:${symbolId}`),
        btn(t(lang, "uiHome"), "h"),
      ],
    ],
  };
}

export function exchangesKeyboard(lang: Lang): InlineKeyboard {
  return {
    inline_keyboard: [
      [btn(t(lang, "uiAlerts"), "a"), btn(t(lang, "uiHome"), "h")],
    ],
  };
}

export function alertsKeyboard(lang: Lang, rows: AlertRow[]): InlineKeyboard {
  const kb: InlineBtn[][] = [];
  for (const a of rows.slice(0, 10)) {
    const mode = a.mode === "repeat" ? "every" : "once";
    const label = `#${a.id} ${a.symbol} ${a.direction} ${a.threshold}`.slice(
      0,
      40,
    );
    kb.push([
      btn(label, "noop"),
      btn(t(lang, "uiDelete"), `a:d:${a.id}`),
    ]);
  }
  kb.push([
    btn(t(lang, "uiAlertHow"), "a:help"),
    btn(t(lang, "uiHome"), "h"),
  ]);
  return { inline_keyboard: kb };
}

export function alertHelpKeyboard(lang: Lang): InlineKeyboard {
  return {
    inline_keyboard: [
      [btn(t(lang, "uiAlerts"), "a"), btn(t(lang, "uiHome"), "h")],
    ],
  };
}

export function settingsKeyboard(lang: Lang, feePct: number): InlineKeyboard {
  const feeBtn = (n: number) =>
    btn(feePct === n ? `· ${n}% ·` : `${n}%`, `set:fee:${n}`);
  return {
    inline_keyboard: [
      [
        btn(lang === "fa" ? "· 🇮🇷 فارسی ·" : "🇮🇷 فارسی", "set:lang:fa"),
        btn(lang === "en" ? "· 🇬🇧 EN ·" : "🇬🇧 EN", "set:lang:en"),
      ],
      [feeBtn(0), feeBtn(1), feeBtn(2), feeBtn(5)],
      [btn(t(lang, "uiHome"), "h")],
    ],
  };
}

export function helpKeyboard(lang: Lang): InlineKeyboard {
  return {
    inline_keyboard: [
      [btn(t(lang, "uiBrowse"), "b:c"), btn(t(lang, "uiAlerts"), "a")],
      [btn(t(lang, "uiHome"), "h")],
    ],
  };
}

/** Compact footer for free-text replies (price/calc) */
export function menuOnlyKeyboard(lang: Lang): InlineKeyboard {
  return {
    inline_keyboard: [[btn(t(lang, "uiMenu"), "h")]],
  };
}

// —— HTML screens ——

function kindLabel(lang: Lang, kind: SymbolKind): string {
  switch (kind) {
    case "fx":
      return t(lang, "uiCatFx");
    case "gold":
      return t(lang, "uiCatGold");
    case "coin":
      return t(lang, "uiCatCoin");
    case "crypto":
      return t(lang, "uiCatCrypto");
  }
}

export function screenHome(env: Env, lang: Lang): Screen {
  return {
    html: richStart(env, lang),
    keyboard: homeKeyboard(env, lang),
  };
}

export function screenCategories(lang: Lang): Screen {
  const title =
    lang === "fa"
      ? `<h2>📋 ${escapeHtml(t(lang, "uiBrowseTitle"))}</h2>
<p>${escapeHtml(t(lang, "uiPickCategory"))}</p>
<p><i>یا بفرست <code>USD</code> · جستجو از دکمه 🔎</i></p>`
      : `<h2>📋 ${escapeHtml(t(lang, "uiBrowseTitle"))}</h2>
<p>${escapeHtml(t(lang, "uiPickCategory"))}</p>
<p><i>Or type <code>USD</code> · use 🔎 to search</i></p>`;
  return { html: title.trim(), keyboard: categoriesKeyboard(lang) };
}

export function screenSymbolList(lang: Lang, kind: SymbolKind, page: number): Screen {
  const all = symbolsByKind(kind);
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const p = Math.min(Math.max(0, page), pages - 1);
  const label = kindLabel(lang, kind);
  const html =
    lang === "fa"
      ? `<h2>${escapeHtml(label)}</h2>
<p>${all.length} نماد · ${escapeHtml(t(lang, "uiPage"))} <b>${p + 1}/${pages}</b></p>
<p><i>برای قیمت ضربه بزن</i></p>`
      : `<h2>${escapeHtml(label)}</h2>
<p>${all.length} symbols · ${escapeHtml(t(lang, "uiPage"))} <b>${p + 1}/${pages}</b></p>
<p><i>Tap a symbol for live price</i></p>`;
  return {
    html: html.trim(),
    keyboard: symbolListKeyboard(lang, kind, p),
  };
}

export function screenSymbolCard(
  env: Env,
  lang: Lang,
  def: SymbolDef,
  row: LatestRow | null,
  chartUrl: string | undefined,
  dayRange: { high: number; low: number } | null | undefined,
  price24hAgo: number | null | undefined,
  range: ChartRange,
): Screen {
  return {
    html: richSymbolPrice(env, def, row, chartUrl, dayRange, price24hAgo),
    keyboard: symbolCardKeyboard(lang, def.id, range, def.kind),
  };
}

export function screenHistory(
  env: Env,
  lang: Lang,
  id: string,
  emoji: string,
  days: Array<{ day: string; open: number; high: number; low: number; close: number }>,
): Screen {
  return {
    html: richHistory(env, id, emoji, days),
    keyboard: historyKeyboard(lang, id),
  };
}

export function screenExchanges(
  env: Env,
  lang: Lang,
  rows: Array<{
    name: string;
    buy: number | null;
    sell: number | null;
    mid: number | null;
    updated_at: number;
  }>,
): Screen {
  return {
    html: richExchanges(env, rows),
    keyboard: exchangesKeyboard(lang),
  };
}

export function screenAlerts(lang: Lang, rows: AlertRow[]): Screen {
  if (!rows.length) {
    const html =
      lang === "fa"
        ? `<h2>🔔 ${escapeHtml(t(lang, "alertsTitle"))}</h2>
<p>${t(lang, "alertNone")}</p>`
        : `<h2>🔔 ${escapeHtml(t(lang, "alertsTitle"))}</h2>
<p>${t(lang, "alertNone")}</p>`;
    return { html: html.trim(), keyboard: alertsKeyboard(lang, []) };
  }
  const body = rows
    .map((a) => {
      const mode =
        a.mode === "repeat"
          ? t(lang, "alertModeRepeat")
          : t(lang, "alertModeOnce");
      return `<p>#${a.id} <code>${escapeHtml(a.symbol)}</code> ${escapeHtml(a.direction)} ${a.threshold} · <i>${escapeHtml(mode)}</i></p>`;
    })
    .join("\n");
  const html = `<h2>🔔 ${escapeHtml(t(lang, "alertsTitle"))}</h2>
${body}
<p><i>${lang === "fa" ? "حذف با 🗑" : "Tap 🗑 to remove"}</i></p>`;
  return { html: html.trim(), keyboard: alertsKeyboard(lang, rows) };
}

export function screenAlertHelp(lang: Lang): Screen {
  const html =
    lang === "fa"
      ? `<h2>🔔 راهنمای هشدار</h2>
<p>${t(lang, "usageAlert")}</p>
<p><b>یک‌بار</b> — یک اعلان، بعد حذف.</p>
<p><b>تکراری (every)</b> — دوباره فقط بعد از برگشت قیمت.</p>`
      : `<h2>🔔 Alert help</h2>
<p>${t(lang, "usageAlert")}</p>
<p><b>once</b> — notify once, then removed.</p>
<p><b>every</b> — re-fire only after price clears the threshold.</p>`;
  return { html: html.trim(), keyboard: alertHelpKeyboard(lang) };
}

export function screenSettings(env: Env, lang: Lang, feePct: number): Screen {
  return {
    html: richSettings(env, lang, feePct),
    keyboard: settingsKeyboard(lang, feePct),
  };
}

export function screenHelp(env: Env, lang: Lang): Screen {
  return {
    html: richHelp(env, lang),
    keyboard: helpKeyboard(lang),
  };
}

// —— Show (edit or send) ——

export async function showScreen(
  env: Env,
  target: ShowTarget,
  screen: Screen,
): Promise<void> {
  const extra: Record<string, unknown> = {
    reply_markup: screen.keyboard,
  };
  if (target.messageId != null && target.messageId > 0) {
    try {
      await editRichMessage(
        env,
        target.chatId,
        target.messageId,
        screen.html,
        extra,
      );
      return;
    } catch (e) {
      console.error("editRichMessage failed, fallback send", e);
      // fall through to send
    }
  }
  if (target.replyTo != null && target.replyTo > 0) {
    extra.reply_parameters = { message_id: target.replyTo };
  }
  try {
    await sendRichMessage(env, target.chatId, screen.html, extra);
  } catch (e) {
    console.error("sendRichMessage failed, plain fallback", e);
    const plain = screen.html
      .replace(/<\/?(h[1-6]|ul|ol|li|table|tr|td|th|p|tg-time|img)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    try {
      await sendMessage(env, target.chatId, plain, {
        reply_markup: screen.keyboard,
      });
    } catch (e2) {
      console.error("plain send also failed", e2);
      throw e2;
    }
  }
}

/** Normalize legacy menu:* callbacks into short scheme */
export function normalizeCallbackData(data: string): string {
  switch (data) {
    case "menu:symbols":
    case "noop:symbols":
      return "b:c";
    case "menu:exchanges":
    case "noop:exchanges":
      return "x";
    case "menu:help":
      return "help";
    case "menu:lang_fa":
      return "set:lang:fa";
    case "menu:lang_en":
      return "set:lang:en";
    default:
      return data;
  }
}

export type ParsedCallback =
  | { type: "home" }
  | { type: "noop" }
  | { type: "categories" }
  | { type: "browse"; kind: SymbolKind; page: number }
  | { type: "symbol"; id: string; range: ChartRange }
  | { type: "history"; id: string }
  | { type: "exchanges" }
  | { type: "alerts" }
  | { type: "alertDelete"; id: number }
  | { type: "alertHelp" }
  | { type: "settings" }
  | { type: "setLang"; lang: Lang }
  | { type: "setFee"; fee: number }
  | { type: "help" }
  | { type: "unknown" };

const KINDS = new Set<string>(["fx", "gold", "coin", "crypto"]);

export function parseCallback(raw: string): ParsedCallback {
  const data = normalizeCallbackData(raw);
  if (!data || data === "noop") return { type: "noop" };
  if (data === "h") return { type: "home" };
  if (data === "b:c") return { type: "categories" };
  if (data === "x") return { type: "exchanges" };
  if (data === "a") return { type: "alerts" };
  if (data === "a:help") return { type: "alertHelp" };
  if (data === "set") return { type: "settings" };
  if (data === "help") return { type: "help" };

  let m = data.match(/^b:(fx|gold|coin|crypto):(\d+)$/);
  if (m) {
    return {
      type: "browse",
      kind: m[1] as SymbolKind,
      page: Number(m[2]) || 0,
    };
  }

  m = data.match(/^a:d:(\d+)$/);
  if (m) return { type: "alertDelete", id: Number(m[1]) };

  m = data.match(/^set:lang:(fa|en)$/);
  if (m) return { type: "setLang", lang: m[1] as Lang };

  m = data.match(/^set:fee:(\d+(?:\.\d+)?)$/);
  if (m) return { type: "setFee", fee: Number(m[1]) };

  m = data.match(/^s:([A-Z0-9]+):hi$/i);
  if (m) return { type: "history", id: (m[1] ?? "").toUpperCase() };

  m = data.match(/^s:([A-Z0-9]+)(?::(24h|7d))?$/i);
  if (m) {
    const range: ChartRange = m[2]?.toLowerCase() === "7d" ? "7d" : "24h";
    return { type: "symbol", id: (m[1] ?? "").toUpperCase(), range };
  }

  // tolerate unknown kind tokens
  m = data.match(/^b:(\w+):(\d+)$/);
  if (m && KINDS.has(m[1] ?? "")) {
    return {
      type: "browse",
      kind: m[1] as SymbolKind,
      page: Number(m[2]) || 0,
    };
  }

  return { type: "unknown" };
}

export function isNotModifiedError(e: unknown): boolean {
  if (e instanceof TelegramError) return /not modified/i.test(e.message);
  return /not modified/i.test(String(e));
}
