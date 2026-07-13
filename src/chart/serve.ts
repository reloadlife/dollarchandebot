/**
 * Generate / cache chart PNGs and serve them over HTTPS so Telegram
 * rich messages can embed: <img src="https://…/chart/USD.png" />
 */

import type { Env } from "../env";
import { resolveSymbol } from "../symbols";
import { chartPngForSymbol } from "../cast/messages";
import { align5m, next5mExpiration } from "../db/prices";

export type ChartRange = "24h" | "7d";

export function pngCacheKey(
  symbolId: string,
  range: ChartRange = "24h",
  nowSec = Math.floor(Date.now() / 1000),
): string {
  return `png:v2:${range}:${symbolId}:${align5m(nowSec)}`;
}

export function chartPublicUrl(
  env: Env,
  symbolId: string,
  range: ChartRange = "24h",
  nowSec = Math.floor(Date.now() / 1000),
): string {
  const base = (env.PUBLIC_BASE_URL || "https://dollarchande.mamaddev.workers.dev").replace(/\/$/, "");
  const bucket = align5m(nowSec);
  const q = range === "7d" ? `?r=7d&b=${bucket}` : `?b=${bucket}`;
  return `${base}/chart/${encodeURIComponent(symbolId)}.png${q}`;
}

/** Ensure PNG bytes are in KV for the current 5m window; return them. */
export async function ensureChartPng(
  env: Env,
  symbolId: string,
  range: ChartRange = "24h",
): Promise<Uint8Array> {
  const nowSec = Math.floor(Date.now() / 1000);
  const key = pngCacheKey(symbolId, range, nowSec);
  const hit = await env.CACHE.get(key, "arrayBuffer");
  if (hit && hit.byteLength > 100) {
    return new Uint8Array(hit);
  }

  const def = resolveSymbol(symbolId);
  if (!def) throw new Error(`unknown symbol ${symbolId}`);
  const { png } = await chartPngForSymbol(env, def, range);

  const copy = new Uint8Array(png.byteLength);
  copy.set(png);
  await env.CACHE.put(key, copy.buffer, {
    expiration: next5mExpiration(nowSec),
  });
  return png;
}

/** HTTP handler: GET /chart/USD.png?r=7d */
export async function handleChartRequest(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/chart\/([A-Za-z0-9_]+)\.png$/i);
  if (!m) return null;

  const raw = m[1] ?? "";
  const def = resolveSymbol(raw);
  if (!def) {
    return new Response("unknown symbol", { status: 404 });
  }
  const range: ChartRange = url.searchParams.get("r") === "7d" ? "7d" : "24h";

  try {
    const png = await ensureChartPng(env, def.id, range);
    const ttl = Math.max(30, next5mExpiration() - Math.floor(Date.now() / 1000));
    return new Response(png, {
      headers: {
        "content-type": "image/png",
        "cache-control": `public, max-age=${ttl}`,
        "access-control-allow-origin": "*",
      },
    });
  } catch (e) {
    console.error("chart serve error", e);
    return new Response("chart error", { status: 500 });
  }
}
