import type { Env } from "../env";

const SITE_ORIGINS = new Set([
  "https://dollarchande.live",
  "https://dollarchande-web.pages.dev",
]);

export function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const body = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `dc_${body}`;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Bearer token or X-Api-Key. Empty string is treated as missing. */
export function readApiKey(request: Request): string | null {
  const header = request.headers.get("x-api-key")?.trim();
  if (header) return header;
  const auth = request.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(auth);
  return match?.[1] || null;
}

/** The public site may read rates without a key. Other clients may not. */
export function isSiteOrigin(origin: string | null): boolean {
  return origin != null && SITE_ORIGINS.has(origin);
}

export async function rotateApiKey(env: Env, chatId: string): Promise<string> {
  const key = generateApiKey();
  const keyHash = await sha256Hex(key);
  const id = keyHash.slice(0, 12);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM api_keys WHERE chat_id = ?").bind(chatId),
    env.DB.prepare(
      "INSERT INTO api_keys (id, key_hash, chat_id, created_at) VALUES (?, ?, ?, ?)",
    ).bind(id, keyHash, chatId, now),
  ]);
  return key;
}

export async function findApiKey(env: Env, raw: string): Promise<{ id: string } | null> {
  const keyHash = await sha256Hex(raw);
  const row = await env.DB.prepare("SELECT id FROM api_keys WHERE key_hash = ?")
    .bind(keyHash)
    .first<{ id: string }>();
  return row ?? null;
}

export async function apiKeyIdForChat(env: Env, chatId: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT id FROM api_keys WHERE chat_id = ?")
    .bind(chatId)
    .first<{ id: string }>();
  return row?.id ?? null;
}
