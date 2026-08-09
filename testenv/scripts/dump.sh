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
# cred: ใช้ $PROD_DATABASE_URL ถ้าตั้งมา · ไม่งั้นประกอบเองจาก ~/.mumate-prod/be.env.prod.local (#231)
# เดิมบังคับให้คนพิมพ์ URL เอง ⇒ ต้องมีมนุษย์ที่ถือ cred มานั่งทำทุกครั้ง และ URL มีโอกาสตกไปอยู่ใน
# shell history · ตอนนี้ blob อยู่ในเครื่องแล้ว (goo วางไว้ 2026-07-27) ⇒ อ่านตอนรัน ไม่เขียนลงดิสก์
# ⛔ ยืนยันเป้าก่อนเสมอ: DB_USERNAME ต้องเป็น prod ref ที่คาดไว้ ไม่งั้นหยุด — กัน blob ที่ชี้ผิดที่
if [ -z "${PROD_DATABASE_URL:-}" ]; then
  BLOB="$HOME/.mumate-prod/be.env.prod.local"
  if [ -f "$BLOB" ]; then
    _v() { grep -E "^$1=" "$BLOB" | head -1 | cut -d= -f2- | sed -E 's/^"//; s/"$//'; }
    _H=$(_v DB_HOST); _P=$(_v DB_PORT); _D=$(_v DB_DATABASE); _U=$(_v DB_USERNAME); _W=$(_v DB_PASSWORD)
    case "$_U" in
      *soxsccdlsycaevusndro*) : ;;
      *) echo "🛑 $BLOB ไม่ได้ชี้ prod ref ที่คาดไว้ — ไม่ dump ต่อ (ตั้ง PROD_DATABASE_URL เองถ้าตั้งใจ)"; exit 3 ;;
    esac
    _enc() { python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$1"; }
    PROD_DATABASE_URL="postgresql://$(_enc "$_U"):$(_enc "$_W")@${_H}:${_P}/${_D}?sslmode=require"
    echo "🎯 cred จาก ~/.mumate-prod (prod soxsccdlsycaevusndro · host=$_H port=$_P) — ไม่แสดงรหัสผ่าน"
    unset _H _P _D _U _W
  fi
fi
: "${PROD_DATABASE_URL:?ไม่มี ~/.mumate-prod/be.env.prod.local และไม่ได้ตั้ง PROD_DATABASE_URL — อย่างใดอย่างหนึ่งต้องมี}"

HERE="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$HERE/dumps"

# NOTE: string flag, NOT an array — an empty bash array `MODE=()` + `set -u` is treated as UNBOUND on
# macOS bash 3.2 (`/bin/bash`), so the --with-data path crashed with "MODE[@]: unbound variable" before
# it even reached the DB. bash 4+ tolerates it; macOS ships 3.2. (Caught by actually running the path.)
if [ "${1:-}" = "--with-data" ]; then
  OUT="$HERE/dumps/full.sql"; SCHEMA_FLAG=""; echo "→ SCHEMA + DATA dump ($($PG_DUMP --version))"
else
  OUT="$HERE/dumps/schema.sql"; SCHEMA_FLAG="--schema-only"; echo "→ SCHEMA-ONLY dump ($($PG_DUMP --version))"
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

# --exclude-schema=vault: the supabase_vault extension isn't available in stock pg, so restoring its
# `COPY vault.secrets` block errors (+ trips pg17's \restrict guard). vault is Supabase-internal, no app
# table uses it → drop it at dump time so the restore is clean. (Keep auth: 35 public FKs → auth.users.)
"$PG_DUMP" "$PROD_DATABASE_URL" ${SCHEMA_FLAG:+"$SCHEMA_FLAG"} --exclude-schema=vault \
  --no-owner --no-privileges --no-comments -f "$OUT"
echo "✅ wrote $OUT"

# 🔎 PROOF POINT (do NOT skip): count bazi-prefixed tables. ANY > 0 → confirms the 1-shared-DB reality
# (real dump 2026-07-26 = 44 bazi tables in `public`; the memory's "58" was 48 runtime + 10 authoring,
# now 44 — the exact number doesn't matter, presence does. 0 = prod is NOT the merged 1-DB → STOP).
N=$(grep -cE 'CREATE TABLE [^(]*"?bazi' "$OUT" || true)
echo "→ bazi-prefixed tables in dump: $N"
if [ "$N" -eq 0 ]; then
  echo "🛑 STOP: ZERO bazi tables in the dump. Prod is NOT the merged 1-DB we assumed."
  echo "   Report บอง before restoring — do not proceed to Path A. (git log said merged; the dump is ground truth.)"
  exit 2
fi
echo "✅ 1-DB confirmed by dump ($N bazi tables). Safe to restore."
