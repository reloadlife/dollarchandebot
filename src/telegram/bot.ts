import type { Env } from "../env";
import { resolveSymbol, SYMBOLS } from "../symbols";
import { chartPngForSymbol } from "../cast/messages";
import { answerInlineQuery, sendMessage, sendPhoto, type TgUpdate } from "./api";
import { escapeHtml, formatDelta, formatPrice, formatTimeTehran } from "../lib/format";
import { getLatest } from "../db/prices";

const CACHE_TTL = 600; // 10 minutes

interface CachedChart {
  fileId?: string;
  caption: string;
  /** base64 png fallback when no file_id yet */
  pngB64?: string;
  at: number;
}

async function getCached(env: Env, key: string): Promise<CachedChart | null> {
  const raw = await env.CACHE.get(key, "json");
  return (raw as CachedChart | null) ?? null;
}

async function setCached(env: Env, key: string, value: CachedChart): Promise<void> {
  await env.CACHE.put(key, JSON.stringify(value), { expirationTtl: CACHE_TTL });
}

async function ensureChart(
  env: Env,
  symbolId: string,
): Promise<{ fileId?: string; png?: Uint8Array; caption: string }> {
  const key = `chart:v1:${symbolId}`;
  const hit = await getCached(env, key);
  if (hit?.fileId) return { fileId: hit.fileId, caption: hit.caption };
  if (hit?.pngB64) {
    const bin = Uint8Array.from(atob(hit.pngB64), (c) => c.charCodeAt(0));
    return { png: bin, caption: hit.caption };
  }

  const def = resolveSymbol(symbolId);
  if (!def) throw new Error("unknown symbol");
  const { png, caption } = await chartPngForSymbol(env, def);

  // store raw png briefly (KV 25MB value limit; our charts are small)
  let b64 = "";
  // chunk-safe base64
  const CHUNK = 0x8000;
  for (let i = 0; i < png.length; i += CHUNK) {
    b64 += String.fromCharCode(...png.subarray(i, i + CHUNK));
  }
  await setCached(env, key, { caption, pngB64: btoa(b64), at: Date.now() });
  return { png, caption };
}

function helpText(env: Env): string {
  const samples = SYMBOLS.filter((s) => s.channelList)
    .slice(0, 12)
    .map((s) => `<code>${s.id}</code>`)
    .join(" · ");
  return [
    `👋 <b>DollarChande</b>`,
    ``,
    `Send a symbol to get the latest price + a 24h chart.`,
    `Inline: type <code>@${escapeHtml(env.BOT_USERNAME)} USD</code> in any chat.`,
    ``,
    `Examples: ${samples}`,
    ``,
    `Channel: @${escapeHtml(env.CHANNEL_USERNAME)}`,
    `Cache: 10 minutes · free-market rates`,
  ].join("\n");
}

export async function handleUpdate(env: Env, update: TgUpdate): Promise<void> {
  if (update.inline_query) {
    await handleInline(env, update.inline_query.id, update.inline_query.query);
    return;
  }

  const msg = update.message;
  if (!msg?.text || !msg.chat) return;
  const text = msg.text.trim();

  if (text.startsWith("/start") || text.startsWith("/help")) {
    await sendMessage(env, msg.chat.id, helpText(env));
    return;
  }

  // /usd or plain USD
  const token = text.replace(/^\//, "").split(/\s+/)[0] ?? "";
  const def = resolveSymbol(token);
  if (!def) {
    await sendMessage(
      env,
      msg.chat.id,
      `❓ Unknown symbol <code>${escapeHtml(token)}</code>.\nTry <code>USD</code>, <code>USDT</code>, <code>EUR</code>, <code>GOLD18</code>…\n/help for more.`,
    );
    return;
  }

  const chart = await ensureChart(env, def.id);
  const sent = await sendPhoto(
    env,
    msg.chat.id,
    chart.fileId ?? chart.png!,
    chart.caption,
  );

  // promote to file_id cache (re-sends free + tiny)
  const fileId = sent.photo?.[sent.photo.length - 1]?.file_id;
  if (fileId) {
    await setCached(env, `chart:v1:${def.id}`, {
      fileId,
      caption: chart.caption,
      at: Date.now(),
    });
  }
}

async function handleInline(env: Env, inlineQueryId: string, query: string): Promise<void> {
  const q = query.trim();
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

  // Inline photo requires a public HTTPS URL — we don't host images.
  // Use article result with deep text; user can open bot for chart image.
  // If we have a file_id cache, Telegram allows photo via file_id in some contexts —
  // InlineQueryResultCachedPhoto needs file_id.
  const cache = await getCached(env, `chart:v1:${def.id}`);

  if (cache?.fileId) {
    await answerInlineQuery(
      env,
      inlineQueryId,
      [
        {
          type: "photo",
          id: def.id,
          photo_file_id: cache.fileId,
          title: `${def.id} · ${price} ${unit}`,
          description: `${def.name} · ${delta}`,
          caption: cache.caption,
          parse_mode: "HTML",
        },
      ],
      CACHE_TTL,
    );
    return;
  }

  // Warm cache asynchronously? We can't background easily; generate now if cheap.
  // Generating PNG for inline is ok occasionally; store file_id only after a chat send.
  // Serve article for first hits.
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
          message_text: [
            `${def.emoji} <b>${escapeHtml(def.name)}</b> · <code>${def.id}</code>`,
            `💵 <b>${price}</b> ${escapeHtml(unit)}`,
            `Δ ${escapeHtml(delta)}`,
            `⏱ ${escapeHtml(when)} (Tehran)`,
            ``,
            `📈 Open @${escapeHtml(env.BOT_USERNAME)} and send <code>${def.id}</code> for the 24h chart image.`,
            `📣 @${escapeHtml(env.CHANNEL_USERNAME)}`,
          ].join("\n"),
          parse_mode: "HTML",
          disable_web_page_preview: true,
        },
      },
    ],
    60,
  );
}
