/**
 * Cheap fixed-window rate limit in KV.
 * key → count, TTL = window.
 */

export async function rateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSec: number,
): Promise<{ ok: boolean; remaining: number; retryAfter: number }> {
  const k = `rl:${key}`;
  const raw = await kv.get(k);
  const n = raw ? Number(raw) : 0;
  if (n >= limit) {
    return { ok: false, remaining: 0, retryAfter: windowSec };
  }
  // first hit sets TTL
  if (!raw) {
    await kv.put(k, "1", { expirationTtl: Math.max(60, windowSec) });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  await kv.put(k, String(n + 1), { expirationTtl: Math.max(60, windowSec) });
  return { ok: true, remaining: Math.max(0, limit - n - 1), retryAfter: 0 };
}
