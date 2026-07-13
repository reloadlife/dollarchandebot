import type { Env } from "../env";

const API = "https://api.telegram.org";

export class TelegramError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string,
  ) {
    super(message);
  }
}

async function call<T>(
  env: Env,
  method: string,
  body?: unknown,
  form?: FormData,
): Promise<T> {
  const url = `${API}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  const res = form
    ? await fetch(url, { method: "POST", body: form })
    : await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body != null ? JSON.stringify(body) : undefined,
      });
  const text = await res.text();
  let json: { ok: boolean; result?: T; description?: string };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new TelegramError(`telegram ${method} non-json`, res.status, text);
  }
  if (!json.ok) {
    throw new TelegramError(json.description ?? `telegram ${method} failed`, res.status, text);
  }
  return json.result as T;
}

export async function sendMessage(
  env: Env,
  chatId: string | number,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<{ message_id: number }> {
  return call(env, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}

export async function sendPhoto(
  env: Env,
  chatId: string | number,
  photo: Uint8Array | string,
  caption: string,
  extra: Record<string, unknown> = {},
): Promise<{ message_id: number; photo?: Array<{ file_id: string }> }> {
  if (typeof photo === "string") {
    return call(env, "sendPhoto", {
      chat_id: chatId,
      photo,
      caption,
      parse_mode: "HTML",
      ...extra,
    });
  }
  const form = new FormData();
  form.set("chat_id", String(chatId));
  form.set("caption", caption);
  form.set("parse_mode", "HTML");
  for (const [k, v] of Object.entries(extra)) {
    form.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  form.set("photo", new Blob([photo], { type: "image/png" }), "chart.png");
  return call(env, "sendPhoto", undefined, form);
}

/**
 * Telegram Bot API 10+ rich messages (headings, lists, tables, …).
 * https://core.telegram.org/bots/api#sendrichmessage
 *
 * Keep skip_entity_detection false so $USD cashtags & @mentions light up natively.
 */
export async function sendRichMessage(
  env: Env,
  chatId: string | number,
  html: string,
  extra: Record<string, unknown> = {},
  richOpts: { skipEntityDetection?: boolean } = {},
): Promise<{ message_id: number }> {
  return call(env, "sendRichMessage", {
    chat_id: chatId,
    rich_message: {
      html,
      skip_entity_detection: richOpts.skipEntityDetection ?? false,
    },
    ...extra,
  });
}

export async function answerInlineQuery(
  env: Env,
  inlineQueryId: string,
  results: unknown[],
  cacheTime = 600,
): Promise<true> {
  return call(env, "answerInlineQuery", {
    inline_query_id: inlineQueryId,
    results,
    cache_time: cacheTime,
    is_personal: false,
  });
}

/**
 * Guest Mode reply — bot posts into a chat it is not a member of.
 * Result uses the same InlineQueryResult shapes as answerInlineQuery.
 * https://core.telegram.org/bots/api#answerguestquery
 */
export async function answerGuestQuery(
  env: Env,
  guestQueryId: string,
  result: unknown,
): Promise<{ inline_message_id?: string }> {
  return call(env, "answerGuestQuery", {
    guest_query_id: guestQueryId,
    result,
  });
}

export async function setWebhook(
  env: Env,
  url: string,
  secret?: string,
  dropPending = true,
): Promise<true> {
  return call(env, "setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "inline_query", "guest_message"],
    // drop backlog on (re)register so we don't replay dead updates
    drop_pending_updates: dropPending,
  });
}

/** Max age for handling an update (seconds). Older = dead, ignore. */
export const MAX_UPDATE_AGE_SEC = 3600;

export type TgMessage = {
  message_id: number;
  chat: { id: number; type: string; title?: string; username?: string };
  text?: string;
  caption?: string;
  /** Unix seconds when the message was sent */
  date?: number;
  from?: { id: number; username?: string; first_name?: string };
  /** Guest Mode: answer with answerGuestQuery */
  guest_query_id?: string;
  entities?: Array<{ type: string; offset: number; length: number }>;
  caption_entities?: Array<{ type: string; offset: number; length: number }>;
};

export type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  /** Guest Mode mention in a chat the bot is not a member of */
  guest_message?: TgMessage;
  inline_query?: {
    id: string;
    query: string;
    from: { id: number; username?: string };
  };
};

/** True if message.date is missing or older than maxAgeSec. */
export function isDeadUpdate(
  dateSec: number | undefined,
  maxAgeSec = MAX_UPDATE_AGE_SEC,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  if (dateSec == null || !Number.isFinite(dateSec)) return true;
  return nowSec - dateSec > maxAgeSec;
}
