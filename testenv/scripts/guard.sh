#!/usr/bin/env bash
# 🛡️ fail-closed guard — refuse the test stack if ANY DB target points at a prod host.
# Layer 3 of the plan (structure, not intent). Run it BEFORE boot AND AFTER copying env over .env
# (บอง's catch: stack.sh overwrites the real .env that currently holds prod cred — verify the RESULT).
#
# Usage:  guard.sh <env-file-or-dir> [...]   — scans given .env files for DB targets
#         guard.sh --check-string "<conn>"   — check a single connection string
set -euo pipefail

PROD_PATTERNS='supabase\.com|supabase\.co|neon\.tech|render\.com|\.rds\.amazonaws\.com|pooler\.supabase'
# Keys that must never point at prod. #177: NEXT_PUBLIC_BACKEND_URL too — the .env.local hole pointed the
# FE at the PROD backend (onrender.com), which reaches the prod DB; scanning only DB_HOST/DATABASE_URL missed it.
DB_KEYS='DATABASE_URL|APP_DATABASE_URL|DB_HOST|PROD_DATABASE_URL|NEXT_PUBLIC_BACKEND_URL'

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
  # For a URL, extract the ACTUAL host (after the LAST @, before port/path) and require it be local.
  # A substring match ("localhost" anywhere) would let a password like `super_secret_localhost:5432`
  # in a remote URL bypass the guard (too's adversarial find). Host-based is not foolable that way.
  if printf '%s' "$k" | grep -qE 'URL$'; then
    host=$(printf '%s' "$v" | sed -E 's#^[a-zA-Z]+://##; s#\?.*$##; s#^.*@##; s#[:/].*$##')
    case "$host" in
      localhost|127.0.0.1|host.docker.internal|postgres) : ;;  # local — ok
      *) echo "🛑 REFUSE: $k host '$host' is not local (fail-closed)"; fail=1 ;;
    esac
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
