import type { Env } from "../env";

/**
 * Optional egress proxy for the venues that refuse Cloudflare IPs.
 *
 * Inert unless PROXY_URL and PROXY_SECRET are both set, so this ships safely
 * before any proxy exists. See proxy/edge-proxy.js for the other half.
 */

export interface ProxyConfig {
  url: string;
  secret: string;
}

/**
 * Hosts that reject CF egress outright (504/403). For these the direct fetch
 * is a guaranteed wasted subrequest, so the proxy goes first when configured.
 * Everything else fetches directly — proxying working hosts would only add a
 * hop and a single point of failure.
 */
const NEEDS_PROXY = new Set([
  "service.tetherland.com",
  "api.tetherland.com",
  "api.wallex.ir",
  "api.exir.io",
  "arzplus.net",
  "api.arzplus.net",
]);

/**
 * Module-scoped rather than threaded through all nineteen scrapers. The value
 * is derived from env and therefore identical on every invocation, so a shared
 * isolate re-setting it is a no-op rather than a race.
 */
let current: ProxyConfig | null = null;

export function configureProxy(env: Env): void {
  current = env.PROXY_URL && env.PROXY_SECRET
    ? { url: env.PROXY_URL, secret: env.PROXY_SECRET }
    : null;
}

export function proxyConfigured(): boolean {
  return current != null;
}

/** Fetch through the proxy when one is configured and the host needs it. */
export async function fetchMaybeProxied(url: string, init: RequestInit = {}): Promise<Response> {
  const cfg = current;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return fetch(url, init);
  }
  if (!cfg || !NEEDS_PROXY.has(host)) return fetch(url, init);

  const proxied = `${cfg.url}${cfg.url.includes("?") ? "&" : "?"}url=${encodeURIComponent(url)}`;
  const headers = new Headers(init.headers);
  headers.set("x-proxy-secret", cfg.secret);
  const res = await fetch(proxied, { ...init, headers });

  // A proxy that is down must not silently mask the venue as merely failing.
  if (res.status === 502 || res.status === 403) {
    const detail = await res.text().catch(() => "");
    if (detail.includes("proxy") || detail.includes("secret") || detail.includes("not allowed")) {
      throw new Error(`proxy refused ${host}: ${res.status} ${detail.slice(0, 120)}`);
    }
    return new Response(detail, { status: res.status });
  }
  return res;
}
