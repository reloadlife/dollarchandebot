import type { Env } from "../env";
import {
  displayName,
  normalizeSymbolQuery,
  quoteUnit,
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
import { apiKeyIdForChat, rotateApiKey } from "../api/keys";
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
  richHelp,
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
  crossThreshold,
  decodePending,
  encodePending,
  parseAlertAmount,
  pendingAlertKey,
  type PendingAlert,
  type WizardDirection,
} from "./alert-flow";
import { isGroupChat, packEphemeral } from "./ephemeral";
import {
  buildFeedHtml,
  deleteGroupFeed,
  hasGroupFeed,
  intervalLabel,
  isChatAdmin,
  parseEvery,
  parseFeedStart,
  saveGroupFeed,
} from "../group/feeds";
import { bumpUsage, formatUsage, usageReport } from "../db/usage";
import { publishBotMenu } from "./commands";

import {
  menuOnlyKeyboard,
  parseCallback,
  screenAlertAmount,
  screenAlertCross,
  screenAlertDirection,
  screenAlertHelp,
  screenAlertMode,
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
  target?: ShowTarget,
): Promise<void> {
  const packed = target ? packEphemeral(target.ephemeral, extra) : extra;
  try {
    await sendRichMessage(env, chatId, html, packed);
  } catch (e) {
    console.error("sendRichMessage failed, fallback sendMessage", e);
    const plain = html
      .replace(/<\/?(h[1-6]|ul|ol|li|table|tr|td|th|p|tg-time|img)[^>]*>/gi, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    await sendMessage(env, chatId, plain, packed);
  }
}

function replyParams(messageId?: number): Record<string, unknown> {
  if (messageId == null || messageId <= 0) return {};
  return { reply_parameters: { message_id: messageId } };
}

async function handleBotJoined(
  env: Env,
  update: NonNullable<TgUpdate["my_chat_member"]>,
): Promise<void> {
  const chat = update.chat;
  if (chat.type !== "group" && chat.type !== "supergroup") return;
  if (env.TELEGRAM_CHANNEL_ID && String(chat.id) === String(env.TELEGRAM_CHANNEL_ID)) return;
  const next = update.new_chat_member?.status;
  const prev = update.old_chat_member?.status;
  const joined = (next === "member" || next === "administrator") && (prev === "left" || prev === "kicked" || !prev);
  if (!joined) {
    if (next === "left" || next === "kicked") await deleteGroupFeed(env, String(chat.id));
    return;
  }
  await sendMessage(env, chat.id, t("fa", "groupWelcome"), { disable_web_page_preview: true });
}

async function handleEvery(
  env: Env,
  chatId: number,
  msg: TgMessage,
  arg: string,
  lang: Lang,
): Promise<void> {
  const fa = lang === "fa";
  if (!isGroupChat(msg.chat.type)) {
    await sendMessage(env, chatId, t(lang, "everyPrivate"));
    return;
  }
  const parsed = parseEvery(arg);
  if (!parsed.ok) {
    const key = parsed.reason === "interval" ? "everyBadInterval" : parsed.reason === "symbol" ? "everyBadSymbol" : "everyUsage";
    await sendMessage(env, chatId, t(lang, key));
    return;
  }
  const userId = msg.from?.id;
  if (userId == null || !(await isChatAdmin(env, chatId, userId))) {
    await sendMessage(env, chatId, t(lang, "everyNeedAdmin"));
    return;
  }
  if (parsed.off) {
    await deleteGroupFeed(env, String(chatId));
    await sendMessage(env, chatId, t(lang, "everyOff"));
    return;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  await storeGroupFeed(env, chatId, parsed.everyMin, parsed.symbol, nowSec);
  const html = await buildFeedHtml(env, parsed.symbol, true);
  try {
    await sendRichMessage(env, chatId, html, { disable_notification: true });
  } catch (e) {
    console.error("group feed first post", e);
  }
  const what = parsed.symbol ?? (fa ? "تابلو" : "board");
  await sendMessage(
    env,
    chatId,
    `${t(lang, "everySet")}\n${intervalLabel(parsed.everyMin, fa)} · ${escapeHtml(what)}`,
  );
}

/** Count a group the first time it asks for a feed. Later edits of the same group do not count again. */
async function storeGroupFeed(
  env: Env,
  chatId: string | number,
  everyMin: number,
  symbol: string | null,
  nowSec: number,
): Promise<void> {
  const id = String(chatId);
  const fresh = !(await hasGroupFeed(env, id));
  await saveGroupFeed(env, id, everyMin, symbol, nowSec);
  if (fresh) await bumpUsage(env.DB, "feed").catch((e) => console.error("usage feed", e));
}

/** Hourly group post from the price screen. Private chats are told to add the bot to a group. */
async function handleFeedStart(
  env: Env,
  chatId: number,
  msg: TgMessage,
  lang: Lang,
  symbol: string | null,
): Promise<void> {
  if (!isGroupChat(msg.chat.type)) {
    await sendMessage(env, chatId, t(lang, "everyPrivate"));
    return;
  }
  const userId = msg.from?.id;
  if (userId == null || !(await isChatAdmin(env, chatId, userId))) {
    await sendMessage(env, chatId, t(lang, "everyNeedAdmin"));
    return;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  await storeGroupFeed(env, chatId, 60, symbol, nowSec);
  const html = await buildFeedHtml(env, symbol, true);
  try {
    await sendRichMessage(env, chatId, html, { disable_notification: true });
  } catch (e) {
    console.error("group feed first post", e);
  }
  const fa = lang === "fa";
  const what = symbol ?? (fa ? "تابلو" : "board");
  await sendMessage(
    env,
    chatId,
    `${t(lang, "everySet")}\n${intervalLabel(60, fa)} · ${escapeHtml(what)}`,
  );
}

async function handleStats(
  env: Env,
  chatId: number,
  msg: TgMessage,
  lang: Lang,
): Promise<void> {
  const quiet = packEphemeral(
    isGroupChat(msg.chat.type) && msg.ephemeral_message_id && msg.from
      ? { receiverUserId: msg.from.id, ephemeralMessageId: msg.ephemeral_message_id }
      : undefined,
  );
  if (msg.chat.type !== "private") {
    await sendMessage(env, chatId, t(lang, "statsPrivate"), quiet);
    return;
  }
  const userId = msg.from?.id;
  if (!userId || !env.TELEGRAM_CHANNEL_ID) {
    await sendMessage(env, chatId, t(lang, "setCommandsDenied"), quiet);
    return;
  }
  let admin = false;
  try {
    admin = await isChatAdmin(env, env.TELEGRAM_CHANNEL_ID, userId);
  } catch (e) {
    console.error("stats admin", e);
    await sendMessage(env, chatId, t(lang, "setCommandsFail"), quiet);
    return;
  }
  if (!admin) {
    await sendMessage(env, chatId, t(lang, "setCommandsDenied"), quiet);
    return;
  }
  try {
    const report = await usageReport(env.DB);
    await sendMessage(env, chatId, formatUsage(lang, report), quiet);
  } catch (e) {
    console.error("stats", e);
    await sendMessage(env, chatId, t(lang, "setCommandsFail"), quiet);
  }
}

async function handleSetCommands(
  env: Env,
  chatId: number,
  msg: TgMessage,
  lang: Lang,
): Promise<void> {
  const quiet = packEphemeral(
    isGroupChat(msg.chat.type) && msg.ephemeral_message_id && msg.from
      ? { receiverUserId: msg.from.id, ephemeralMessageId: msg.ephemeral_message_id }
      : undefined,
  );
  if (msg.chat.type !== "private") {
    await sendMessage(env, chatId, t(lang, "setCommandsPrivate"), quiet);
    return;
  }
  const userId = msg.from?.id;
  if (!userId || !env.TELEGRAM_CHANNEL_ID) {
    await sendMessage(env, chatId, t(lang, "setCommandsDenied"));
    return;
  }
  let admin = false;
  try {
    admin = await isChatAdmin(env, env.TELEGRAM_CHANNEL_ID, userId);
  } catch (e) {
    console.error("setcommands admin", e);
    await sendMessage(env, chatId, t(lang, "setCommandsFail"));
    return;
  }
  if (!admin) {
    await sendMessage(env, chatId, t(lang, "setCommandsDenied"));
    return;
  }
  try {
    await publishBotMenu(env);
  } catch (e) {
    console.error("setcommands", e);
    await sendMessage(env, chatId, t(lang, "setCommandsFail"));
    return;
  }
  await sendMessage(env, chatId, t(lang, "setCommandsOk"));
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
    await handleInline(
      env,
      update.inline_query.id,
      update.inline_query.query,
      update.inline_query.from.id,
    );
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

  if (update.my_chat_member) {
    await handleBotJoined(env, update.my_chat_member);
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
    await sendMessage(env, chatId, t(settings.lang, "rateLimited"), packEphemeral(msg.ephemeral_message_id && msg.from && isGroupChat(msg.chat.type) ? { receiverUserId: msg.from.id, ephemeralMessageId: msg.ephemeral_message_id } : undefined));
    return;
  }

  const replyTo = msg.message_id;
  const settings = await getSettings(env.DB, String(chatId));
  const sendTarget: ShowTarget = {
    chatId,
    replyTo: msg.ephemeral_message_id ? undefined : replyTo,
    ephemeral:
      isGroupChat(msg.chat.type) && msg.ephemeral_message_id && msg.from
        ? { receiverUserId: msg.from.id, ephemeralMessageId: msg.ephemeral_message_id }
        : undefined,
  };

  if (command) {
    await clearPendingAlert(env, chatId);
  } else if (await continueAlertWizard(env, chatId, text, settings.lang, sendTarget)) {
    return;
  }

  if (command?.cmd === "start") {
    const payload = command.arg.trim();
    if (!isGroupChat(msg.chat.type)) {
      await bumpUsage(env.DB, "start").catch((e) => console.error("usage start", e));
    }
    const feed = parseFeedStart(payload);
    if (feed) {
      await handleFeedStart(env, chatId, msg, settings.lang, feed.symbol);
      return;
    }
    const lower = payload.toLowerCase();
    if (lower === "fa" || lower === "en") {
      await setLang(env.DB, String(chatId), lower as Lang);
      settings.lang = lower as Lang;
      await showScreen(env, sendTarget, await screenHome(env, settings.lang));
      return;
    }
    const range: ChartRange = /_7d$/i.test(payload) ? "7d" : "24h";
    const started = resolveSymbol(payload.replace(/_7d$/i, ""));
    if (started) {
      await sendSymbolCard(env, chatId, started.id, settings.lang, sendTarget, range);
      return;
    }
    await showScreen(env, sendTarget, await screenHome(env, settings.lang));
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
      }, sendTarget);
      return;
    }
    await showScreen(env, sendTarget, screenCategories(settings.lang));
    return;
  }

  if (command?.cmd === "every") {
    await handleEvery(env, chatId, msg, command.arg, settings.lang);
    return;
  }

  if (command?.cmd === "stats") {
    await handleStats(env, chatId, msg, settings.lang);
    return;
  }

  if (command?.cmd === "setcommands") {
    await handleSetCommands(env, chatId, msg, settings.lang);
    return;
  }

  if (command?.cmd === "key" || command?.cmd === "apikey") {
    const rotate = /^(new|rotate|reset)$/i.test(command.arg);
    const existing = rotate ? null : await apiKeyIdForChat(env, String(chatId));
    if (existing) {
      const hint = settings.lang === "fa"
        ? `یک کلید داری، شناسه <code>${escapeHtml(existing)}</code>.\nبرای کلید تازه: <code>/key new</code>\nکلید قبلی از کار می‌افتد.`
        : `You already have a key, id <code>${escapeHtml(existing)}</code>.\nFor a new one: <code>/key new</code>\nThe old key stops working.`;
      await sendMessage(env, chatId, hint, packEphemeral(sendTarget.ephemeral));
      return;
    }
    const key = await rotateApiKey(env, String(chatId));
    const body = settings.lang === "fa"
      ? `کلید API:\n<code>${escapeHtml(key)}</code>\n\nدر افزونه همین را بگذار، یا:\n<code>Authorization: Bearer ${escapeHtml(key)}</code>\n\nحدود ۶۰ درخواست در دقیقه. این پیام را نگه دار. دوباره نشان داده نمی‌شود.`
      : `API key:\n<code>${escapeHtml(key)}</code>\n\nPaste it into the plugin, or send:\n<code>Authorization: Bearer ${escapeHtml(key)}</code>\n\nAbout 60 requests a minute. Keep this message. It is not shown again.`;
    await sendMessage(env, chatId, body, packEphemeral(sendTarget.ephemeral));
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
    await showScreen(env, sendTarget, await screenHome(env, lang));
    return;
  }
  if (command?.cmd === "fee") {
    const n = Number(command.arg.replace("%", ""));
    if (!Number.isFinite(n)) {
      await sendMessage(env, chatId, t(settings.lang, "usageFee"), packEphemeral(sendTarget.ephemeral));
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
      await sendMessage(env, chatId, t(settings.lang, "usageCompare"), packEphemeral(sendTarget.ephemeral));
      return;
    }
    const [ra, rb] = await Promise.all([getLatest(env.DB, a.id), getLatest(env.DB, b.id)]);
    if (!ra || !rb) {
      await sendMessage(env, chatId, t(settings.lang, "needPrice"), packEphemeral(sendTarget.ephemeral));
      return;
    }
    await replyRich(
      env,
      chatId,
      richCompare(
        env,
        { id: a.id, name: a.name, emoji: a.emoji, price: ra.price },
        { id: b.id, name: b.name, emoji: b.emoji, price: rb.price },
        settings.lang,
      ),
      {
        ...replyParams(replyTo),
        reply_markup: menuOnlyKeyboard(settings.lang),
      },
      sendTarget,
    );
    return;
  }

  if (command?.cmd === "history" || command?.cmd === "ohlc") {
    const def = resolveSymbol(command.arg || "USD");
    if (!def) {
      await sendMessage(env, chatId, t(settings.lang, "usageHistory"), packEphemeral(sendTarget.ephemeral));
      return;
    }
    const days = await getOhlcDays(env.DB, def.id, 7);
    if (command.cmd === "ohlc") {
      await replyRich(
        env,
        chatId,
        richOhlc(env, def.id, def.emoji, days[days.length - 1] ?? null, settings.lang),
        {
          ...replyParams(replyTo),
          reply_markup: menuOnlyKeyboard(settings.lang),
        },
        sendTarget,
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
      await sendMessage(env, chatId, t(settings.lang, "usage7d"), packEphemeral(sendTarget.ephemeral));
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
        packEphemeral(sendTarget.ephemeral),
      );
      return;
    }
    const n = await countAlerts(env.DB, String(chatId));
    if (n >= 10) {
      await sendMessage(env, chatId, t(settings.lang, "maxAlerts"), packEphemeral(sendTarget.ephemeral));
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
    await bumpUsage(env.DB, "alert").catch((e) => console.error("usage alert", e));
    const modeLabel =
      mode === "repeat"
        ? t(settings.lang, "alertModeRepeat")
        : t(settings.lang, "alertModeOnce");
    await sendMessage(
      env,
      chatId,
      `${t(settings.lang, "alertAdded")} #${id}\n${escapeHtml(displayName(def, settings.lang))} <code>${def.id}</code> ${direction} ${thr} · ${modeLabel}`,
      packEphemeral(sendTarget.ephemeral, { reply_markup: menuOnlyKeyboard(settings.lang) }),
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
      await sendMessage(env, chatId, t(settings.lang, "usageUnalert"), packEphemeral(sendTarget.ephemeral));
      return;
    }
    const ok = await deleteAlert(env.DB, String(chatId), id);
    await sendMessage(
      env,
      chatId,
      ok
        ? `${t(settings.lang, "alertDeleted")} #${id}`
        : t(settings.lang, "alertNotFound"),
      packEphemeral(sendTarget.ephemeral),
    );
    if (ok) {
      const rows = await listAlerts(env.DB, String(chatId));
      await showScreen(env, sendTarget, screenAlerts(settings.lang, rows));
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
      await replyRich(env, chatId, richMulti(env, rows, settings.lang), {
        ...replyParams(replyTo),
        reply_markup: menuOnlyKeyboard(settings.lang),
      }, sendTarget);
      return;
    }
  }

  if (looksLikeCalc(text) || command?.cmd === "calc") {
    const q = command?.cmd === "calc" ? command.arg : text;
    await replyCalc(env, chatId, q, packEphemeral(sendTarget.ephemeral, {
      ...replyParams(replyTo),
      reply_markup: menuOnlyKeyboard(settings.lang),
    }), settings.fee_pct);
    return;
  }

  // Plain symbol (optional "7d" suffix)
  const rangeMatch = text.match(/^(.+?)\s+(7d|24h)$/i);
  const symRaw = rangeMatch ? rangeMatch[1]! : text;
  const range: ChartRange = rangeMatch?.[2]?.toLowerCase() === "7d" ? "7d" : "24h";
  const def = resolveSymbol(symRaw);
  if (!def) {
    if (command) {
      await sendMessage(env, chatId, t(settings.lang, "unknown"), packEphemeral(sendTarget.ephemeral));
      return;
    }
    // Try search suggestions for unknown text
    const hits = searchSymbols(text, 5);
    if (hits.length) {
      const lines = hits
        .map((s) => `• ${s.emoji} <code>${s.id}</code> — ${escapeHtml(displayName(s, settings.lang))}`)
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
                  text: `${s.emoji} ${displayName(s, settings.lang)}`,
                  callback_data: `s:${s.id}`,
                })),
                3,
              ),
              [{ text: t(settings.lang, "uiMenu"), callback_data: "h" }],
            ],
          },
        },
        sendTarget,
      );
      return;
    }
    const shown = normalizeSymbolQuery(text) || text;
    await replyRich(env, chatId, richUnknown(shown, settings.lang), {
      ...replyParams(replyTo),
      reply_markup: menuOnlyKeyboard(settings.lang),
    }, sendTarget);
    return;
  }

  await sendSymbolCard(env, chatId, def.id, settings.lang, sendTarget, range);
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const WIZARD_TTL_SEC = 600;

