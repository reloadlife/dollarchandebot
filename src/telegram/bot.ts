import type { Env } from "../env";
import {
  normalizeSymbolQuery,
  resolveSymbol,
  searchSymbols,
} from "../symbols";
import {
  answerCallbackQuery,
  answerGuestQuery,
  answerInlineQuery,
  isDeadUpdate,
  sendMessage,
  sendRichMessage,
  type TgCallbackQuery,
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
  richMulti,
  richOhlc,
  richSymbolPrice,
  richSymbols,
  richUnknown,
} from "./rich";
import type { SymbolDef } from "../symbols";
import { chartPublicUrl, ensureChartPng, type ChartRange } from "../chart/serve";
import { listExchanges } from "../db/exchanges";
import {
  addAlert,
  countAlerts,
  deleteAlert,
  listAlerts,
  type AlertMode,
} from "../db/alerts";
import { getSettings, setFeePct, setLang, type Lang } from "../db/settings";
import { rateLimit } from "../lib/ratelimit";
import { t } from "../lib/i18n";
import {
  menuOnlyKeyboard,
  parseCallback,
  screenAlertHelp,
  screenAlerts,
  screenCategories,
  screenExchanges,
  screenHelp,
  screenHistory,
  screenHome,
  screenSettings,
  screenSymbolCard,
  screenSymbolList,
  showScreen,
  type ShowTarget,
} from "./ui";

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
    const plain = html
      .replace(/<\/?(h[1-6]|ul|ol|li|table|tr|td|th|p|tg-time|img)[^>]*>/gi, "\n")
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
    hasCb: Boolean(update.callback_query),
    text: update.message?.text?.slice(0, 80),
    date: update.message?.date,
  });

  if (update.inline_query) {
    await handleInline(env, update.inline_query.id, update.inline_query.query);
    return;
  }

  if (update.guest_message) {
    await handleGuestMessage(env, update.guest_message);
    return;
  }

  if (update.callback_query) {
    await handleCallback(env, update.callback_query);
    return;
  }

  const msg = update.message;
  if (!msg?.text || !msg.chat) {
    console.log("skip: no message text/chat");
    return;
  }

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

  const rl = await rateLimit(env.CACHE, `chat:${chatId}`, 30, 60);
  if (!rl.ok) {
    const settings = await getSettings(env.DB, String(chatId));
    await sendMessage(env, chatId, t(settings.lang, "rateLimited"));
    return;
  }

  const replyTo = msg.message_id;
  const settings = await getSettings(env.DB, String(chatId));
  const sendTarget: ShowTarget = { chatId, replyTo };

  if (command?.cmd === "start") {
    const payload = command.arg.toLowerCase();
    if (payload === "fa" || payload === "en") {
      await setLang(env.DB, String(chatId), payload as Lang);
      settings.lang = payload as Lang;
    }
    await showScreen(env, sendTarget, screenHome(env, settings.lang));
    return;
  }

  if (command?.cmd === "help") {
    await showScreen(env, sendTarget, screenHelp(env, settings.lang));
    return;
  }

  if (command?.cmd === "symbols" || command?.cmd === "symbol" || command?.cmd === "list") {
    if (command.arg.toLowerCase() === "all") {
      await replyRich(env, chatId, richSymbols(settings.lang), {
        ...replyParams(replyTo),
        reply_markup: menuOnlyKeyboard(settings.lang),
      });
      return;
    }
    await showScreen(env, sendTarget, screenCategories(settings.lang));
    return;
  }

  if (command?.cmd === "settings") {
    await showScreen(
      env,
      sendTarget,
      screenSettings(env, settings.lang, settings.fee_pct),
    );
    return;
  }
  if (command?.cmd === "lang") {
    const lang = (command.arg.toLowerCase() === "fa" ? "fa" : "en") as Lang;
    await setLang(env.DB, String(chatId), lang);
    await showScreen(env, sendTarget, screenHome(env, lang));
    return;
  }
  if (command?.cmd === "fee") {
    const n = Number(command.arg.replace("%", ""));
    if (!Number.isFinite(n)) {
      await sendMessage(env, chatId, t(settings.lang, "usageFee"));
      return;
    }
    await setFeePct(env.DB, String(chatId), n);
    await showScreen(
      env,
      sendTarget,
      screenSettings(env, settings.lang, n),
    );
    return;
  }

  if (command?.cmd === "exchanges" || command?.cmd === "usdt") {
    const rows = await listExchanges(env.DB);
    await showScreen(env, sendTarget, screenExchanges(env, settings.lang, rows));
    return;
  }

  if (command?.cmd === "compare" || command?.cmd === "vs") {
    const parts = command.arg.split(/\s+/).filter(Boolean);
    const a = resolveSymbol(parts[0] ?? "USD");
    const b = resolveSymbol(parts[1] ?? "USDT");
    if (!a || !b) {
      await sendMessage(env, chatId, t(settings.lang, "usageCompare"));
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
      {
        ...replyParams(replyTo),
        reply_markup: menuOnlyKeyboard(settings.lang),
      },
    );
    return;
  }

  if (command?.cmd === "history" || command?.cmd === "ohlc") {
    const def = resolveSymbol(command.arg || "USD");
    if (!def) {
      await sendMessage(env, chatId, t(settings.lang, "usageHistory"));
      return;
    }
    const days = await getOhlcDays(env.DB, def.id, 7);
    if (command.cmd === "ohlc") {
      await replyRich(
        env,
        chatId,
        richOhlc(env, def.id, def.emoji, days[days.length - 1] ?? null),
        {
          ...replyParams(replyTo),
          reply_markup: menuOnlyKeyboard(settings.lang),
        },
      );
    } else {
      await showScreen(
        env,
        sendTarget,
        screenHistory(env, settings.lang, def.id, def.emoji, days),
      );
    }
    return;
  }

  if (command?.cmd === "chart7d" || command?.cmd === "7d") {
    const def = resolveSymbol(command.arg || "USD");
    if (!def) {
      await sendMessage(env, chatId, t(settings.lang, "usage7d"));
      return;
    }
    await sendSymbolCard(env, chatId, def.id, settings.lang, sendTarget, "7d");
    return;
  }

  // /alert USD above 180000 [once|every] | /alerts | /unalert 3
  if (command?.cmd === "alert") {
    const m = command.arg.match(
      /^(\S+)\s+(above|below|move|pct|move_pct)\s+([\d.]+)%?(?:\s+(once|one|repeat|every|multi|always))?$/i,
    );
    if (!m) {
      await showScreen(env, sendTarget, screenAlertHelp(settings.lang));
      return;
    }
    const def = resolveSymbol(m[1] ?? "");
    if (!def) {
      await sendMessage(
        env,
        chatId,
        `${t(settings.lang, "unknownSymbol")} <code>${escapeHtml(m[1] ?? "")}</code>`,
      );
      return;
    }
    const n = await countAlerts(env.DB, String(chatId));
    if (n >= 10) {
      await sendMessage(env, chatId, t(settings.lang, "maxAlerts"));
      return;
    }
    let direction: "above" | "below" | "move_pct" = "above";
    const d = (m[2] ?? "").toLowerCase();
    if (d === "below") direction = "below";
    if (d === "move" || d === "pct" || d === "move_pct") direction = "move_pct";
    const thr = Number(m[3]);
    const modeRaw = (m[4] ?? "once").toLowerCase();
    const mode: AlertMode =
      modeRaw === "repeat" ||
      modeRaw === "every" ||
      modeRaw === "multi" ||
      modeRaw === "always"
        ? "repeat"
        : "once";
    const id = await addAlert(env.DB, String(chatId), def.id, direction, thr, mode);
    const modeLabel =
      mode === "repeat"
        ? t(settings.lang, "alertModeRepeat")
        : t(settings.lang, "alertModeOnce");
    await sendMessage(
      env,
      chatId,
      `${t(settings.lang, "alertAdded")} #${id}\n<code>${def.id}</code> ${direction} ${thr} · ${modeLabel}`,
      { reply_markup: menuOnlyKeyboard(settings.lang) },
    );
    return;
  }
  if (command?.cmd === "alerts") {
    const rows = await listAlerts(env.DB, String(chatId));
    await showScreen(env, sendTarget, screenAlerts(settings.lang, rows));
    return;
  }
  if (command?.cmd === "unalert" || command?.cmd === "delalert") {
    const id = Number(command.arg);
    if (!id) {
      await sendMessage(env, chatId, t(settings.lang, "usageUnalert"));
      return;
    }
    const ok = await deleteAlert(env.DB, String(chatId), id);
    await sendMessage(
      env,
      chatId,
      ok
        ? `${t(settings.lang, "alertDeleted")} #${id}`
        : t(settings.lang, "alertNotFound"),
    );
    if (ok) {
      const rows = await listAlerts(env.DB, String(chatId));
      await showScreen(env, { chatId }, screenAlerts(settings.lang, rows));
    }
    return;
  }

  // Multi-symbol: "USD USDT EUR"
  const multi = tryMultiSymbols(text);
  if (multi) {
    const rows: Array<{ id: string; emoji: string; price: number }> = [];
    for (const id of multi) {
      const row = await getLatest(env.DB, id);
      const def = resolveSymbol(id)!;
      if (row) rows.push({ id, emoji: def.emoji, price: row.price });
    }
    if (rows.length) {
      await replyRich(env, chatId, richMulti(env, rows), {
        ...replyParams(replyTo),
        reply_markup: menuOnlyKeyboard(settings.lang),
      });
      return;
    }
  }

  if (looksLikeCalc(text) || command?.cmd === "calc") {
    const q = command?.cmd === "calc" ? command.arg : text;
    await replyCalc(env, chatId, q, {
      ...replyParams(replyTo),
      reply_markup: menuOnlyKeyboard(settings.lang),
    }, settings.fee_pct);
    return;
  }

  // Plain symbol (optional "7d" suffix)
  const rangeMatch = text.match(/^(.+?)\s+(7d|24h)$/i);
  const symRaw = rangeMatch ? rangeMatch[1]! : text;
  const range: ChartRange = rangeMatch?.[2]?.toLowerCase() === "7d" ? "7d" : "24h";
  const def = resolveSymbol(symRaw);
  if (!def) {
    if (command) {
      await sendMessage(env, chatId, t(settings.lang, "unknown"));
      return;
    }
    // Try search suggestions for unknown text
    const hits = searchSymbols(text, 5);
    if (hits.length) {
      const lines = hits
        .map((s) => `• ${s.emoji} <code>${s.id}</code> — ${escapeHtml(s.name)}`)
        .join("\n");
      await replyRich(
        env,
        chatId,
        `<h3>❓ ${escapeHtml(normalizeSymbolQuery(text) || text)}</h3>
<p>${settings.lang === "fa" ? "منظورت یکی از اینا بود؟" : "Did you mean?"}</p>
<p>${lines}</p>
<p><i>${settings.lang === "fa" ? "کد را بفرست یا /start" : "Send a code or /start"}</i></p>`,
        {
          ...replyParams(replyTo),
          reply_markup: {
            inline_keyboard: [
              ...chunk(
                hits.map((s) => ({
                  text: `${s.emoji} ${s.id}`,
                  callback_data: `s:${s.id}`,
                })),
                3,
              ),
              [{ text: t(settings.lang, "uiMenu"), callback_data: "h" }],
            ],
          },
        },
      );
      return;
    }
    const shown = normalizeSymbolQuery(text) || text;
    await replyRich(env, chatId, richUnknown(shown, settings.lang), {
      ...replyParams(replyTo),
      reply_markup: menuOnlyKeyboard(settings.lang),
    });
    return;
  }

  await sendSymbolCard(env, chatId, def.id, settings.lang, sendTarget, range);
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function handleCallback(env: Env, cq: TgCallbackQuery): Promise<void> {
  const data = cq.data ?? "";
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  if (!chatId) {
    await answerCallbackQuery(env, cq.id).catch(() => undefined);
    return;
  }

  const parsed = parseCallback(data);
  if (parsed.type === "noop") {
    await answerCallbackQuery(env, cq.id).catch(() => undefined);
    return;
  }

  let settings = await getSettings(env.DB, String(chatId));
  const target: ShowTarget = {
    chatId,
    messageId: messageId && messageId > 0 ? messageId : undefined,
  };

  let toast: string | undefined;

  try {
    switch (parsed.type) {
      case "home":
        await showScreen(env, target, screenHome(env, settings.lang));
        break;

      case "categories":
        await showScreen(env, target, screenCategories(settings.lang));
        break;

      case "browse":
        await showScreen(
          env,
          target,
          screenSymbolList(settings.lang, parsed.kind, parsed.page),
        );
        break;

      case "symbol": {
        const def = resolveSymbol(parsed.id);
        if (!def) {
          await showScreen(env, target, screenCategories(settings.lang));
          break;
        }
        await renderSymbolScreen(env, target, settings.lang, def.id, parsed.range);
        break;
      }

      case "history": {
        const def = resolveSymbol(parsed.id);
        if (!def) break;
        const days = await getOhlcDays(env.DB, def.id, 7);
        await showScreen(
          env,
          target,
          screenHistory(env, settings.lang, def.id, def.emoji, days),
        );
        break;
      }

      case "exchanges": {
        const rows = await listExchanges(env.DB);
        await showScreen(
          env,
          target,
          screenExchanges(env, settings.lang, rows),
        );
        break;
      }

      case "alerts": {
        const rows = await listAlerts(env.DB, String(chatId));
        await showScreen(env, target, screenAlerts(settings.lang, rows));
        break;
      }

      case "alertDelete": {
        const ok = await deleteAlert(env.DB, String(chatId), parsed.id);
        const rows = await listAlerts(env.DB, String(chatId));
        await showScreen(env, target, screenAlerts(settings.lang, rows));
        toast = ok
          ? t(settings.lang, "toastDeleted")
          : t(settings.lang, "alertNotFound");
        break;
      }

      case "alertHelp":
        await showScreen(env, target, screenAlertHelp(settings.lang));
        break;

      case "settings":
        await showScreen(
          env,
          target,
          screenSettings(env, settings.lang, settings.fee_pct),
        );
        break;

      case "setLang": {
        await setLang(env.DB, String(chatId), parsed.lang);
        settings = await getSettings(env.DB, String(chatId));
        await showScreen(
          env,
          target,
          screenSettings(env, settings.lang, settings.fee_pct),
        );
        toast =
          parsed.lang === "fa"
            ? t(settings.lang, "toastLangFa")
            : t(settings.lang, "toastLangEn");
        break;
      }

      case "setFee": {
        await setFeePct(env.DB, String(chatId), parsed.fee);
        settings = await getSettings(env.DB, String(chatId));
        await showScreen(
          env,
          target,
          screenSettings(env, settings.lang, settings.fee_pct),
        );
        toast = t(settings.lang, "toastFee");
        break;
      }

      case "help":
        await showScreen(env, target, screenHelp(env, settings.lang));
        break;

      default:
        await showScreen(env, target, screenHome(env, settings.lang));
        break;
    }

    await answerCallbackQuery(env, cq.id, toast).catch(() => undefined);
  } catch (e) {
    console.error("callback failed", e);
    await answerCallbackQuery(env, cq.id, "Error").catch(() => undefined);
  }
}

