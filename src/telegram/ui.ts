/**
 * Screen-based bot UI: keyboards, HTML shells, edit-or-send.
 * Callback data is short and stateless (see plan).
 */

import type { Env } from "../env";
import type { Lang } from "../db/settings";
import type { AlertRow } from "../db/alerts";
import type { SymbolDef, SymbolKind } from "../symbols";
import { symbolsByKind } from "../symbols";
import { getAllLatest } from "../db/prices";
import { t } from "../lib/i18n";
import { escapeHtml, formatPrice } from "../lib/format";
import {
  editEphemeralRichMessage,
  editRichMessage,
  sendMessage,
  sendRichMessage,
  TelegramError,
} from "./api";
import { packEphemeral, type EphemeralTarget } from "./ephemeral";
import {
  richHelp,
  richHome,
  richSettings,
  richExchanges,
  richHistory,
  richSymbolPrice,
} from "./rich";
import type { LatestRow } from "../db/prices";
import type { ChartRange } from "../chart/serve";
import { CUSTOM_EMOJI_IDS, type EmojiSlot } from "./emoji";

export type InlineBtn = {
  text: string;
  callback_data?: string;
  url?: string;
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
  style?: "primary" | "success" | "danger" | "link";
  /** Premium custom emoji shown before the label. */
  icon_custom_emoji_id?: string;
  disabled?: boolean;
  /** Copies this text. Mutually exclusive with callback_data. */
  copy_text?: { text: string };
};

export type InlineKeyboard = { inline_keyboard: InlineBtn[][] };

export type Screen = {
  html: string;
  keyboard: InlineKeyboard;
  /** Ask the client to open a reply to this message (alert amount). */
  forceReply?: boolean;
};

export type ShowTarget = {
  chatId: string | number;
  /** If set, edit this message instead of sending a new one */
  messageId?: number;
  /** Reply-to for new sends only */
  replyTo?: number;
  /** Group reply visible only to this user. */
  ephemeral?: EphemeralTarget;
};

const PAGE_SIZE = 9; // 3×3
const COLS = 3;

function channelUrl(env: Env): string {
  return `https://t.me/${env.CHANNEL_USERNAME}`;
}