async function loadPendingAlert(
  env: Env,
  chatId: string | number,
): Promise<PendingAlert | null> {
  return decodePending(await env.CACHE.get(pendingAlertKey(chatId)));
}

async function savePendingAlert(
  env: Env,
  chatId: string | number,
  pending: PendingAlert,
): Promise<void> {
  await env.CACHE.put(pendingAlertKey(chatId), encodePending(pending), {
    expirationTtl: WIZARD_TTL_SEC,
  });
}

async function clearPendingAlert(env: Env, chatId: string | number): Promise<void> {
  await env.CACHE.delete(pendingAlertKey(chatId));
}

/** Bare number while a wizard is open sets the threshold and asks once vs every. */
async function continueAlertWizard(
  env: Env,
  chatId: string | number,
  text: string,
  lang: Lang,
  target: ShowTarget,
): Promise<boolean> {
  const pending = await loadPendingAlert(env, chatId);
  if (!pending) return false;
  const amount = parseAlertAmount(text);
  if (amount == null) {
    if (pending.threshold == null) await clearPendingAlert(env, chatId);
    return false;
  }
  await savePendingAlert(env, chatId, { ...pending, threshold: amount });
  await showScreen(
    env,
    target,
    screenAlertMode(lang, pending.symbol, pending.direction, amount),
  );
  return true;
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
  const chatType = cq.message?.chat?.type;
  const ephId = cq.message?.ephemeral_message_id;
  const target: ShowTarget = {
    chatId,
    messageId: messageId && messageId > 0 ? messageId : undefined,
  };
  if (isGroupChat(chatType) && cq.from?.id) {
    if (ephId) {
      target.ephemeral = { receiverUserId: cq.from.id, ephemeralMessageId: ephId };
      target.messageId = ephId;
    } else {
      // Don't rewrite a message the whole group can see. Answer this person only.
      target.ephemeral = { receiverUserId: cq.from.id, callbackQueryId: cq.id };
      target.messageId = undefined;
    }
  }

  let toast: string | undefined;

  try {
    switch (parsed.type) {
      case "home":
        await showScreen(env, target, await screenHome(env, settings.lang));
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

      case "alertAt": {
        const def = resolveSymbol(parsed.id);
        if (!def) break;
        const n = await countAlerts(env.DB, String(chatId));
        if (n >= 10) {
          toast = t(settings.lang, "maxAlerts");
          const rows = await listAlerts(env.DB, String(chatId));
          await showScreen(env, target, screenAlerts(settings.lang, rows));
          break;
        }
        const row = await getLatest(env.DB, def.id);
        if (row?.price == null) {
          toast = t(settings.lang, "needPrice");
          break;
        }
        const { shown, threshold } = crossThreshold(row.price);
        await savePendingAlert(env, chatId, {
          symbol: def.id,
          direction: "above",
          threshold,
        });
        await showScreen(env, target, screenAlertCross(settings.lang, def.id, shown));
        break;
      }

      case "alertNew": {
        const n = await countAlerts(env.DB, String(chatId));
        if (n >= 10) {
          toast = t(settings.lang, "maxAlerts");
          const rows = await listAlerts(env.DB, String(chatId));
          await showScreen(env, target, screenAlerts(settings.lang, rows));
          break;
        }
        if (!resolveSymbol(parsed.id)) break;
        await showScreen(env, target, screenAlertDirection(settings.lang, parsed.id));
        break;
      }

      case "alertDir": {
        const direction: WizardDirection =
          parsed.direction === "below"
            ? "below"
            : parsed.direction === "move"
              ? "move_pct"
              : "above";
        if (!resolveSymbol(parsed.id)) break;
        await savePendingAlert(env, chatId, { symbol: parsed.id, direction });
        await showScreen(
          env,
          target,
          screenAlertAmount(settings.lang, parsed.id, direction),
        );
        break;
      }

      case "alertArm": {
        const pending = await loadPendingAlert(env, chatId);
        if (!pending?.threshold) {
          await showScreen(env, target, screenAlertHelp(settings.lang));
          break;
        }
        const n = await countAlerts(env.DB, String(chatId));
        if (n >= 10) {
          toast = t(settings.lang, "maxAlerts");
          break;
        }
        const mode: AlertMode = parsed.mode === "every" ? "repeat" : "once";
        const id = await addAlert(
          env.DB,
          String(chatId),
          pending.symbol,
          pending.direction,
          pending.threshold,
          mode,
        );
        await bumpUsage(env.DB, "alert").catch((e) => console.error("usage alert", e));
        await clearPendingAlert(env, chatId);
        const rows = await listAlerts(env.DB, String(chatId));
        await showScreen(env, target, screenAlerts(settings.lang, rows));
        toast = `${t(settings.lang, "alertAdded")} #${id}`;
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
        await showScreen(env, target, await screenHome(env, settings.lang));
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

function richArticle(
  id: string,
  title: string,
  description: string,
  html: string,
): Record<string, unknown> {
  return {
    type: "article",
    id,
    title,
    description,
    input_message_content: {
      rich_message: {
        html,
        skip_entity_detection: false,
      },
    },
  };
}

function guestHelpArticle(env: Env, lang: Lang): Record<string, unknown> {
  return richArticle(
    "guest-help",
    "Dollar Chande",
    lang === "fa" ? "USD · ۱۰ تتر + ۵ یورو" : "USD · 10 USDT + 5 EUR",
    richHelp(env, lang),
  );
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
  lang: Lang = "en",
): Promise<Record<string, unknown>> {
  const row = await getLatest(env.DB, def.id);
  const [dayRange, price24h] = await Promise.all([
    getDayHighLow(env.DB, def.id),
    getPrice24hAgo(env.DB, def.id),
  ]);
  const unit = quoteUnit(def.id, lang, "IRT");
  const price = row ? formatPrice(row.price) : "—";
  const delta = row ? formatDelta(row.price, row.prev_price) : "n/a";
  const when = row ? formatTimeTehran(row.updated_at) : "—";

  try {
    await ensureChartPng(env, def.id);
  } catch (e) {
    console.error("inline ensureChartPng", e);
  }
  const chartUrl = chartPublicUrl(env, def.id);
  const richHtml = richSymbolPrice(env, def, row, chartUrl, dayRange, price24h, lang, "24h", "link");

  return {
    type: "article",
    id: def.id,
    title: `${def.emoji} ${displayName(def, lang)} · ${price} ${unit}`,
    description: `${displayName(def, lang)} · ${delta} · ${when}`,
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
  lang: Lang = "en",
): Promise<Record<string, unknown> | null> {
  const def = resolveSymbol(symbolRaw);
  if (!def) return null;
  return buildSymbolInlineResult(env, def, lang);
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
  const guestLang: Lang = msg.from
    ? (await getSettings(env.DB, String(msg.from.id))).lang
    : "en";

  try {
    let result: Record<string, unknown>;

    if (!query) {
      result = guestHelpArticle(env, guestLang);
    } else if (looksLikeCalc(query)) {
      result = await buildCalcInlineResult(env, query);
    } else {
      const symbolResult = await buildSymbolGuestResult(env, query, guestLang);
      if (symbolResult) {
        result = symbolResult;
      } else {
        const hits = searchSymbols(query, 1);
        if (hits[0]) {
          result = await buildSymbolInlineResult(env, hits[0], guestLang);
        } else {
          const shown = normalizeSymbolQuery(query) || query;
          result = richArticle(
            "guest-unknown",
            t(guestLang, "unknownSymbol"),
            shown.slice(0, 80),
            richUnknown(shown, guestLang),
          );
        }
      }
    }

    await answerGuestQuery(env, msg.guest_query_id, result);
  } catch (e) {
    console.error("guest answer failed", e);
    try {
      await answerGuestQuery(
        env,
        msg.guest_query_id,
        richArticle(
          "guest-fail",
          "Dollar Chande",
          guestLang === "fa" ? "دوباره تلاش کن" : "Try again in a moment",
          guestLang === "fa"
            ? "<p>الان جواب نداد. کمی بعد دوباره بفرست.</p>"
            : "<p>Couldn’t answer that just now. Try again shortly.</p>",
        ),
      );
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
  userId: number,
): Promise<void> {
  const q = query.trim();
  const lang = (await getSettings(env.DB, String(userId))).lang;

  if (looksLikeCalc(q)) {
    const result = await buildCalcInlineResult(env, q);
    await answerInlineQuery(env, inlineQueryId, [result], ttlUntilNext5m());
    return;
  }

  const matches = searchSymbols(q, 8);
  if (!matches.length) {
    const shown = normalizeSymbolQuery(q) || q;
    await answerInlineQuery(
      env,
      inlineQueryId,
      [
        richArticle(
          "unknown",
          t(lang, "unknownSymbol"),
          shown.slice(0, 80),
          richUnknown(shown, lang),
        ),
      ],
      30,
    );
    return;
  }

  const inlineTtl = ttlUntilNext5m();
  // Warm charts in parallel; build results
  const results = await Promise.all(
    matches.map((def) => buildSymbolInlineResult(env, def, lang)),
  );

  await answerInlineQuery(env, inlineQueryId, results, inlineTtl);
}