async function renderSymbolScreen(
  env: Env,
  target: ShowTarget,
  lang: Lang,
  symbolId: string,
  range: ChartRange,
): Promise<void> {
  const def = resolveSymbol(symbolId);
  if (!def) return;
  const row = await getLatest(env.DB, def.id);
  const [dayRange, price24h] = await Promise.all([
    getDayHighLow(env.DB, def.id),
    getPrice24hAgo(env.DB, def.id),
  ]);
  await ensureChartPng(env, def.id, range).catch((e) =>
    console.error("ensureChartPng", e),
  );
  const chartUrl = chartPublicUrl(env, def.id, range);
  await showScreen(
    env,
    target,
    screenSymbolCard(env, lang, def, row, chartUrl, dayRange, price24h, range),
  );
}

async function sendSymbolCard(
  env: Env,
  chatId: string | number,
  symbolId: string,
  lang: Lang,
  target: ShowTarget,
  range: ChartRange = "24h",
): Promise<void> {
  await renderSymbolScreen(env, { ...target, chatId }, lang, symbolId, range);
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

function extractGuestQuery(text: string, botUsername: string): string {
  const re = new RegExp(
    `@${botUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
    "gi",
  );
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
        `DM me for charts anytime · /start`,
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

async function buildSymbolInlineResult(
  env: Env,
  def: SymbolDef,
): Promise<Record<string, unknown>> {
  const row = await getLatest(env.DB, def.id);
  const [dayRange, price24h] = await Promise.all([
    getDayHighLow(env.DB, def.id),
    getPrice24hAgo(env.DB, def.id),
  ]);
  const unit = "IRT";
  const price = row ? formatPrice(row.price) : "—";
  const delta = row ? formatDelta(row.price, row.prev_price) : "n/a";
  const when = row ? formatTimeTehran(row.updated_at) : "—";

  try {
    await ensureChartPng(env, def.id);
  } catch (e) {
    console.error("inline ensureChartPng", e);
  }
  const chartUrl = chartPublicUrl(env, def.id);
  const richHtml = richSymbolPrice(env, def, row, chartUrl, dayRange, price24h);

  return {
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
  };
}

async function buildSymbolGuestResult(
  env: Env,
  symbolRaw: string,
): Promise<Record<string, unknown> | null> {
  const def = resolveSymbol(symbolRaw);
  if (!def) return null;
  return buildSymbolInlineResult(env, def);
}

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
      if (symbolResult) {
        result = symbolResult;
      } else {
        const hits = searchSymbols(query, 1);
        if (hits[0]) {
          result = await buildSymbolInlineResult(env, hits[0]);
        } else {
          result = {
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
      }
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

async function handleInline(
  env: Env,
  inlineQueryId: string,
  query: string,
): Promise<void> {
  const q = query.trim();

  if (looksLikeCalc(q)) {
    const result = await buildCalcInlineResult(env, q);
    await answerInlineQuery(env, inlineQueryId, [result], ttlUntilNext5m());
    return;
  }

  const matches = searchSymbols(q, 8);
  if (!matches.length) {
    await answerInlineQuery(env, inlineQueryId, [], 30);
    return;
  }

  const inlineTtl = ttlUntilNext5m();
  // Warm charts in parallel; build results
  const results = await Promise.all(
    matches.map((def) => buildSymbolInlineResult(env, def)),
  );

  await answerInlineQuery(env, inlineQueryId, results, inlineTtl);
}
