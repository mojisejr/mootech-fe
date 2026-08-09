#!/usr/bin/env bash
# 🛡️ fail-closed guard — refuse the test stack if ANY DB target points at a prod host.
# Layer 3 of the plan (structure, not intent). Run it BEFORE boot AND AFTER copying env over .env
# (บอง's catch: stack.sh overwrites the real .env that currently holds prod cred — verify the RESULT).
#
# Usage:  guard.sh <env-file-or-dir> [...]   — scans given .env files for DB targets
#         guard.sh --check-string "<conn>"   — check a single connection string
set -euo pipefail

PROD_PATTERNS='supabase\.com|supabase\.co|neon\.tech|render\.com|\.rds\.amazonaws\.com|pooler\.supabase'
# #184: REAL outbound-provider hosts must NEVER appear in a test-env file — an accidentally-invoked
# otp/line/sms/payment call would then hit the LIVE provider (real SMS/charge). The test-env neutralizes
# these to RFC-2606 `.invalid` (unreachable); this guard is the fail-closed tripwire that refuses the stack
# if anyone points them back at the real domains. Scanned across the WHOLE file (whole-space, not a key list).
PROVIDER_PATTERNS='api\.line\.me|8x8\.com|omise\.co|api\.sendgrid\.com|sendgrid\.net'
# Keys that must never point at prod. #177: NEXT_PUBLIC_BACKEND_URL too — the .env.local hole pointed the
# FE at the PROD backend (onrender.com), which reaches the prod DB; scanning only DB_HOST/DATABASE_URL missed it.
# #231/ตู๋: เดิมรายการนี้ไม่มี SUPABASE_*/NEXTAUTH_URL ⇒ ยัดค่า prod ลงคีย์พวกนั้น guard **ผ่านเขียว**
# (ตู๋ยิงมิวแทนต์เจอ · บองยืนยันซ้ำเอง: 3 ใน 5 คีย์ที่คอมเมนต์ stack.sh เอ่ยชื่อเอง หลุดหมด)
#   SUPABASE_PROJECT_URL     = ทางเข้า REST/Storage ของโปรเจกต์ → ชี้ prod = แตะข้อมูลจริงได้โดยไม่ผ่าน DATABASE_URL
#   SUPABASE_SERVICE_ROLE_KEY = คีย์ข้าม RLS ทั้งฐาน — อันตรายที่สุดในไฟล์ และไม่มี host ให้ตรวจ (ดู SECRETLIKE)
#   NEXTAUTH_URL              = ปลายทาง OAuth callback → ชี้ domain จริง = ดึง session ของผู้ใช้จริงเข้าเครื่องนี้
DB_KEYS='DATABASE_URL|APP_DATABASE_URL|DB_HOST|PROD_DATABASE_URL|NEXT_PUBLIC_BACKEND_URL|SUPABASE_PROJECT_URL|SUPABASE_URL|NEXT_PUBLIC_SUPABASE_URL|NEXTAUTH_URL'
# คีย์ที่ "ค่าเองคืออำนาจ" — ไม่มี host ให้ตรวจ จึงตรวจที่รูปร่างแทน: service-role/anon ของ Supabase เป็น JWT
# ขึ้นต้น `eyJ` เสมอ · ค่า dummy ในสนามซ้อมไม่ใช่ JWT ⇒ กฎนี้แยกของจริงออกจากของปลอมได้โดยไม่ต้องรู้ค่า
SECRETLIKE_KEYS='SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY|SUPABASE_REAL_PRODUCTION_SERVICE_ROLE_KEY'

