#!/usr/bin/env bash
# Dump PROD → local file. ฟีม runs this (holds prod cred). Cred comes from the ENV at run time —
# never hardcoded, never written to any file. Schema-only by default (Phase 1); pass --with-data for rows.
#
#   export PROD_DATABASE_URL='postgresql://USER:PASS@HOST:5432/DBNAME?sslmode=require'
#   ./dump.sh                 # schema only → testenv/dumps/schema.sql
#   ./dump.sh --with-data     # schema + data → testenv/dumps/full.sql  (Phase 2, after anonymize plan)
set -euo pipefail

# 🛑 pg17 tools — `which pg_dump` here is 14.19 (too old for a pg17 server). Pin the pg17 binary.
PG_DUMP=/opt/homebrew/Cellar/postgresql@17/17.6/bin/pg_dump
[ -x "$PG_DUMP" ] || { echo "❌ pg17 pg_dump not at $PG_DUMP"; exit 1; }
: "${PROD_DATABASE_URL:?export PROD_DATABASE_URL first (not stored anywhere)}"

HERE="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$HERE/dumps"

if [ "${1:-}" = "--with-data" ]; then
  OUT="$HERE/dumps/full.sql"; MODE=(); echo "→ SCHEMA + DATA dump ($($PG_DUMP --version))"
else
  OUT="$HERE/dumps/schema.sql"; MODE=(--schema-only); echo "→ SCHEMA-ONLY dump ($($PG_DUMP --version))"
fi

# 🛡️ fail-closed: refuse to write a dump unless git actually ignores it (structure, not trust in a
# .gitignore line existing). full.sql = real customer PII; a committed dump = permanent leak.
if git -C "$HERE" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$HERE" check-ignore -q "$OUT" || {
    echo "🛑 REFUSE: '$OUT' is NOT git-ignored → a dump here could leak PII into git history."
    echo "   Add 'dumps/' + '*.sql' to testenv/.gitignore first, then re-run."
    exit 1
  }
fi

"$PG_DUMP" "$PROD_DATABASE_URL" "${MODE[@]}" --no-owner --no-privileges --no-comments -f "$OUT"
echo "✅ wrote $OUT"

# 🔎 PROOF POINT (do NOT skip): count bazi-prefixed tables. ~58 → confirms the 1-shared-DB reality.
N=$(grep -cE 'CREATE TABLE [^(]*"?bazi' "$OUT" || true)
echo "→ bazi-prefixed tables in dump: $N"
if [ "$N" -eq 0 ]; then
  echo "🛑 STOP: ZERO bazi tables in the dump. Prod is NOT the merged 1-DB we assumed."
  echo "   Report บอง before restoring — do not proceed to Path A. (git log said merged; the dump is ground truth.)"
  exit 2
fi
echo "✅ 1-DB confirmed by dump ($N bazi tables). Safe to restore."
