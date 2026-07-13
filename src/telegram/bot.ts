import type { Env } from "../env";
import { normalizeSymbolQuery, resolveSymbol } from "../symbols";
import {
  answerGuestQuery,
  answerInlineQuery,
  isDeadUpdate,
  sendMessage,
  sendRichMessage,
  type TgMessage,
  type TgUpdate,
} from "./api";
import { escapeHtml, formatDelta, formatPrice, formatTimeTehran } from "../lib/format";
import {
  evaluateCalc,
  formatCalcDescription,
  formatCalcTitle,
  looksLikeCalc,
  parseCalc,
} from "../lib/calc";
import {
  getDayHighLow,
  getLatest,
  getOhlcDays,
  getPrice24hAgo,
  ttlUntilNext5m,
} from "../db/prices";
import {
  richCalc,
  richCalcError,
  richCompare,
  richExchanges,
  richHelp,
  richHistory,
  richMulti,
  richOhlc,
  richStart,
  richSymbolPrice,
  richSymbols,
  richUnknown,
  startKeyboard,
} from "./rich";
import { chartPublicUrl, ensureChartPng, type ChartRange } from "../chart/serve";
import { listExchanges } from "../db/exchanges";
import { addAlert, countAlerts, deleteAlert, listAlerts } from "../db/alerts";
import { getSettings, setFeePct, setLang, type Lang } from "../db/settings";
import { rateLimit } from "../lib/ratelimit";
import { t } from "../lib/i18n";
import { em } from "./emoji";

