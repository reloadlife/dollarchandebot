import { expect, test } from "bun:test";
import type { Env } from "../env";
import { castPriceList } from "./messages";

function emptyDb(): D1Database {
  const statement = {
    bind() {
      return statement;
    },
    async all() {
      return { results: [] };
    },
    async run() {
      return { success: true, meta: {} };
    },
    async first() {
      return null;
    },
  };
  return { prepare: () => statement } as unknown as D1Database;
}

function memoryKv(): KVNamespace & { dump: Map<string, string> } {
  const dump = new Map<string, string>();
  return {
    dump,
    get: async (key: string) => dump.get(key) ?? null,
    put: async (key: string, value: string) => {
      dump.set(key, value);
    },
  } as unknown as KVNamespace & { dump: Map<string, string> };
}

test("channel cast sends one silent post, pins it silently, then edits that post", async () => {
  const calls: Array<{ method: string; body: Record<string, unknown> }> = [];
  const previous = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = url.slice(url.lastIndexOf("/") + 1);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    calls.push({ method, body });
    const result = method.startsWith("send") ? { message_id: 77 } : true;
    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const cache = memoryKv();
  const env = {
    DB: emptyDb(),
    CACHE: cache,
    TELEGRAM_BOT_TOKEN: "test-token",
    TELEGRAM_CHANNEL_ID: "-1001",
    BOT_USERNAME: "DollarChandeBot",
    CHANNEL_USERNAME: "AlanDollarChande",
    PRICE_UNIT: "Toman",
  } as Env;

  try {
    await castPriceList(env);
    await castPriceList(env);
  } finally {
    globalThis.fetch = previous;
  }

  const sends = calls.filter((call) => call.method === "sendRichMessage");
  const pins = calls.filter((call) => call.method === "pinChatMessage");
  const edits = calls.filter((call) => call.method === "editMessageText");
  expect(sends).toHaveLength(1);
  expect(sends[0]?.body.disable_notification).toBe(true);
  expect(pins).toHaveLength(1);
  expect(pins[0]?.body.disable_notification).toBe(true);
  expect(pins[0]?.body.message_id).toBe(77);
  expect(edits).toHaveLength(1);
  expect(edits[0]?.body.message_id).toBe(77);
  expect(calls.filter((call) => call.method === "sendMessage")).toHaveLength(0);
  expect(cache.dump.get("cast:list_msg_id")).toBe("77");
});
