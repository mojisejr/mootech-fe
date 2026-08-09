#!/usr/bin/env bash
# ANCHOR: guard-fail-closed — the test-env guard MUST refuse every prod DB host and accept ONLY local.
# This is the safety invariant of the whole stack: if the guard ever regresses to allowing a prod host,
# an agent could point the test stack at the real customer DB. Mutant: weaken guard.sh PROD_PATTERNS or
# the local requirement → an expect_* below flips → RED.
# Run: bash testenv/scripts/guard.test.sh
set -uo pipefail
G="$(cd "$(dirname "$0")" && pwd)/guard.sh"
pass=0; fail=0
refuse() { if bash "$G" --check-string "$1" >/dev/null 2>&1; then echo "  ✗ ALLOWED prod: $1"; fail=1; else echo "  ✓ refused: $1"; pass=$((pass+1)); fi; }
allow()  { if bash "$G" --check-string "$1" >/dev/null 2>&1; then echo "  ✓ allowed local: $1"; pass=$((pass+1)); else echo "  ✗ REFUSED local: $1"; fail=1; fi; }

# prod hosts — must ALL be refused (fail-closed)
refuse 'postgresql://u:p@db.abcxyz.supabase.co:5432/postgres'
refuse 'postgresql://u:p@ep-anc.aws.neon.tech/db'
refuse 'postgresql://u:p@x.pooler.supabase.com:6543/postgres'
refuse 'postgresql://u:p@mootech-be.onrender.com/db'
refuse 'postgresql://u:p@x.abc.rds.amazonaws.com:5432/db'
# a NON-local, non-prod-fingerprinted host must ALSO be refused (fail-closed by default, not open-by-default)
refuse 'postgresql://u:p@some-random-host.example.com:5432/db'
# too's adversarial bypass: "localhost" hidden in the PASSWORD of a REMOTE url must NOT pass as local
refuse 'postgresql://admin:super_secret_localhost:5432_hack@remote-custom-domain.com:5432/db'
refuse 'postgresql://user:pw@localhost.evil.com:5432/db'   # host that merely STARTS with localhost
# local — must be allowed
allow 'postgresql://postgres:postgres@localhost:5433/mumate_test'
allow 'postgresql://postgres:postgres@127.0.0.1:5433/mumate_test'

# #177: guard now also scans NEXT_PUBLIC_BACKEND_URL (a prod backend URL reaches the prod DB). File-scan.
tmpf="$(mktemp)"
printf 'NEXT_PUBLIC_BACKEND_URL=https://mootech-be.onrender.com\n' > "$tmpf"
if bash "$G" "$tmpf" >/dev/null 2>&1; then echo "  ✗ ALLOWED prod NEXT_PUBLIC_BACKEND_URL"; fail=1; else echo "  ✓ refused prod NEXT_PUBLIC_BACKEND_URL (file scan, #177)"; pass=$((pass+1)); fi
printf 'NEXT_PUBLIC_BACKEND_URL=http://localhost:4000\n' > "$tmpf"
if bash "$G" "$tmpf" >/dev/null 2>&1; then echo "  ✓ allowed local NEXT_PUBLIC_BACKEND_URL"; pass=$((pass+1)); else echo "  ✗ REFUSED local NEXT_PUBLIC_BACKEND_URL"; fail=1; fi
rm -f "$tmpf"

# #184: guard refuses REAL outbound-provider hosts (8x8/LINE/Omise/SendGrid) anywhere in a test-env file,
# so an accidentally-invoked otp/sms/line/payment call can't reach a live provider. Neutralized `.invalid`
# hosts must PASS; a comment mentioning a provider must NOT false-refuse. Mutant: drop a PROVIDER_PATTERN
# (or the whole-file scan) → a real host slips through → the refuse case below flips → RED.
tmpf="$(mktemp)"
for real in 'SMS_8X8_HOST=https://sms.8x8.com' 'LINE_HOST=https://api.line.me' 'X=https://api.omise.co/charges' 'Y=https://api.sendgrid.com/v3/mail'; do
  printf 'DB_HOST=localhost\n%s\n' "$real" > "$tmpf"
  if bash "$G" "$tmpf" >/dev/null 2>&1; then echo "  ✗ ALLOWED real provider: $real"; fail=1; else echo "  ✓ refused real provider: ${real%%=*}"; pass=$((pass+1)); fi
