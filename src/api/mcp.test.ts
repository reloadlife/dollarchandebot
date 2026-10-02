import { expect, test } from "bun:test";
import { MCP_TOOLS, dispatchMcp, handleMcp, mcpOriginAllowed } from "./mcp";
import type { Env } from "../env";

const env = { API_RATE_LIMIT: { limit: async () => ({ success: true }) } } as unknown as Env;

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://api.dollarchande.live/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("mcp origin allows the site and local inspectors only", () => {
  expect(mcpOriginAllowed(null)).toBe(true);
  expect(mcpOriginAllowed("https://dollarchande.live")).toBe(true);
  expect(mcpOriginAllowed("http://localhost:6274")).toBe(true);
  expect(mcpOriginAllowed("http://127.0.0.1:8787")).toBe(true);
  expect(mcpOriginAllowed("https://evil.example")).toBe(false);
  expect(mcpOriginAllowed("https://dollarchande-web.pages.dev")).toBe(false);
});

test("mcp rejects a browser origin that is not the site", async () => {
  const res = await handleMcp(post({ jsonrpc: "2.0", id: 1, method: "initialize" }, { origin: "https://evil.example" }), env);
  expect(res?.status).toBe(403);
});

test("mcp requires a key and does not treat the site origin as a key", async () => {
  const res = await handleMcp(post({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { origin: "https://dollarchande.live" }), env);
  expect(res?.status).toBe(401);
  expect(await res?.json()).toEqual({ error: "missing_api_key" });
});

test("mcp get is not a session stream", async () => {
  const res = await handleMcp(new Request("https://api.dollarchande.live/mcp"), env);
  expect(res?.status).toBe(405);
});

test("mcp tools and initialize", async () => {
  const listed = await dispatchMcp({ jsonrpc: "2.0", id: 2, method: "tools/list" }, env);
  const list = await listed.json() as { result: { tools: { name: string }[] } };
  expect(list.result.tools.map((tool) => tool.name)).toEqual(MCP_TOOLS.map((tool) => tool.name));

  const init = await dispatchMcp({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, env);
  const body = await init.json() as { result: { protocolVersion: string; instructions: string } };
  expect(body.result.protocolVersion).toBe("2025-03-26");
  expect(body.result.instructions).toContain("not financial advice");

  const symbols = await dispatchMcp({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "list_symbols", arguments: {} } }, env);
  const catalog = JSON.parse(((await symbols.json()) as { result: { content: { text: string }[] } }).result.content[0].text) as { count: number };
  expect(catalog.count).toBeGreaterThan(10);

  const missing = await dispatchMcp({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "get_quote", arguments: { symbol: "NOPE" } } }, env);
  const err = await missing.json() as { result: { isError: boolean } };
  expect(err.result.isError).toBe(true);
});

test("mcp notification still requires a key", async () => {
  const res = await handleMcp(post({ jsonrpc: "2.0", method: "notifications/initialized" }), env);
  expect(res?.status).toBe(401);
});
