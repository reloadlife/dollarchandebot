/**
 * Minimal GET proxy for endpoints that refuse Cloudflare egress.
 *
 * Deliberately platform-neutral: a bare fetch handler with no vendor APIs, so
 * the same file runs on ArvanCloud Edge Computing, a Node/Bun process on any
 * VPS, or a small PaaS app. Both module and service-worker entry styles are
 * registered at the bottom because platforms differ on which they expect.
 *
 * Usage:  GET https://<proxy-host>/?url=<urlencoded target>
 *         header  x-proxy-secret: <PROXY_SECRET>
 *
 * The secret and the allowlist are load-bearing, not decoration: an
 * unauthenticated proxy on a public IP is found and abused within hours, and
 * an unrestricted one makes whoever runs it the origin of that traffic.
 */

/** Only these hosts may be fetched. Additions are a deliberate act. */
const ALLOWED_HOSTS = new Set([
  "service.tetherland.com",
  "api.tetherland.com",
  "api.wallex.ir",
  "api.exir.io",
  "arzplus.net",
  "api.arzplus.net",
  "api.nobitex.ir",
  "api.okex.ir",
  "api.mykifpool.ir",
]);

const TIMEOUT_MS = 10_000;
/** Cap the response so a huge upstream body cannot be used to burn quota. */
const MAX_BYTES = 4 * 1024 * 1024;

const BROWSER_HEADERS = {
  accept: "application/json, text/html, text/plain, */*",
  "accept-language": "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

function deny(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function handleRequest(request, secret) {
  if (request.method !== "GET") return deny(405, "GET only");

  const expected = secret ?? globalThis.PROXY_SECRET ?? globalThis.process?.env?.PROXY_SECRET;
  if (!expected) return deny(500, "proxy secret not configured");
  if (request.headers.get("x-proxy-secret") !== expected) return deny(403, "bad secret");

  const target = new URL(request.url).searchParams.get("url");
  if (!target) return deny(400, "missing url param");

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return deny(400, "malformed url");
  }
  if (parsed.protocol !== "https:") return deny(400, "https only");
  if (!ALLOWED_HOSTS.has(parsed.hostname)) return deny(403, `host not allowed: ${parsed.hostname}`);

  let upstream;
  try {
    upstream = await fetch(parsed.toString(), {
      headers: { ...BROWSER_HEADERS, referer: parsed.origin + "/" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    return deny(502, `upstream fetch failed: ${e.message}`);
  }

  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return deny(502, "upstream body too large");

  // Pass the upstream status through untouched — the caller needs to see a 403
  // from the origin as a 403, not as a proxy success.
  return new Response(body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "x-proxy-upstream-status": String(upstream.status),
    },
  });
}

export default {
  fetch: (request, env) => handleRequest(request, env?.PROXY_SECRET),
};

// Older service-worker style platforms.
if (typeof addEventListener === "function") {
  addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event.request));
  });
}
