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
  for (const [k, v] of Object.entries(extra)) form.set(k, String(v));
  form.set("photo", new Blob([photo], { type: "image/png" }), "chart.png");
  return call(env, "sendPhoto", undefined, form);
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

export async function setWebhook(
  env: Env,
  url: string,
  secret?: string,
): Promise<true> {
  return call(env, "setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "inline_query"],
    drop_pending_updates: false,
  });
}

export type TgUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    text?: string;
    from?: { id: number; username?: string };
  };
  inline_query?: {
    id: string;
    query: string;
    from: { id: number; username?: string };
  };
};
