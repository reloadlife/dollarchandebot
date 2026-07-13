#!/usr/bin/env python3
"""Deploy dollarchande worker via CF API (bypasses wrangler's 10s undici connect timeout)."""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ACCOUNT = "db10503205acaca78a1df56b6a24516f"
SCRIPT = "dollarchande"
BASE = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}"
ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / ".wrangler" / "dist-dry" / "index.js"
CONFIG = Path.home() / ".wrangler" / "config" / "default.toml"


def load_oauth() -> str:
    text = CONFIG.read_text()
    m = re.search(r'oauth_token\s*=\s*"([^"]+)"', text)
    if not m:
        raise SystemExit(f"no oauth_token in {CONFIG}")
    return m.group(1)


def cf_request(
    method: str,
    url: str,
    token: str,
    *,
    data: bytes | None = None,
    headers: dict[str, str] | None = None,
    timeout: float = 120,
) -> dict:
    h = {"Authorization": f"Bearer {token}", "User-Agent": "dollarchande-deploy/1.0"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read()
    except urllib.error.HTTPError as e:
        body = e.read()
        try:
            parsed = json.loads(body)
        except Exception:
            raise SystemExit(f"HTTP {e.code}: {body[:500]!r}") from e
        if not parsed.get("success"):
            raise SystemExit(
                f"HTTP {e.code} API error: {json.dumps(parsed.get('errors'), indent=2)}"
            )
        return parsed
    return json.loads(body)


def multipart(fields: list[tuple[str, dict]]) -> tuple[bytes, str]:
    """fields: list of (name, {filename?, content_type?, body: bytes|str})"""
    boundary = f"----DollarChande{int(time.time())}"
    parts: list[bytes] = []
    for name, meta in fields:
        body = meta["body"]
        if isinstance(body, str):
            body = body.encode("utf-8")
        disp = f'form-data; name="{name}"'
        if meta.get("filename"):
            disp += f'; filename="{meta["filename"]}"'
        headers = [f"--{boundary}", f"Content-Disposition: {disp}"]
        if meta.get("content_type"):
            headers.append(f"Content-Type: {meta['content_type']}")
        headers.append("")
        parts.append("\r\n".join(headers).encode("utf-8") + b"\r\n" + body + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def main() -> None:
    if not BUNDLE.exists():
        raise SystemExit(f"missing bundle {BUNDLE}; run wrangler deploy --dry-run first")

    token = load_oauth()
    print(f"bundle={BUNDLE} size={BUNDLE.stat().st_size}")

    # 1) current settings (preserve secrets)
    print("fetching current settings...")
    settings = cf_request("GET", f"{BASE}/workers/scripts/{SCRIPT}/settings", token)
    if not settings.get("success"):
        raise SystemExit(settings)
    cur = settings["result"]
    old_bindings = cur.get("bindings") or []
    print(f"existing bindings: {len(old_bindings)}")
    for b in old_bindings:
        t, n = b.get("type"), b.get("name")
        if t in ("secret_text", "secret_key"):
            print(f"  {n}: {t} [kept]")
        else:
            extra = {k: v for k, v in b.items() if k not in ("name", "type", "text")}
            text = b.get("text")
            if t == "plain_text":
                print(f"  {n}: plain_text={text!r}")
            else:
                print(f"  {n}: {t} {extra}")

    # Desired non-secret bindings from wrangler.jsonc
    desired = [
        {
            "type": "d1",
            "name": "DB",
            "id": "2d672ecf-b3ca-48f2-9029-8c8118fd676f",
        },
        {
            "type": "kv_namespace",
            "name": "CACHE",
            "namespace_id": "d165715be09246bc9dfe63db7ae27c01",
        },
        {
            "type": "queue",
            "name": "JOBS",
            "queue_name": "dollarchande-jobs",
        },
        {"type": "plain_text", "name": "CHANNEL_USERNAME", "text": "AlanDollarChande"},
        {"type": "plain_text", "name": "BOT_USERNAME", "text": "DollarChandeBot"},
        {"type": "plain_text", "name": "PRICE_UNIT", "text": "Toman"},
        {
            "type": "plain_text",
            "name": "PUBLIC_BASE_URL",
            "text": "https://dollarchande.mamaddev.workers.dev",
        },
    ]
    # Keep all existing secrets (type secret_text) by name
    secrets = [b for b in old_bindings if b.get("type") in ("secret_text", "secret_key")]
    # secret_text in settings usually omits value — keep by referencing type only?
    # CF API: for PUT script, secrets must include text OR use keep_bindings
    # Prefer keep_bindings for secrets (Workers Versions API) / or inherit

    # Workers script upload supports "keep_bindings": ["secret_text"]
    metadata = {
        "main_module": "index.js",
        "compatibility_date": "2026-06-01",
        "compatibility_flags": ["nodejs_compat"],
        "bindings": desired,
        "keep_bindings": ["secret_text", "secret_key"],
        "observability": {
            "enabled": True,
            "head_sampling_rate": 0.1,
        },
        # tags / usage_model from current if present
    }
    if cur.get("usage_model"):
        metadata["usage_model"] = cur["usage_model"]
    if cur.get("logpush") is not None:
        metadata["logpush"] = cur["logpush"]
    if cur.get("tags"):
        metadata["tags"] = cur["tags"]

    script_bytes = BUNDLE.read_bytes()
    body, ctype = multipart(
        [
            (
                "metadata",
                {
                    "content_type": "application/json",
                    "body": json.dumps(metadata),
                },
            ),
            (
                "index.js",
                {
                    "filename": "index.js",
                    "content_type": "application/javascript+module",
                    "body": script_bytes,
                },
            ),
        ]
    )

    print(f"uploading script ({len(script_bytes)} bytes, multipart {len(body)} bytes)...")
    t0 = time.time()
    result = cf_request(
        "PUT",
        f"{BASE}/workers/scripts/{SCRIPT}?include_subdomain_availability=true&excludeScript=true",
        token,
        data=body,
        headers={"Content-Type": ctype},
        timeout=180,
    )
    print(f"upload took {time.time() - t0:.1f}s")
    if not result.get("success"):
        raise SystemExit(json.dumps(result, indent=2))
    r = result.get("result") or {}
    print(f"id={r.get('id')} etag={r.get('etag')} created={r.get('created_on')} modified={r.get('modified_on')}")
    print(f"startup_time_ms={ (r.get('startup_time_ms') or r.get('pipeline_hash') ) }")

    # 2) ensure cron schedule */5
    print("setting schedules...")
    sched = cf_request(
        "PUT",
        f"{BASE}/workers/scripts/{SCRIPT}/schedules",
        token,
        data=json.dumps([{"cron": "*/5 * * * *"}]).encode(),
        headers={"Content-Type": "application/json"},
    )
    if not sched.get("success"):
        print("schedule warning:", json.dumps(sched.get("errors"), indent=2), file=sys.stderr)
    else:
        print("schedules:", json.dumps(sched.get("result"), indent=2))

    # 3) confirm settings after deploy
    print("verifying settings...")
    after = cf_request("GET", f"{BASE}/workers/scripts/{SCRIPT}/settings", token)
    ar = after["result"]
    names = [(b.get("name"), b.get("type")) for b in (ar.get("bindings") or [])]
    print("bindings after:", names)
    secret_names = [n for n, t in names if t == "secret_text"]
    if not secret_names:
        print("WARNING: no secret_text bindings after deploy — secrets may need re-put", file=sys.stderr)
    else:
        print("secrets preserved:", secret_names)

    print("DEPLOY OK")


if __name__ == "__main__":
    main()
