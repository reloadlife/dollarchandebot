/**
 * Stateless MCP (Streamable HTTP) at POST /mcp.
 * Same bot key and the same per-key ceiling as /api/v1. No session is stored.
 */

import type { Env } from "../env";
import { findApiKey, readApiKey } from "./keys";
import { getAllLatest, getLatest, getOhlcDays, getTicks24h } from "../db/prices";
import { listExchanges } from "../db/exchanges";
import { SYMBOLS, resolveSymbol, type SymbolDef } from "../symbols";

const PROTOCOL = "2025-03-26";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept, authorization, x-api-key, mcp-protocol-version, mcp-session-id",
  "access-control-expose-headers": "mcp-protocol-version",
  "access-control-max-age": "86400",
};

const INSTRUCTIONS =
  "DollarChande free-market toman rates. Not a bank rate and not financial advice. " +
  "Each quote's source names the board the figure was read from. That board does not run this service. " +
  "Send the bot key (Authorization: Bearer or X-Api-Key) on every request.";

type RpcId = number | string | null;

interface RpcMessage {
  jsonrpc?: string;
  id?: RpcId;
  method?: string;
  params?: unknown;
}

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const symbolSchema = {
  type: "object",
  properties: {
    symbol: { type: "string", description: "Symbol id or alias, such as USD, GOLD18, or nim." },
  },
  required: ["symbol"],
  additionalProperties: false,
} as const;

export const MCP_TOOLS: ToolDef[] = [
  {
    name: "list_symbols",
    description: "List DollarChande symbol ids. No prices. Free-market toman quotes, not a bank rate.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_quote",
    description: "Latest toman quote for one symbol. source names the board. Not financial advice.",
    inputSchema: symbolSchema,
  },
  {
    name: "get_latest",
    description: "Latest toman quote for every symbol.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_ticks",
    description: "24-hour ticks for one symbol. Each tick is { ts, price } in unix seconds and toman.",
    inputSchema: symbolSchema,
  },
  {
    name: "get_ohlc",
    description: "Daily candles for one symbol. days is clamped to 1..90 and defaults to 30.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string" },
        days: { type: "integer", minimum: 1, maximum: 90 },
      },
      required: ["symbol"],
      additionalProperties: false,
    },
  },
  {
    name: "get_exchanges",
    description: "USDT buy and sell at each venue, in toman. buy is the cost of 1 USDT. sell is toman received for 1 USDT.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(body, {
    status,
    headers: { ...CORS, "cache-control": "no-store", "mcp-protocol-version": PROTOCOL, ...extra },
  });
}

function rpcError(id: RpcId, code: number, message: string, status = 200): Response {
  return json({ jsonrpc: "2.0", id, error: { code, message } }, status);
}

function toolResult(payload: unknown, isError = false): { content: { type: "text"; text: string }[]; isError?: boolean } {
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    ...(isError ? { isError: true } : {}),
  };
}

function labelFa(symbol: SymbolDef): string | null {
  return symbol.aliases.find((alias) => /[\u0600-\u06FF]/.test(alias)) ?? null;
}

function meta(symbol: SymbolDef) {
  return {
    id: symbol.id,
    name: symbol.name,
    label_fa: labelFa(symbol),
    kind: symbol.kind,
    emoji: symbol.emoji,
    aliases: symbol.aliases,
  };
}

function argsOf(params: unknown): Record<string, unknown> {
  if (!params || typeof params !== "object") return {};
  const record = params as { arguments?: unknown };
  const args = record.arguments;
  return args && typeof args === "object" ? (args as Record<string, unknown>) : {};
}

function symbolArg(params: unknown): string {
  const raw = argsOf(params).symbol;
  return typeof raw === "string" ? raw : "";
}

function clampDays(raw: unknown): number {
  const n = typeof raw === "number" ? raw : 30;
  if (!Number.isFinite(n)) return 30;
  return Math.max(1, Math.min(90, Math.floor(n)));
}

