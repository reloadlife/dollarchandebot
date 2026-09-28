/**
 * Read API. The public site may call it without a key. Plugins and other
 * clients send a key issued by the Telegram bot. Responses are edge-cached
 * for a minute after the key and rate limit checks.
 */

import type { Env } from "../env";
import { listExchanges } from "../db/exchanges";
import { getAllLatest, getLatest, getOhlcDays, getTicks24h, type LatestRow } from "../db/prices";
import { findApiKey, isSiteOrigin, readApiKey } from "./keys";
import { SYMBOLS, resolveSymbol, type SymbolDef } from "../symbols";

const CACHE_SEC = 60;

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type, accept, authorization, x-api-key",
  "access-control-max-age": "86400",
};

export type ApiRoute =
  | { kind: "index" }
  | { kind: "latest" }
  | { kind: "symbols" }
  | { kind: "symbol"; id: string }
  | { kind: "ohlc"; id: string }
  | { kind: "ticks"; id: string }
  | { kind: "exchanges" }
  | { kind: "unknown" };

export function matchApiPath(pathname: string): ApiRoute | null {
  if (pathname !== "/api/v1" && !pathname.startsWith("/api/v1/")) return null;
  const rest = pathname.slice("/api/v1".length).replace(/\/+$/, "");
  if (rest === "") return { kind: "index" };
  if (rest === "/latest") return { kind: "latest" };
  if (rest === "/symbols") return { kind: "symbols" };
  if (rest === "/exchanges") return { kind: "exchanges" };
  const sym = rest.match(/^\/symbols\/([A-Za-z0-9]+)(\/ohlc|\/ticks)?$/);
  if (!sym) return { kind: "unknown" };
  const id = (sym[1] ?? "").toUpperCase();
  if (sym[2] === "/ohlc") return { kind: "ohlc", id };
  if (sym[2] === "/ticks") return { kind: "ticks", id };
  return { kind: "symbol", id };
}

function faLabel(s: SymbolDef): string | null {
  return s.aliases.find((a) => /[\u0600-\u06FF]/.test(a)) ?? null;
}

function meta(s: SymbolDef) {
  return {
    id: s.id,
    name: s.name,
    label_fa: faLabel(s),
    kind: s.kind,
    emoji: s.emoji,
    aliases: s.aliases,
  };
}

function quote(row: LatestRow, s: SymbolDef | undefined) {
  return {
    ...(s ? meta(s) : { id: row.symbol, name: row.symbol, label_fa: null, kind: null, emoji: null, aliases: [] }),
    price: row.price,
    prev_price: row.prev_price,
    buy: row.buy,
    sell: row.sell,
    source: row.source,
    updated_at: row.updated_at,
    unit: "toman",
  };
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(body, {
    status,
    headers: {
      ...CORS,
      "cache-control": status === 200 ? `private, max-age=${CACHE_SEC}` : "no-store",
      // The zone must not store this. A shared hit would skip the key check.
      "cdn-cache-control": "no-store",
      ...extra,
    },
  });
}

function clampDays(raw: string | null): number {
  const n = Number(raw ?? "30");
  if (!Number.isFinite(n)) return 30;
  return Math.max(1, Math.min(90, Math.floor(n)));
}

async function route(url: URL, env: Env): Promise<Response> {
  const matched = matchApiPath(url.pathname);
  if (!matched || matched.kind === "unknown") {
    return json({ error: "not_found" }, 404);
  }

  if (matched.kind === "index") {
    const origin = url.origin;
    return json({
      name: "DollarChande",
      unit: "toman",
      docs: `${origin}/api/v1`,
      endpoints: [
        "GET /api/v1/latest",
        "GET /api/v1/symbols",
        "GET /api/v1/symbols/:id",
        "GET /api/v1/symbols/:id/ticks",
        "GET /api/v1/symbols/:id/ohlc?days=30",
        "GET /api/v1/exchanges",
      ],
    });
  }

  if (matched.kind === "symbols") {
    return json({
      count: SYMBOLS.length,
      symbols: SYMBOLS.map(meta),
    });
  }

  if (matched.kind === "latest") {
    const rows = await getAllLatest(env.DB);
    const byId = new Map(SYMBOLS.map((s) => [s.id, s]));
    return json({
      unit: "toman",
      count: rows.length,
      quotes: rows.map((row) => quote(row, byId.get(row.symbol))),
    });
  }

  if (matched.kind === "exchanges") {
    const rows = await listExchanges(env.DB);
    return json({
      unit: "toman",
      note: "buy = toman to buy 1 USDT, sell = toman received for 1 USDT",
      count: rows.length,
      venues: rows,
    });
  }

  const def = resolveSymbol(matched.id);
  if (!def) return json({ error: "unknown_symbol", id: matched.id }, 404);

  if (matched.kind === "symbol") {
    const row = await getLatest(env.DB, def.id);
    if (!row) return json({ ...meta(def), price: null, unit: "toman" });
    return json(quote(row, def));
  }

  if (matched.kind === "ticks") {
    const ticks = await getTicks24h(env.DB, def.id);
    return json({ id: def.id, unit: "toman", range: "24h", count: ticks.length, ticks });
  }

  const days = await getOhlcDays(env.DB, def.id, clampDays(url.searchParams.get("days")));
  return json({ id: def.id, unit: "toman", count: days.length, days });
}

export async function handlePublicApi(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (matchApiPath(url.pathname) == null && url.pathname !== "/api/v1") return null;
  if (!url.pathname.startsWith("/api/v1")) return null;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const gate = await authorize(request, env);
  if (gate) return gate;

  const cacheKey = new Request(url.toString(), { method: "GET" });
  const hit = await caches.default.match(cacheKey);
  if (hit) return hit;

  const res = await route(url, env);
  if (res.ok) {
    ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
  }
  return res;
}

/** Site visitors are limited by IP. Everyone else must present a bot-issued key. */
async function authorize(request: Request, env: Env): Promise<Response | null> {
  const site = isSiteOrigin(request.headers.get("origin"));
  let limitKey: string;
  if (site) {
    limitKey = `ip:${request.headers.get("cf-connecting-ip") || "unknown"}`;
  } else {
    const raw = readApiKey(request);
    if (!raw) return json({ error: "missing_api_key" }, 401);
    const found = await findApiKey(env, raw);
    if (!found) return json({ error: "invalid_api_key" }, 401);
    limitKey = `key:${found.id}`;
  }
  if (!env.API_RATE_LIMIT) return null;
  const { success } = await env.API_RATE_LIMIT.limit({ key: limitKey });
  if (success) return null;
  return json({ error: "rate_limited" }, 429, { "retry-after": "60" });
}
