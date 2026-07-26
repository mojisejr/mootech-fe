#!/usr/bin/env bash
# Restore a FULL dump into the LOCAL test postgres (localhost:5433). Local cred only (postgres/postgres).
# Full dump (not --schema=public): 35 public tables FK to auth.users, so the auth schema must exist.
# pg17 psql (match the dump's server version).
set -uo pipefail   # NOT -e: we handle psql errors ourselves (allowlist below)
PSQL=/opt/homebrew/Cellar/postgresql@17/17.6/bin/psql
[ -x "$PSQL" ] || { echo "❌ pg17 psql not at $PSQL"; exit 1; }

HERE="$(cd "$(dirname "$0")/.." && pwd)"
DUMP="${1:-$HERE/dumps/schema.sql}"
[ -f "$DUMP" ] || { echo "❌ dump not found: $DUMP (run dump.sh first — ฟีม holds prod cred)"; exit 1; }

# local target — SSL required (the compose postgres serves a self-signed cert)
LOCAL_URL='postgresql://postgres:postgres@localhost:5433/mumate_test?sslmode=require'
LOG="$(mktemp)"

echo "→ restoring $DUMP → localhost:5433/mumate_test"
# ON_ERROR_STOP=0 so we continue past the ONE known-safe error: `CREATE EXTENSION supabase_vault`
# (not available in stock postgres; no public table uses vault). We then ALLOWLIST exactly that error
# and FAIL on any other — a blanket "continue on error" would hide a broken restore (false-green). (บอง's catch.)
"$PSQL" "$LOCAL_URL" -v ON_ERROR_STOP=0 -f "$DUMP" > "$LOG" 2>&1 || true

# Tolerated = the supabase_vault cascade ONLY: the extension isn't available in stock pg, so its
# `COPY vault.secrets` block fails (relation does not exist) and the trailing `\.` then trips the pg17
# "backslash commands are restricted" guard. All vault-schema, unused by any app table. Everything else
# must fail. (Belt: dump.sh now --exclude-schema=vault so future dumps don't emit this at all.)
UNEXPECTED="$(grep -iE 'ERROR:|^error:' "$LOG" | grep -viE 'supabase_vault|vault\.secrets|backslash commands are restricted' || true)"
if [ -n "$UNEXPECTED" ]; then
  echo "🛑 restore had UNEXPECTED errors (beyond the tolerated supabase_vault) — aborting:"
  echo "$UNEXPECTED" | head -20
  rm -f "$LOG"; exit 1
fi
rm -f "$LOG"

# verify the REAL result — count tables, never trust "restore finished"
N="$("$PSQL" "$LOCAL_URL" -tAc "select count(*) from information_schema.tables where table_schema='public'" | tr -d '[:space:]')"
echo "→ public tables restored: ${N:-0} (expect ~149 = mootech 105 + bazi 44)"
[ "${N:-0}" -ge 140 ] || { echo "🛑 only ${N:-0} public tables — likely a silent restore failure"; exit 1; }
echo "✅ restore OK: $N public tables (only the tolerated supabase_vault extension was skipped)"