/** Normal-mode replies use Rich Messages; fall back to classic HTML if needed. */
async function replyRich(
  env: Env,
  chatId: string | number,
  html: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  try {
    await sendRichMessage(env, chatId, html, extra);
  } catch (e) {
    console.error("sendRichMessage failed, fallback sendMessage", e);
    // strip some rich-only tags for crude fallback
    const plain = html
      .replace(/<\/?(h[1-6]|ul|ol|li|table|tr|td|th|p|tg-time)[^>]*>/gi, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    await sendMessage(env, chatId, plain, extra);
  }
}

function replyParams(messageId?: number): Record<string, unknown> {
  if (messageId == null || messageId <= 0) return {};
  return { reply_parameters: { message_id: messageId } };
}

function parseCommand(text: string): { cmd: string; arg: string } | null {
  if (!text.startsWith("/")) return null;
  const [head, ...rest] = text.slice(1).split(/\s+/);
  const cmd = (head ?? "").split("@")[0]?.toLowerCase() ?? "";
  if (!cmd) return null;
  return { cmd, arg: rest.join(" ").trim() };
}

export async function handleUpdate(env: Env, update: TgUpdate): Promise<void> {
  console.log("update", {
    id: update.update_id,
    hasMessage: Boolean(update.message),
    hasInline: Boolean(update.inline_query),
    hasGuest: Boolean(update.guest_message),
    text: update.message?.text?.slice(0, 80),
    date: update.message?.date,
  });

  if (update.inline_query) {
    // Inline queries are live keystrokes; Telegram does not attach a date.
    // Stale backlog is dropped on webhook setup (drop_pending_updates).
    await handleInline(env, update.inline_query.id, update.inline_query.query);
    return;
  }

  // Guest Mode: @mention in a chat the bot isn't a member of
  if (update.guest_message) {
    await handleGuestMessage(env, update.guest_message);
    return;
  }

  const msg = update.message;
  if (!msg?.text || !msg.chat) {
    console.log("skip: no message text/chat");
    return;
  }

  // Ignore dead updates (e.g. backlog replay, delayed delivery)
  if (isDeadUpdate(msg.date)) {
    console.log("skip dead update", {
      update_id: update.update_id,
      message_id: msg.message_id,
      date: msg.date,
      age_sec: msg.date != null ? Math.floor(Date.now() / 1000) - msg.date : null,
      now: Math.floor(Date.now() / 1000),
    });
    return;
  }

  const text = msg.text.trim();
  const chatId = msg.chat.id;
  const command = parseCommand(text);
  console.log("cmd", command, "chat", chatId);

  // Rate limit: 30 msgs / minute / chat
  const rl = await rateLimit(env.CACHE, `chat:${chatId}`, 30, 60);
  if (!rl.ok) {
    const settings = await getSettings(env.DB, String(chatId));
    await sendMessage(env, chatId, t(settings.lang, "rateLimited"));
    return;
  }

  const extra = replyParams(msg.message_id);
  const settings = await getSettings(env.DB, String(chatId));

  if (command?.cmd === "start") {
    await replyRich(env, chatId, richStart(env), {
      ...extra,
      reply_markup: startKeyboard(env),
    });
    return;
  }

  if (command?.cmd === "help") {
    await replyRich(env, chatId, richHelp(env), {
      ...extra,
      reply_markup: startKeyboard(env),
    });
    return;
  }

  if (command?.cmd === "symbols" || command?.cmd === "symbol") {
    await replyRich(env, chatId, richSymbols(), extra);
    return;
  }

  // /settings | /lang en|fa | /fee 2
  if (command?.cmd === "settings") {
    await replyRich(
      env,
      chatId,
      `<h2>${em("sparkle")} ${t(settings.lang, "settings")}</h2>
<p>lang: <b>${settings.lang}</b> → <code>/lang en</code> · <code>/lang fa</code></p>
<p>fee: <b>${settings.fee_pct}%</b> → <code>/fee 2</code></p>
<p>alerts: <code>/alert</code> · <code>/alerts</code></p>
<p>exchanges: <code>/exchanges</code></p>`,
      extra,
    );
    return;
  }
  if (command?.cmd === "lang") {
    const lang = (command.arg.toLowerCase() === "fa" ? "fa" : "en") as Lang;
    await setLang(env.DB, String(chatId), lang);
    await sendMessage(env, chatId, `${t(lang, "langSet")} <b>${lang}</b>`);
    return;
  }
  if (command?.cmd === "fee") {
    const n = Number(command.arg.replace("%", ""));
    if (!Number.isFinite(n)) {
      await sendMessage(env, chatId, "Usage: <code>/fee 2</code>");
      return;
    }
    await setFeePct(env.DB, String(chatId), n);
    await sendMessage(env, chatId, `${t(settings.lang, "feeSet")} <b>${n}%</b>`);
    return;
  }

  // /exchanges — USDT books
  if (command?.cmd === "exchanges" || command?.cmd === "usdt") {
    const rows = await listExchanges(env.DB);
    await replyRich(env, chatId, richExchanges(env, rows), extra);
    return;
  }

  // /compare USD USDT
  if (command?.cmd === "compare" || command?.cmd === "vs") {
    const parts = command.arg.split(/\s+/).filter(Boolean);
    const a = resolveSymbol(parts[0] ?? "USD");
    const b = resolveSymbol(parts[1] ?? "USDT");
    if (!a || !b) {
      await sendMessage(env, chatId, "Usage: <code>/compare USD USDT</code>");
      return;
    }
    const [ra, rb] = await Promise.all([getLatest(env.DB, a.id), getLatest(env.DB, b.id)]);
    if (!ra || !rb) {
      await sendMessage(env, chatId, t(settings.lang, "needPrice"));
      return;
    }
    await replyRich(
      env,
      chatId,
      richCompare(
        env,
        { id: a.id, name: a.name, emoji: a.emoji, price: ra.price },
        { id: b.id, name: b.name, emoji: b.emoji, price: rb.price },
      ),
      extra,
    );
    return;
  }

  // /history USD | /ohlc USD
  if (command?.cmd === "history" || command?.cmd === "ohlc") {
    const def = resolveSymbol(command.arg || "USD");
    if (!def) {
      await sendMessage(env, chatId, "Usage: <code>/history USD</code>");
      return;
    }
    const days = await getOhlcDays(env.DB, def.id, 7);
    if (command.cmd === "ohlc") {
      await replyRich(
        env,
        chatId,
        richOhlc(env, def.id, def.emoji, days[days.length - 1] ?? null),
        extra,
      );
    } else {
      await replyRich(env, chatId, richHistory(env, def.id, def.emoji, days), extra);
    }
    return;
  }

  // /chart7d USD | /7d USD
  if (command?.cmd === "chart7d" || command?.cmd === "7d") {
    const def = resolveSymbol(command.arg || "USD");
    if (!def) {
      await sendMessage(env, chatId, "Usage: <code>/7d USD</code>");
      return;
    }
    await sendSymbolCard(env, chatId, def.id, extra, "7d");
    return;
  }

  // /alert USD above 180000 | /alerts | /unalert 3
  if (command?.cmd === "alert") {
    const m = command.arg.match(
      /^(\S+)\s+(above|below|move|pct|move_pct)\s+([\d.]+)%?$/i,
    );
    if (!m) {
      await sendMessage(
        env,
        chatId,
        "Usage:\n<code>/alert USD above 180000</code>\n<code>/alert USDT below 170000</code>\n<code>/alert USD move 2</code> (2%)",
      );
      return;
    }
    const def = resolveSymbol(m[1] ?? "");
    if (!def) {
      await sendMessage(env, chatId, `Unknown symbol <code>${escapeHtml(m[1] ?? "")}</code>`);
      return;
    }
    const n = await countAlerts(env.DB, String(chatId));
    if (n >= 10) {
      await sendMessage(env, chatId, "Max 10 alerts. /unalert ID first.");
      return;
    }
    let direction: "above" | "below" | "move_pct" = "above";
    const d = (m[2] ?? "").toLowerCase();
    if (d === "below") direction = "below";
    if (d === "move" || d === "pct" || d === "move_pct") direction = "move_pct";
    const thr = Number(m[3]);
    const id = await addAlert(env.DB, String(chatId), def.id, direction, thr);
    await sendMessage(
      env,
      chatId,
      `${t(settings.lang, "alertAdded")} #${id}\n<code>${def.id}</code> ${direction} ${thr}`,
    );
    return;
  }
  if (command?.cmd === "alerts") {
    const rows = await listAlerts(env.DB, String(chatId));
    if (!rows.length) {
      await sendMessage(env, chatId, t(settings.lang, "alertNone"));
      return;
    }
    const body = rows
      .map((a) => `#${a.id} <code>${a.symbol}</code> ${a.direction} ${a.threshold}`)
      .join("\n");
    await sendMessage(env, chatId, `🔔 <b>Alerts</b>\n${body}\n\n/unalert ID`);
    return;
  }
  if (command?.cmd === "unalert" || command?.cmd === "delalert") {
    const id = Number(command.arg);
    if (!id) {
      await sendMessage(env, chatId, "Usage: <code>/unalert 3</code>");
      return;
    }
    const ok = await deleteAlert(env.DB, String(chatId), id);
    await sendMessage(
      env,
      chatId,
      ok ? `${t(settings.lang, "alertDeleted")} #${id}` : "Alert not found.",
    );
    return;
  }

  // Multi-symbol: "USD USDT EUR" (2+ known symbols, no ops)
  const multi = tryMultiSymbols(text);
  if (multi) {
    const rows: Array<{ id: string; emoji: string; price: number }> = [];
    for (const id of multi) {
      const row = await getLatest(env.DB, id);
      const def = resolveSymbol(id)!;
      if (row) rows.push({ id, emoji: def.emoji, price: row.price });
    }
    if (rows.length) {
      await replyRich(env, chatId, richMulti(env, rows), extra);
      return;
    }
  }

  // Calculator (fee from settings)
  if (looksLikeCalc(text) || command?.cmd === "calc") {
    const q = command?.cmd === "calc" ? command.arg : text;
    await replyCalc(env, chatId, q, extra, settings.fee_pct);
    return;
  }

  // Plain symbol (optional "7d" suffix: USD 7d)
  const rangeMatch = text.match(/^(.+?)\s+(7d|24h)$/i);
  const symRaw = rangeMatch ? rangeMatch[1]! : text;
  const range: ChartRange = rangeMatch?.[2]?.toLowerCase() === "7d" ? "7d" : "24h";
  const def = resolveSymbol(symRaw);
  if (!def) {
    const shown = normalizeSymbolQuery(text) || text;
    await replyRich(env, chatId, richUnknown(shown), extra);
    return;
  }

  await sendSymbolCard(env, chatId, def.id, extra, range);
}

async function sendSymbolCard(
  env: Env,
  chatId: string | number,
  symbolId: string,
  extra: Record<string, unknown>,
  range: ChartRange = "24h",
): Promise<void> {
  const def = resolveSymbol(symbolId);
  if (!def) return;
  const row = await getLatest(env.DB, def.id);
  const [dayRange, price24h] = await Promise.all([
    getDayHighLow(env.DB, def.id),
    getPrice24hAgo(env.DB, def.id),
  ]);
  await ensureChartPng(env, def.id, range);
  const chartUrl = chartPublicUrl(env, def.id, range);
  await replyRich(
    env,
    chatId,
    richSymbolPrice(env, def, row, chartUrl, dayRange, price24h),
    extra,
  );
}

function tryMultiSymbols(text: string): string[] | null {
  const parts = text.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 8) return null;
  if (/[+\-*/%()]/.test(text)) return null;
  const ids: string[] = [];
  for (const p of parts) {
    const d = resolveSymbol(p);
    if (!d) return null;
    ids.push(d.id);
  }
  return ids;
}