function btn(
  text: string,
  data: string,
  style?: InlineBtn["style"],
  icon?: EmojiSlot,
): InlineBtn {
  const iconId = icon ? CUSTOM_EMOJI_IDS[icon] : undefined;
  return {
    text,
    callback_data: data,
    ...(style && style !== "link" ? { style } : {}),
    ...(iconId ? { icon_custom_emoji_id: iconId } : {}),
  };
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// —— Keyboards ——

export function homeKeyboard(
  env: Env,
  lang: Lang,
  quotes?: Map<string, { price: number }>,
): InlineKeyboard {
  const named = (key: "homeUsd" | "homeUsdt" | "homeGold" | "homeCoin", id: string) => {
    const price = quotes?.get(id)?.price;
    const name = t(lang, key);
    return price == null ? name : `${name} ${formatPrice(price)}`;
  };
  return {
    inline_keyboard: [
      [
        btn(named("homeUsd", "USD"), "s:USD", "primary", "price"),
        btn(named("homeUsdt", "USDT"), "s:USDT", undefined, "buy"),
      ],
      [
        btn(named("homeGold", "GOLD18"), "s:GOLD18", undefined, "high"),
        btn(named("homeCoin", "EMAMI"), "s:EMAMI", undefined, "sparkle"),
      ],
      [
        btn(t(lang, "uiExchanges"), "x", undefined, "chart"),
        btn(t(lang, "uiAlerts"), "a", undefined, "clock"),
      ],
      [
        btn(t(lang, "uiBrowse"), "b:c", undefined, "chart"),
        {
          text: t(lang, "uiSearch"),
          switch_inline_query_current_chat: "",
          icon_custom_emoji_id: CUSTOM_EMOJI_IDS.flat,
        },
      ],
      [
        btn(t(lang, "uiSettings"), "set", undefined, "flat"),
        {
          text: t(lang, "uiChannel"),
          url: channelUrl(env),
          icon_custom_emoji_id: CUSTOM_EMOJI_IDS.channel,
        },
      ],
    ],
  };
}

export function categoriesKeyboard(lang: Lang): InlineKeyboard {
  return {
    inline_keyboard: [
      [btn(t(lang, "uiCatFx"), "b:fx:0", undefined, "price"), btn(t(lang, "uiCatGold"), "b:gold:0", undefined, "high")],
      [
        btn(t(lang, "uiCatCoin"), "b:coin:0", undefined, "sparkle"),
        btn(t(lang, "uiCatCrypto"), "b:crypto:0", undefined, "buy"),
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
    const prev: InlineBtn =
      p > 0
        ? btn("◀", `b:${kind}:${p - 1}`)
        : { text: "◀", callback_data: "noop", disabled: true };
    const next: InlineBtn =
      p < pages - 1
        ? btn("▶", `b:${kind}:${p + 1}`)
        : { text: "▶", callback_data: "noop", disabled: true };
    rows.push([prev, { text: `${p + 1}/${pages}`, callback_data: "noop", disabled: true }, next]);
  }

  rows.push([
    btn(t(lang, "uiBack"), "b:c"),
    btn(t(lang, "uiHome"), "h"),
  ]);

  return { inline_keyboard: rows };
}

/** Copy is its own full-width button. A fifth in-message button was clipped and untappable. */
export function symbolCardKeyboard(
  lang: Lang,
  price: number | null,
  backKind?: SymbolKind,
): InlineKeyboard {
  const back = backKind ? `b:${backKind}:0` : "b:c";
  const rows: InlineBtn[][] = [];
  if (price != null) {
    rows.push([
      {
        text: `${t(lang, "uiCopy")} ${formatPrice(price)}`,
        copy_text: { text: String(Math.round(price)) },
        icon_custom_emoji_id: CUSTOM_EMOJI_IDS.price,
      },
    ]);
  }
  rows.push([
    btn(t(lang, "uiBack"), back, undefined, "flat"),
    btn(t(lang, "uiSettings"), "set", undefined, "flat"),
    btn(t(lang, "uiHome"), "h", undefined, "sparkle"),
  ]);
  return { inline_keyboard: rows };
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
      [btn(t(lang, "uiAlerts"), "a", undefined, "clock"), btn(t(lang, "uiHome"), "h", undefined, "sparkle")],
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
      { text: label, callback_data: "noop", disabled: true },
      btn(t(lang, "uiDelete"), `a:d:${a.id}`, "danger", "down"),
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
      [btn(t(lang, "uiAlerts"), "a", undefined, "clock"), btn(t(lang, "uiHome"), "h", undefined, "sparkle")],
    ],
  };
}

export function settingsKeyboard(lang: Lang, feePct: number): InlineKeyboard {
  const feeBtn = (n: number) =>
    btn(`${n}%`, `set:fee:${n}`, feePct === n ? "primary" : undefined);
  return {
    inline_keyboard: [
      [
        btn("فارسی", "set:lang:fa", lang === "fa" ? "primary" : undefined),
        btn("EN", "set:lang:en", lang === "en" ? "primary" : undefined),
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
      [btn(t(lang, "uiSettings"), "set"), btn(t(lang, "uiHome"), "h")],
    ],
  };
}

/** Compact footer for free-text replies (price/calc) */
export function menuOnlyKeyboard(lang: Lang): InlineKeyboard {
  return {
    inline_keyboard: [[btn(t(lang, "uiMenu"), "h", undefined, "sparkle")]],
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

export async function screenHome(env: Env, lang: Lang): Promise<Screen> {
  const rows = await getAllLatest(env.DB);
  const quotes = new Map(
    rows.map((r) => [r.symbol, { price: r.price, prev_price: r.prev_price }]),
  );
  return {
    html: richHome(env, lang, quotes),
    keyboard: homeKeyboard(env, lang, quotes),
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
    html: richSymbolPrice(env, def, row, chartUrl, dayRange, price24hAgo, lang, range),
    keyboard: symbolCardKeyboard(lang, row?.price ?? null, def.kind),
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
    html: richHistory(env, id, emoji, days, lang),
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
    html: richExchanges(env, rows, lang),
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
      const dir =
        a.direction === "below"
          ? t(lang, "dirBelow")
          : a.direction === "move_pct"
            ? t(lang, "dirMove")
            : t(lang, "dirAbove");
      const thr = a.direction === "move_pct" ? `${a.threshold}%` : String(a.threshold);
      return `<p>#${a.id} <code>${escapeHtml(a.symbol)}</code> ${escapeHtml(dir)} ${escapeHtml(thr)} · <i>${escapeHtml(mode)}</i></p>`;
    })
    .join("\n");
  const html = `<h2>🔔 ${escapeHtml(t(lang, "alertsTitle"))}</h2>
${body}
<p><i>${lang === "fa" ? "حذف با 🗑" : "Tap 🗑 to remove"}</i></p>`;
  return { html: html.trim(), keyboard: alertsKeyboard(lang, rows) };
}

export function screenAlertDirection(lang: Lang, symbolId: string): Screen {
  const html =
    lang === "fa"
      ? `<h2>🔔 ${escapeHtml(symbolId)}</h2>
<p>کدام شرط؟</p>`
      : `<h2>🔔 ${escapeHtml(symbolId)}</h2>
<p>Which condition?</p>`;
  return {
    html: html.trim(),
    keyboard: {
      inline_keyboard: [
        [
          btn(t(lang, "dirAbove"), `a:dir:${symbolId}:above`, "primary"),
          btn(t(lang, "dirBelow"), `a:dir:${symbolId}:below`),
        ],
        [btn(`${t(lang, "dirMove")} %`, `a:dir:${symbolId}:move`)],
        [btn(t(lang, "uiBack"), `s:${symbolId}`), btn(t(lang, "uiHome"), "h")],
      ],
    },
  };
}

export function screenAlertAmount(
  lang: Lang,
  symbolId: string,
  direction: "above" | "below" | "move_pct",
): Screen {
  const dir =
    direction === "below"
      ? t(lang, "dirBelow")
      : direction === "move_pct"
        ? t(lang, "dirMove")
        : t(lang, "dirAbove");
  const ask = direction === "move_pct" ? t(lang, "alertAskPct") : t(lang, "alertAskPrice");
  const html = `<h2>🔔 ${escapeHtml(symbolId)}</h2>
<p>${escapeHtml(dir)}</p>
<p>${ask}</p>`;
  return {
    html: html.trim(),
    forceReply: true,
    keyboard: {
      inline_keyboard: [
        [btn(t(lang, "uiBack"), `a:new:${symbolId}`), btn(t(lang, "uiHome"), "h")],
      ],
    },
  };
}

export function screenAlertMode(
  lang: Lang,
  symbolId: string,
  direction: "above" | "below" | "move_pct",
  threshold: number,
): Screen {
  const dir =
    direction === "below"
      ? t(lang, "dirBelow")
      : direction === "move_pct"
        ? t(lang, "dirMove")
        : t(lang, "dirAbove");
  const thr = direction === "move_pct" ? `${threshold}%` : String(threshold);
  const html = `<h2>🔔 ${escapeHtml(symbolId)}</h2>
<p>${escapeHtml(dir)} <b>${escapeHtml(thr)}</b></p>
<p>${t(lang, "alertPickMode")}</p>`;
  return {
    html: html.trim(),
    keyboard: {
      inline_keyboard: [
        [
          btn(t(lang, "alertModeOnce"), "a:arm:once", "primary"),
          btn(t(lang, "alertModeRepeat"), "a:arm:every"),
        ],
        [btn(t(lang, "uiHome"), "h")],
      ],
    },
  };
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
  const markup = screen.forceReply
    ? { ...screen.keyboard, force_reply: true }
    : screen.keyboard;
  const extra = packEphemeral(target.ephemeral, { reply_markup: markup });
  // Edit only a card this bot already sent. A user's ephemeral command is a reply target, not an edit target.
  const editEph =
    target.messageId != null &&
    target.messageId > 0 &&
    target.ephemeral?.ephemeralMessageId === target.messageId;
  if (editEph && target.ephemeral) {
    try {
      await editEphemeralRichMessage(
        env,
        target.chatId,
        target.ephemeral.receiverUserId,
        target.messageId!,
        screen.html,
        { reply_markup: markup },
      );
      return;
    } catch (e) {
      console.error("editEphemeralRichMessage failed, fallback send", e);
    }
  } else if (target.messageId != null && target.messageId > 0 && !target.ephemeral) {
    try {
      await editRichMessage(
        env,
        target.chatId,
        target.messageId,
        screen.html,
        { reply_markup: markup },
      );
      return;
    } catch (e) {
      console.error("editRichMessage failed, fallback send", e);
      // fall through to send
    }
  }
  if (target.replyTo != null && target.replyTo > 0 && !extra.reply_parameters) {
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
      await sendMessage(
        env,
        target.chatId,
        plain,
        packEphemeral(target.ephemeral, { reply_markup: screen.keyboard }),
      );
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
  | { type: "alertNew"; id: string }
  | { type: "alertDir"; id: string; direction: "above" | "below" | "move" }
  | { type: "alertArm"; mode: "once" | "every" }
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

  let m = data.match(/^a:new:([A-Z0-9]+)$/i);
  if (m) return { type: "alertNew", id: (m[1] ?? "").toUpperCase() };

  m = data.match(/^a:dir:([A-Z0-9]+):(above|below|move)$/i);
  if (m) {
    return {
      type: "alertDir",
      id: (m[1] ?? "").toUpperCase(),
      direction: (m[2] ?? "above").toLowerCase() as "above" | "below" | "move",
    };
  }

  m = data.match(/^a:arm:(once|every)$/);
  if (m) return { type: "alertArm", mode: m[1] as "once" | "every" };
  if (data === "set") return { type: "settings" };
  if (data === "help") return { type: "help" };

  m = data.match(/^b:(fx|gold|coin|crypto):(\d+)$/);
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
