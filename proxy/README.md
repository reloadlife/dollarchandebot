# Egress proxy

Some venues refuse Cloudflare Worker egress outright — tetherland answers 504,
wallex/exir/arzplus answer 403 — while the same requests succeed from an
ordinary Iranian IP. `edge-proxy.js` is a minimal GET proxy meant to run on a
host whose egress those venues accept.

It is a bare fetch handler with no vendor APIs, so it runs unchanged on
ArvanCloud Edge Computing, a Node/Bun process on any VPS, or a small PaaS app.

## Deploy

1. Put `edge-proxy.js` on the chosen host.
2. Set `PROXY_SECRET` there to a long random string.
3. Point the Worker at it:

```bash
npx wrangler secret put PROXY_URL
npx wrangler secret put PROXY_SECRET
```

Both must be set or the Worker ignores the proxy entirely and fetches directly.
Once set, only the hosts in `NEEDS_PROXY` (src/lib/proxy.ts) route through it;
everything already reachable keeps fetching directly.

## Contract

```
GET https://<proxy-host>/?url=<urlencoded https target>
     x-proxy-secret: <PROXY_SECRET>
```

Upstream status is passed through unchanged, so a 403 from the origin still
reads as a 403 rather than as a proxy success.

## Security

The shared secret and the destination allowlist are load-bearing. An
unauthenticated proxy on a public IP is found and abused within hours, and an
unrestricted one makes whoever runs it the apparent origin of that traffic.
Adding a host to `ALLOWED_HOSTS` should be a deliberate act, and the same host
must also be in `NEEDS_PROXY` on the Worker side for anything to route.

## Unverified

Whether ArvanCloud Edge Computing permits outbound fetch to arbitrary
third-party origins, and whether a function must be attached to a domain on
their CDN, could not be checked from outside Iran — their docs sit behind a JS
challenge. If it does not allow it, any small Iranian VPS runs this file as-is.

Note that tetherland is itself ArvanCloud-fronted, so an ArvanCloud function
calling it may hit same-network loop protection — the same shape as the
Cloudflare→Cloudflare 530s already seen here. Untested.
