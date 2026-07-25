#!/usr/bin/env bash
# Restore a dump into the LOCAL test postgres (localhost:5433). Local cred only (postgres/postgres).
# Uses pg17 psql (match the dump's server version).
set -euo pipefail
PSQL=/opt/homebrew/Cellar/postgresql@17/17.6/bin/psql
[ -x "$PSQL" ] || { echo "❌ pg17 psql not at $PSQL"; exit 1; }

HERE="$(cd "$(dirname "$0")/.." && pwd)"
DUMP="${1:-$HERE/dumps/schema.sql}"
[ -f "$DUMP" ] || { echo "❌ dump not found: $DUMP (run dump.sh first — ฟีม holds prod cred)"; exit 1; }

# local target — SSL required (the compose postgres serves a self-signed cert)
LOCAL_URL='postgresql://postgres:postgres@localhost:5433/mumate_test?sslmode=require'

echo "→ restoring $DUMP → localhost:5433/mumate_test"
"$PSQL" "$LOCAL_URL" -v ON_ERROR_STOP=1 -f "$DUMP"
echo "✅ restore done"
echo "→ tables now in local db:"
"$PSQL" "$LOCAL_URL" -tAc "select count(*) from information_schema.tables where table_schema='public';"