done
# neutralized .invalid hosts must PASS
printf 'DB_HOST=localhost\nSMS_8X8_HOST=https://sms.8x8.invalid\nLINE_HOST=https://line.invalid\nSUPABASE_PROJECT_URL=https://dummy.supabase.invalid\n' > "$tmpf"
if bash "$G" "$tmpf" >/dev/null 2>&1; then echo "  ✓ allowed neutralized .invalid provider hosts (#184)"; pass=$((pass+1)); else echo "  ✗ REFUSED neutralized .invalid hosts"; fail=1; fi
# a COMMENT mentioning a real provider must not false-refuse
printf 'DB_HOST=localhost\n# do not point SMS_8X8_HOST at sms.8x8.com or LINE at api.line.me\nSMS_8X8_HOST=https://sms.8x8.invalid\n' > "$tmpf"
if bash "$G" "$tmpf" >/dev/null 2>&1; then echo "  ✓ comment mentioning a provider is ignored (#184)"; pass=$((pass+1)); else echo "  ✗ comment false-refused"; fail=1; fi

# #231/ตู๋ — 3 คีย์ที่เคย "ผ่านเขียว" ทั้งที่ชี้ prod เต็ม ๆ (guard เฝ้าแค่ DATABASE_URL/DB_HOST)
# คอมเมนต์ใน stack.sh อ้าง guard เป็นด่านสำรองสำหรับคีย์พวกนี้ ⇒ คำอ้างนั้นเคยไม่จริง เคสข้างล่างคือคนเฝ้ามัน
# มิวแทนต์: ถอดคีย์ใดคีย์หนึ่งออกจาก DB_KEYS/SECRETLIKE_KEYS ใน guard.sh → เคสนั้นแดง
refuse_file() { printf 'DB_HOST=localhost\n%s\n' "$2" > "$tmpf"
  if bash "$G" "$tmpf" >/dev/null 2>&1; then echo "  ✗ ALLOWED prod: $1"; fail=1; else echo "  ✓ refused: $1"; pass=$((pass+1)); fi; }
allow_file()  { printf 'DB_HOST=localhost\n%s\n' "$2" > "$tmpf"
  if bash "$G" "$tmpf" >/dev/null 2>&1; then echo "  ✓ allowed: $1"; pass=$((pass+1)); else echo "  ✗ REFUSED valid: $1"; fail=1; fi; }

refuse_file 'SUPABASE_PROJECT_URL → prod'      'SUPABASE_PROJECT_URL=https://soxsccdlsycaevusndro.supabase.co'
refuse_file 'SUPABASE_SERVICE_ROLE_KEY = JWT จริง' 'SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiJ9.real.sig'
refuse_file 'NEXTAUTH_URL → โดเมนจริง'          'NEXTAUTH_URL=https://mumate.com'
refuse_file 'NEXT_PUBLIC_SUPABASE_URL → prod'   'NEXT_PUBLIC_SUPABASE_URL=https://sox.supabase.co'
# ค่าที่สนามซ้อมใช้จริง ต้องไม่ถูกปฏิเสธ — ไม่งั้น guard ที่แข็งขึ้นจะทำให้ stack บูตไม่ขึ้นเลย
allow_file  'NEXTAUTH_URL = localhost'          'NEXTAUTH_URL=http://localhost:3000'
allow_file  'SERVICE_ROLE_KEY = ค่า dummy'      'SUPABASE_SERVICE_ROLE_KEY=dummy-service-role-key'
# ตู๋ verify #232: กฎเดิมจับแค่ JWT รุ่นเก่า (^eyJ) — คีย์ Supabase รุ่นใหม่ (2025+) ผ่านเขียวทั้งคู่
refuse_file 'service-role รุ่นใหม่ sb_secret_'  'SUPABASE_SERVICE_ROLE_KEY=sb_secret_AbCdEf123456'
refuse_file 'anon รุ่นใหม่ sb_publishable_'     'SUPABASE_ANON_KEY=sb_publishable_AbCdEf123456'
rm -f "$tmpf"

if [ "$fail" -eq 0 ]; then echo "  guard-fail-closed: $pass passed"; else echo "  guard-fail-closed: SOME FAILED"; exit 1; fi
