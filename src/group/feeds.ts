import type { Env } from "../env";
import { getAllLatest, getLatest } from "../db/prices";
import { escapeHtml, formatPrice } from "../lib/format";
import { resolveSymbol } from "../symbols";
import { TelegramError, callTelegram, sendMessage, sendRichMessage } from "../telegram/api";

/** Minimum gap is 15 minutes so a group cannot be spammed. */
export const FEED_MINUTES = [15, 30, 60, 180, 360, 1440] as const;

const BOARD = [
  { id: "USD", fa: "دلار", en: "USD" },
  { id: "USDT", fa: "تتر", en: "USDT" },
  { id: "GOLD18", fa: "طلا", en: "Gold" },
  { id: "EMAMI", fa: "سکه", en: "Emami" },
] as const;

export type EveryParse =
  | { ok: true; off: true }
  | { ok: true; off: false; everyMin: number; symbol: string | null }
  | { ok: false; reason: "usage" | "interval" | "symbol" };

export function parseEvery(arg: string): EveryParse {
  const parts = arg.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { ok: false, reason: "usage" };
  const head = parts[0] ?? "";
  if (/^(off|stop|0)$/i.test(head)) return { ok: true, off: true };

  let interval = head.toLowerCase();
  let symbolRaw = parts[1] ?? "";
  if (symbolRaw && !/^\d/.test(interval) && /^\d/.test(symbolRaw)) {
    symbolRaw = interval;
    interval = parts[1]!.toLowerCase();
  }
  const everyMin = minutesOf(interval);
  if (everyMin == null || !FEED_MINUTES.includes(everyMin as (typeof FEED_MINUTES)[number])) {
    return { ok: false, reason: "interval" };
  }
  if (!symbolRaw) return { ok: true, off: false, everyMin, symbol: null };
  const symbol = resolveSymbol(symbolRaw);
  if (!symbol) return { ok: false, reason: "symbol" };
  return { ok: true, off: false, everyMin, symbol: symbol.id };
}

function minutesOf(raw: string): number | null {
  const match = /^(\d+)(m|min|h|hr|d)?$/.exec(raw);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = match[2] ?? "m";
  if (unit === "h" || unit === "hr") return n * 60;
  if (unit === "d") return n * 1440;
  return n;
}

export function intervalLabel(everyMin: number, fa: boolean): string {
  if (everyMin % 1440 === 0) return fa ? `${everyMin / 1440} روز` : `${everyMin / 1440}d`;
  if (everyMin % 60 === 0) return fa ? `${everyMin / 60} ساعت` : `${everyMin / 60}h`;
  return fa ? `${everyMin} دقیقه` : `${everyMin}m`;
}

type FeedRow = {
  chat_id: string;
  every_min: number;
  symbol: string | null;
  last_sent_at: number;
};

export async function saveGroupFeed(
  env: Env,
  chatId: string,
  everyMin: number,
  symbol: string | null,
  nowSec: number,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO group_feeds (chat_id, every_min, symbol, last_sent_at, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(chat_id) DO UPDATE SET
       every_min = excluded.every_min,
       symbol = excluded.symbol,
       last_sent_at = excluded.last_sent_at`,
  )
    .bind(chatId, everyMin, symbol, nowSec, nowSec)
    .run();
}

export async function deleteGroupFeed(env: Env, chatId: string): Promise<void> {
  await env.DB.prepare("DELETE FROM group_feeds WHERE chat_id = ?").bind(chatId).run();
}

export async function isChatAdmin(env: Env, chatId: string | number, userId: number): Promise<boolean> {
  const member = await callTelegram<{ status?: string }>(env, "getChatMember", {
    chat_id: chatId,
    user_id: userId,
  });
  return member.status === "creator" || member.status === "administrator";
}

async function postHtml(env: Env, chatId: string, html: string): Promise<void> {
  const extra = { disable_notification: true };
  try {
    await sendRichMessage(env, chatId, html, extra);
  } catch {
    const plain = html.replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim();
    await sendMessage(env, chatId, plain, extra);
  }
}

export async function buildFeedHtml(env: Env, symbol: string | null, fa: boolean): Promise<string> {
  const unit = fa ? "تومان" : "Toman";
  if (symbol) {
    const row = await getLatest(env.DB, symbol);
    const def = resolveSymbol(symbol);
    const name = fa ? (def?.aliases.find((a) => /[\u0600-\u06FF]/.test(a)) ?? def?.name ?? symbol) : (def?.name ?? symbol);
    const price = row ? formatPrice(row.price) : (fa ? "نیامده" : "waiting");
    return `<h3>${escapeHtml(name)}</h3>\n<p><b>${price}</b> ${unit}</p>\n<p><a href="https://t.me/${escapeHtml(env.BOT_USERNAME)}?start=${escapeHtml(symbol)}">${fa ? "نمودار" : "Chart"}</a></p>`;
  }
  const rows = await getAllLatest(env.DB);
  const byId = new Map(rows.map((row) => [row.symbol, row.price]));
  const lines = BOARD.map((item) => {
    const price = byId.get(item.id);
    const name = fa ? item.fa : item.en;
    return `<p><b>${name}</b> ${price == null ? (fa ? "نیامده" : "waiting") : formatPrice(price)}</p>`;
  }).join("\n");
  const title = fa ? "نرخ بازار آزاد" : "Free-market rates";
  return `<h3>${title}</h3>\n${lines}\n<p>${unit}</p>`;
}

export async function runGroupFeeds(env: Env, nowMs = Date.now()): Promise<number> {
  const nowSec = Math.floor(nowMs / 1000);
  const rows = await env.DB.prepare(
    "SELECT chat_id, every_min, symbol, last_sent_at FROM group_feeds",
  ).all<FeedRow>();
  let sent = 0;
  for (const row of rows.results ?? []) {
    if (nowSec - row.last_sent_at < row.every_min * 60) continue;
    try {
      const html = await buildFeedHtml(env, row.symbol, true);
      await postHtml(env, row.chat_id, html);
      await env.DB.prepare("UPDATE group_feeds SET last_sent_at = ? WHERE chat_id = ?")
        .bind(nowSec, row.chat_id)
        .run();
      sent += 1;
    } catch (e) {
      const msg = e instanceof TelegramError ? `${e.message} ${e.body}` : String(e);
      if (/kicked|not a member|chat not found|have no rights|bot was blocked|PEER_ID_INVALID/i.test(msg)) {
        await deleteGroupFeed(env, row.chat_id);
      } else {
        console.error("group feed", row.chat_id, msg);
      }
    }
  }
  return sent;
}