fail=0
check_value() {  # $1 = key, $2 = value
  local k="$1" v="$2" host
  # strip an inline "# comment" (a trailing comment on a .env value would otherwise make a local host
  # look non-local → false refuse; dotenv parsers strip it, bash greps don't). Only " #..." (space+#).
  v=$(printf '%s' "$v" | sed -E 's/[[:space:]]+#.*$//')
  [ -z "$v" ] && return 0
  if printf '%s' "$v" | grep -qiE "$PROD_PATTERNS"; then
    # show only the matched FAMILY (e.g. supabase.com), never the full host/creds (no env value leak)
    fam=$(printf '%s' "$v" | grep -oiE "$PROD_PATTERNS" | head -1)
    echo "🛑 REFUSE: $k → prod host family ($fam)"; fail=1; return 0
  fi
  # For a URL, extract the ACTUAL host (after the LAST @, before port/path) and require it be local.
  # A substring match ("localhost" anywhere) would let a password like `super_secret_localhost:5432`
  # in a remote URL bypass the guard (too's adversarial find). Host-based is not foolable that way.
  if printf '%s' "$k" | grep -qE 'URL$'; then
    host=$(printf '%s' "$v" | sed -E 's#^[a-zA-Z]+://##; s#\?.*$##; s#^.*@##; s#[:/].*$##')
    case "$host" in
      localhost|127.0.0.1|host.docker.internal|postgres) : ;;  # local — ok
      # *.invalid = RFC-2606 ที่ resolve ไม่ได้ทั้งอินเทอร์เน็ต — สนามซ้อมใช้เป็น "ท่อตัน" มาตรฐานอยู่แล้ว
      # (env/be.env: SUPABASE_PROJECT_URL=https://dummy.supabase.invalid) ⇒ ปลอดภัยพอ ๆ กับ local
      # ต้องอยู่ตรงนี้ ไม่งั้นการเพิ่ม SUPABASE_PROJECT_URL เข้า DB_KEYS จะทำให้สนามซ้อมบูตไม่ขึ้นทันที
      *.invalid) : ;;
      *) echo "🛑 REFUSE: $k → host is not local (fail-closed)"; fail=1 ;;
    esac
  fi
  if [ "$k" = "DB_HOST" ] && ! printf '%s' "$v" | grep -qiE '^(localhost|127\.0\.0\.1|postgres)$'; then
    echo "🛑 REFUSE: DB_HOST → not local"; fail=1
  fi
  # #231/ตู๋: คีย์ที่ไม่มี host ให้ตรวจ — ตรวจที่รูปร่างของค่าแทน
  # JWT จริงของ Supabase ขึ้นต้น `eyJ` (base64 ของ '{"') · ค่า dummy ในสนามซ้อมไม่ใช่
  # ⇒ กฎนี้ปฏิเสธ "ของจริง" ได้โดยไม่ต้องรู้ว่าค่าที่ถูกต้องคืออะไร และไม่พิมพ์ค่าออกมา
  # รูปแบบคีย์จริงของ Supabase ที่ต้องปฏิเสธ — ครอบทั้งของเก่าและของใหม่ (ตู๋ verify #232: ^eyJ เฝ้าแค่ของเก่า)
  #   eyJ…              JWT รุ่นเดิม (base64 ของ '{"')
  #   sb_secret_…       service-role รุ่นใหม่ (2025+) — อำนาจเท่า service-role เดิม
  #   sb_publishable_…  anon รุ่นใหม่ — อำนาจน้อยกว่า แต่ยังผูกกับโปรเจกต์จริง ⇒ ไม่ควรอยู่ในสนามซ้อม
  if printf '%s' "$k" | grep -qE "^($SECRETLIKE_KEYS)$" && printf '%s' "$v" | grep -qE '^(eyJ|sb_secret_|sb_publishable_)'; then
    echo "🛑 REFUSE: $k → ดูเหมือนคีย์ Supabase ของจริง — สนามซ้อมต้องใช้ค่า dummy เท่านั้น"; fail=1
  fi
}

if [ "${1:-}" = "--check-string" ]; then
  check_value "DATABASE_URL" "${2:-}"
else
  for target in "$@"; do
    [ -f "$target" ] || { echo "  (skip missing $target)"; continue; }
    # กรองด้วยรายการรวม — ถ้าใช้แค่ DB_KEYS กฎ SECRETLIKE ใน check_value จะกลายเป็นโค้ดตายทันที
    # (เขียนกฎไว้แต่ไม่มีบรรทัดไหนเดินไปถึง = ตระกูลเดียวกับ "anchor ที่ไม่มีอะไรเรียก" ใน #217)
    SCAN_KEYS="$DB_KEYS|$SECRETLIKE_KEYS"
    while IFS='=' read -r k v; do
      printf '%s' "$k" | grep -qE "^($SCAN_KEYS)$" || continue
      check_value "$k" "$(printf '%s' "$v" | tr -d '"'"'"' ')"
    done < <(grep -E "^($SCAN_KEYS)=" "$target" || true)
    # #184: fail-closed tripwire — refuse if any REAL provider host appears (scan values only: drop comment
    # lines + inline "# ..." so prose mentioning a provider name can't false-refuse).
    provider_hits=$(grep -vE '^[[:space:]]*#' "$target" | sed -E 's/[[:space:]]+#.*$//' | grep -ioE "$PROVIDER_PATTERNS" | sort -u || true)
    if [ -n "$provider_hits" ]; then
      echo "🛑 REFUSE: $target points at a REAL outbound provider host → $(printf '%s' "$provider_hits" | tr '\n' ' ')"
      echo "   ↳ neutralize to an RFC-2606 .invalid host — the test stack must never reach a live provider."
      fail=1
    fi
  done
fi

if [ "$fail" -ne 0 ]; then
  # ANCHOR: guard-teach-on-refuse
  # Layer 2 — when the guard stops, it TEACHES (why / how / where to read) and always offers BOTH paths
  # (normal = open the practice field · intentional = prod-run). No env value here — only human guidance.
  cat >&2 <<'TEACH'

🛑 หยุดไว้ก่อน — env นี้ชี้ออกนอกเครื่อง (ไม่ใช่สนามซ้อม) · เครื่องนี้ตั้งใจให้พักที่สนามซ้อมเสมอ
   (guard เห็นแค่ family ของ host — dev หรือ prod กันแน่? เช็คให้ชัด: bash testenv/scripts/stack.sh status)

  ทำไมหยุด : ถ้าปล่อยให้รันด้วย env นี้ แอปจะต่อฐานข้อมูล/บริการนอกเครื่อง (dev หรือ prod) — กระทบของจริงได้
  ทำยังไงต่อ:
    • ทำงานปกติ (ที่ควรเป็นเกือบทุกครั้ง) → เปิดสนามซ้อม:
        bash testenv/scripts/stack.sh up
    • ตั้งใจต่อของจริงจริงๆ (นานๆ ครั้ง) → ใช้ prod-run (ยืนยันด้วยมือ + ท่อขาออกตันโดย default):
        node testenv/scripts/prod-run.mjs <app> -- <คำสั่ง>
  อ่านเพิ่ม : mootech-fe/testenv/README.md
TEACH
  exit 1
fi
echo "✅ guard: all DB targets local — safe"