async function priceOf(env: Env, symbolId: string): Promise<number | null> {
  const row = await getLatest(env.DB, symbolId);
  return row?.price ?? null;
}

/** Strip @BotUsername from a guest/summon message → remaining query. */
function extractGuestQuery(text: string, botUsername: string): string {
  const re = new RegExp(`@${botUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  return text.replace(re, " ").replace(/\s+/g, " ").trim();
}

function guestHelpArticle(env: Env): Record<string, unknown> {
  return {
    type: "article",
    id: "guest-help",
    title: "Dollar Chande · prices & calc",
    description: "USD · 10 USDT + 5 EUR · /help",
    input_message_content: {
      message_text: [
        `👋 <b>Dollar Chande</b> · guest reply`,
        ``,
        `Mention me with a symbol or calculation:`,
        `<code>@${escapeHtml(env.BOT_USERNAME)} USD</code>`,
        `<code>@${escapeHtml(env.BOT_USERNAME)} 10 USDT + 5 EUR</code>`,
        ``,
        `DM me for charts anytime · /help`,
        `📣 @${escapeHtml(env.CHANNEL_USERNAME)}`,
      ].join("\n"),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    },
  };
}

async function buildCalcInlineResult(
  env: Env,
  query: string,
  feePct = 0,
): Promise<Record<string, unknown>> {
  const parsed = parseCalc(query, feePct);
  if (!parsed.ok) {
    return {
      type: "article",
      id: "calc-err",
      title: "✨ Calculator",
      description: parsed.error,
      input_message_content: {
        rich_message: {
          html: richCalcError(env, parsed.error),
          skip_entity_detection: false,
        },
      },
    };
  }
  const evaluated = await evaluateCalc(parsed, (id) => priceOf(env, id), "IRT");
  if (!evaluated.ok) {
    return {
      type: "article",
      id: "calc-noprice",
      title: "✨ Calculator",
      description: evaluated.error,
      input_message_content: {
        rich_message: {
          html: richCalcError(env, evaluated.error),
          skip_entity_detection: false,
        },
      },
    };
  }
  const r = evaluated.result;
  return {
    type: "article",
    id: `calc-${r.expression}`.replace(/\s+/g, "-").slice(0, 64),
    title: `✨ ${formatCalcTitle(r)}`,
    description: formatCalcDescription(r),
    input_message_content: {
      rich_message: {
        html: richCalc(env, r),
        skip_entity_detection: false,
      },
    },
  };
}

async function buildSymbolGuestResult(
  env: Env,
  symbolRaw: string,
): Promise<Record<string, unknown> | null> {
  const def = resolveSymbol(symbolRaw);
  if (!def) return null;

  const row = await getLatest(env.DB, def.id);
  const [dayRange, price24h] = await Promise.all([
    getDayHighLow(env.DB, def.id),
    getPrice24hAgo(env.DB, def.id),
  ]);
  const unit = "IRT";
  const price = row ? formatPrice(row.price) : "—";
  const delta = row ? formatDelta(row.price, row.prev_price) : "n/a";

  // Warm PNG + embed chart URL in a rich guest result
  try {
    await ensureChartPng(env, def.id);
  } catch (e) {
    console.error("guest ensureChartPng", e);
  }
  const chartUrl = chartPublicUrl(env, def.id);
  const richHtml = richSymbolPrice(env, def, row, chartUrl, dayRange, price24h);

  // Prefer InputRichMessageContent so guest replies get the same single-message UI
  return {
    type: "article",
    id: `guest-${def.id}`,
    title: `${def.emoji} ${def.id} · ${price} ${unit}`,
    description: `${def.name} · ${delta}`,
    input_message_content: {
      rich_message: {
        html: richHtml,
        // false → native $USD cashtags
        skip_entity_detection: false,
      },
    },
  };
}

/**
 * Guest Mode handler.
 * User: "@DollarChandeBot USD" or "@DollarChandeBot 10 USDT + 5 EUR" in any chat.
 * Bot replies via answerGuestQuery (as the bot, in that chat).
 */
async function handleGuestMessage(env: Env, msg: TgMessage): Promise<void> {
  if (!msg.guest_query_id) {
    console.error("guest_message missing guest_query_id");
    return;
  }
  if (isDeadUpdate(msg.date)) {
    console.log("skip dead guest_message", { date: msg.date, id: msg.message_id });
    return;
  }

  const raw = (msg.text ?? msg.caption ?? "").trim();
  const query = extractGuestQuery(raw, env.BOT_USERNAME);

  try {
    let result: Record<string, unknown>;

    if (!query) {
      result = guestHelpArticle(env);
    } else if (looksLikeCalc(query)) {
      result = await buildCalcInlineResult(env, query);
    } else {
      const symbolResult = await buildSymbolGuestResult(env, query);
      result = symbolResult ?? {
        type: "article",
        id: "guest-unknown",
        title: "Unknown symbol",
        description: query,
        input_message_content: {
          message_text: [
            `❓ Unknown: <code>${escapeHtml(normalizeSymbolQuery(query) || query)}</code>`,
            ``,
            `Try <code>@${escapeHtml(env.BOT_USERNAME)} USD</code>`,
            `or <code>@${escapeHtml(env.BOT_USERNAME)} 10 USDT + 5 EUR</code>`,
          ].join("\n"),
          parse_mode: "HTML",
          disable_web_page_preview: true,
        },
      };
    }

    await answerGuestQuery(env, msg.guest_query_id, result);
  } catch (e) {
    console.error("guest answer failed", e);
    try {
      await answerGuestQuery(env, msg.guest_query_id, {
        type: "article",
        id: "guest-fail",
        title: "Something went wrong",
        description: "Try again in a moment",
        input_message_content: {
          message_text: "⚠️ Couldn’t answer that guest query. Try again shortly.",
          parse_mode: "HTML",
        },
      });
    } catch (e2) {
      console.error("guest fallback failed", e2);
    }
  }
}

async function replyCalc(
  env: Env,
  chatId: number,
  query: string,
  extra: Record<string, unknown> = {},
  feePct = 0,
): Promise<void> {
  console.log("calc query", JSON.stringify(query), "fee", feePct);
  const parsed = parseCalc(query, feePct);
  if (!parsed.ok) {
    console.log("calc parse fail", parsed.error);
    await replyRich(env, chatId, richCalcError(env, parsed.error), extra);
    return;
  }
  const evaluated = await evaluateCalc(parsed, (id) => priceOf(env, id), "IRT");
  if (!evaluated.ok) {
    console.log("calc eval fail", evaluated.error);
    await replyRich(env, chatId, richCalcError(env, evaluated.error), extra);
    return;
  }
  console.log("calc total", evaluated.result.total);
  await replyRich(env, chatId, richCalc(env, evaluated.result), extra);
}

async function handleInlineCalc(env: Env, inlineQueryId: string, query: string): Promise<boolean> {
  if (!looksLikeCalc(query)) return false;
  const result = await buildCalcInlineResult(env, query);
  await answerInlineQuery(env, inlineQueryId, [result], ttlUntilNext5m());
  return true;
}

async function handleInline(env: Env, inlineQueryId: string, query: string): Promise<void> {
  const q = query.trim();

  // Calculator: "10 USDT + 5 EUR" → total IRT
  if (await handleInlineCalc(env, inlineQueryId, q)) return;

  const def = q ? resolveSymbol(q) : resolveSymbol("USD");

  if (!def) {
    await answerInlineQuery(env, inlineQueryId, [], 30);
    return;
  }

  const row = await getLatest(env.DB, def.id);
  const unit = env.PRICE_UNIT || "Toman";
  const price = row ? formatPrice(row.price) : "—";
  const delta = row ? formatDelta(row.price, row.prev_price) : "n/a";
  const when = row ? formatTimeTehran(row.updated_at) : "—";

  const inlineTtl = ttlUntilNext5m();
  const [dayRange, price24h] = await Promise.all([
    getDayHighLow(env.DB, def.id),
    getPrice24hAgo(env.DB, def.id),
  ]);
  try {
    await ensureChartPng(env, def.id);
  } catch (e) {
    console.error("inline ensureChartPng", e);
  }
  const chartUrl = chartPublicUrl(env, def.id);
  const richHtml = richSymbolPrice(env, def, row, chartUrl, dayRange, price24h);

  await answerInlineQuery(
    env,
    inlineQueryId,
    [
      {
        type: "article",
        id: def.id,
        title: `${def.emoji} ${def.id} · ${price} ${unit}`,
        description: `${def.name} · ${delta} · ${when}`,
        input_message_content: {
          rich_message: {
            html: richHtml,
            skip_entity_detection: false,
          },
        },
      },
    ],
    inlineTtl,
  );
}
