#!/usr/bin/env bash
# 🛡️ fail-closed guard — refuse the test stack if ANY DB target points at a prod host.
# Layer 3 of the plan (structure, not intent). Run it BEFORE boot AND AFTER copying env over .env
# (บอง's catch: stack.sh overwrites the real .env that currently holds prod cred — verify the RESULT).
#
# Usage:  guard.sh <env-file-or-dir> [...]   — scans given .env files for DB targets
#         guard.sh --check-string "<conn>"   — check a single connection string
set -euo pipefail

PROD_PATTERNS='supabase\.com|supabase\.co|neon\.tech|render\.com|\.rds\.amazonaws\.com|pooler\.supabase'
LOCAL_PATTERNS='@?(localhost|127\.0\.0\.1|host\.docker\.internal)(:|/)|@postgres:'
DB_KEYS='DATABASE_URL|APP_DATABASE_URL|DB_HOST|PROD_DATABASE_URL'

fail=0
check_value() {  # $1 = key, $2 = value
  local k="$1" v="$2" host
  # strip an inline "# comment" (a trailing comment on a .env value would otherwise make a local host
  # look non-local → false refuse; dotenv parsers strip it, bash greps don't). Only " #..." (space+#).
  v=$(printf '%s' "$v" | sed -E 's/[[:space:]]+#.*$//')
  [ -z "$v" ] && return 0
  if printf '%s' "$v" | grep -qiE "$PROD_PATTERNS"; then
    # show the real host: drop everything up to '@' (creds), then everything from the next ':' or '/'
    host=$(printf '%s' "$v" | sed -E 's#^.*@##; s#[:/].*$##')
    echo "🛑 REFUSE: $k → PROD host ($host)"; fail=1; return 0
  fi
  # DB_HOST or a URL must resolve to a local host — fail-closed on anything else
  if printf '%s' "$k" | grep -qE 'URL$' && ! printf '%s' "$v" | grep -qiE "$LOCAL_PATTERNS"; then
    echo "🛑 REFUSE: $k is not a local host (expected localhost:5433) — fail-closed"; fail=1
  fi
  if [ "$k" = "DB_HOST" ] && ! printf '%s' "$v" | grep -qiE '^(localhost|127\.0\.0\.1|postgres)$'; then
    echo "🛑 REFUSE: DB_HOST=$v is not local"; fail=1
  fi
}

if [ "${1:-}" = "--check-string" ]; then
  check_value "DATABASE_URL" "${2:-}"
else
  for target in "$@"; do
    [ -f "$target" ] || { echo "  (skip missing $target)"; continue; }
    while IFS='=' read -r k v; do
      printf '%s' "$k" | grep -qE "^($DB_KEYS)$" || continue
      check_value "$k" "$(printf '%s' "$v" | tr -d '"'"'"' ')"
    done < <(grep -E "^($DB_KEYS)=" "$target" || true)
  done
fi

if [ "$fail" -ne 0 ]; then
  echo "   ↳ the test stack only talks to localhost:5433. Never point it at prod. Aborting."
  exit 1
fi
echo "✅ guard: all DB targets local — safe"