/** A browser Origin must be the site or a local inspector. Server clients send none. */
export function mcpOriginAllowed(origin: string | null): boolean {
  if (!origin) return true;
  if (origin === "https://dollarchande.live") return true;
  try {
    const url = new URL(origin);
    return (url.protocol === "http:" || url.protocol === "https:") && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

export async function dispatchMcp(message: RpcMessage, env: Env): Promise<Response> {
  const id = message.id ?? null;
  const method = message.method ?? "";

  if (method === "initialize") {
    return json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "dollarchande", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      },
    });
  }

  if (method === "ping") return json({ jsonrpc: "2.0", id, result: {} });

  if (method === "tools/list") {
    return json({ jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } });
  }

  if (method !== "tools/call") return rpcError(id, -32601, "method not found");

  const params = message.params as { name?: unknown } | undefined;
  const name = typeof params?.name === "string" ? params.name : "";
  const tool = MCP_TOOLS.find((item) => item.name === name);
  if (!tool) return json({ jsonrpc: "2.0", id, result: toolResult({ error: "unknown_tool", name }, true) });

  if (name === "list_symbols") {
    return json({
      jsonrpc: "2.0",
      id,
      result: toolResult({ count: SYMBOLS.length, symbols: SYMBOLS.map(meta) }),
    });
  }

  if (name === "get_latest") {
    const rows = await getAllLatest(env.DB);
    const byId = new Map(SYMBOLS.map((symbol) => [symbol.id, symbol]));
    return json({
      jsonrpc: "2.0",
      id,
      result: toolResult({
        unit: "toman",
        count: rows.length,
        quotes: rows.map((row) => ({
          ...(byId.get(row.symbol) ? meta(byId.get(row.symbol)!) : { id: row.symbol }),
          price: row.price,
          prev_price: row.prev_price,
          buy: row.buy,
          sell: row.sell,
          source: row.source,
          updated_at: row.updated_at,
          unit: "toman",
        })),
      }),
    });
  }

  if (name === "get_exchanges") {
    const venues = await listExchanges(env.DB);
    return json({
      jsonrpc: "2.0",
      id,
      result: toolResult({
        unit: "toman",
        note: "buy = toman to buy 1 USDT, sell = toman received for 1 USDT",
        count: venues.length,
        venues,
      }),
    });
  }

  const def = resolveSymbol(symbolArg(message.params));
  if (!def) {
    return json({ jsonrpc: "2.0", id, result: toolResult({ error: "unknown_symbol" }, true) });
  }

  if (name === "get_quote") {
    const row = await getLatest(env.DB, def.id);
    if (!row) return json({ jsonrpc: "2.0", id, result: toolResult({ ...meta(def), price: null, unit: "toman" }) });
    return json({
      jsonrpc: "2.0",
      id,
      result: toolResult({
        ...meta(def),
        price: row.price,
        prev_price: row.prev_price,
        buy: row.buy,
        sell: row.sell,
        source: row.source,
        updated_at: row.updated_at,
        unit: "toman",
      }),
    });
  }

  if (name === "get_ticks") {
    const ticks = await getTicks24h(env.DB, def.id);
    return json({
      jsonrpc: "2.0",
      id,
      result: toolResult({ id: def.id, unit: "toman", range: "24h", count: ticks.length, ticks }),
    });
  }

  const days = clampDays(argsOf(message.params).days);
  const candles = await getOhlcDays(env.DB, def.id, days);
  return json({
    jsonrpc: "2.0",
    id,
    result: toolResult({ id: def.id, unit: "toman", count: candles.length, days: candles }),
  });
}

async function gate(request: Request, env: Env): Promise<Response | null> {
  const raw = readApiKey(request);
  if (!raw) return json({ error: "missing_api_key" }, 401);
  const found = await findApiKey(env, raw);
  if (!found) return json({ error: "invalid_api_key" }, 401);
  if (!env.API_RATE_LIMIT) return null;
  const { success } = await env.API_RATE_LIMIT.limit({ key: `key:${found.id}` });
  if (success) return null;
  return json({ error: "rate_limited" }, 429, { "retry-after": "60" });
}

export async function handleMcp(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/mcp") return null;

  if (!mcpOriginAllowed(request.headers.get("origin"))) {
    return json({ error: "origin_not_allowed" }, 403);
  }

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const accept = request.headers.get("accept");
  if (accept && !accept.includes("application/json") && !accept.includes("text/event-stream") && !accept.includes("*/*")) {
    return json({ error: "not_acceptable" }, 406);
  }

  const denied = await gate(request, env);
  if (denied) return denied;

  let message: RpcMessage;
  try {
    message = (await request.json()) as RpcMessage;
  } catch {
    return rpcError(null, -32700, "parse error", 400);
  }

  if (!message || typeof message !== "object" || Array.isArray(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(message?.id ?? null, -32600, "invalid request", 400);
  }

  if (message.id === undefined) return new Response(null, { status: 202, headers: CORS });
  return dispatchMcp(message, env);
}
