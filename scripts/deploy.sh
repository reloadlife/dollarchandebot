#!/usr/bin/env bash
# One-shot deploy. Prefer wrangler; if CF link is too slow for wrangler's
# 10s undici connect timeout, fall back to the long-timeout API upload.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ build"
bunx wrangler deploy --dry-run --outdir=.wrangler/dist-dry

echo "→ upload"
err="$(mktemp)"
if bunx wrangler deploy --keep-vars 2>"$err"; then
  rm -f "$err"
  echo "→ done (wrangler)"
  exit 0
fi

if grep -qiE 'timed out|ConnectionTimeout|network connectivity' "$err"; then
  echo "→ wrangler timed out on slow CF API; using long-timeout upload"
  cat "$err" >&2 || true
  rm -f "$err"
  python3 scripts/cf-deploy.py
  echo "→ done (api)"
  exit 0
fi

echo "→ wrangler deploy failed:" >&2
cat "$err" >&2
rm -f "$err"
exit 1
