#!/usr/bin/env bash
# ANCHOR: inject-oauth-allowlist — คีย์ที่ stack.sh เติมลง .env ต้องมีแค่ OAuth ห้ามลากอะไรอื่นจาก vault blob
#
# ทำไมต้องมี: `~/.mumate-prod/fe.env.local` คือไฟล์ env ของ **prod ตัวจริง** — ข้างในมีทั้งคีย์ OAuth ที่เรา
# อยากได้ และ DATABASE_URL/SUPABASE_*/NEXTAUTH_URL ที่ชี้ของจริง · inject_oauth คัดออกด้วย allowlist
# ⇒ ถ้า allowlist กว้างขึ้นเมื่อไหร่ สนามซ้อมจะชี้ prod เงียบ ๆ · guard เป็นด่านสำรอง (ตู๋พิสูจน์แล้วว่า
#   ก่อน #231 มันจับได้แค่บางคีย์) แต่ด่านสำรองไม่ใช่เหตุผลให้ด่านหน้าไม่มีคนเฝ้า
#
# 🔴 มิวแทนต์ที่ต้องทำให้ไฟล์นี้แดง (ถ้าไม่แดง = เทสต์นี้ไม่มีฟัน ให้ลบทิ้ง อย่าเก็บไว้ให้เข้าใจผิด):
#   1. เติม DATABASE_URL เข้า OAUTH_KEYS ใน stack.sh          → เคส "ตัวพิษต้องไม่ลง" แดง
#   2. เปลี่ยน inject_oauth ให้ cat ทั้ง blob แทนการวนตาม key → เคส "ตัวพิษต้องไม่ลง" แดง
#   3. ลบบรรทัด `[ "$repo" = "mootech-fe" ] && inject_oauth`  → เคส CALL SITE แดง
#   4. ย้าย inject_oauth ไปไว้ "หลัง" guard                    → เคส ลำดับ แดง
#
# Run: bash testenv/scripts/inject-oauth.test.sh
set -uo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
STACK="$HERE/scripts/stack.sh"
pass=0; fail=0
ok()  { echo "  ✓ $1"; pass=$((pass+1)); }
bad() { echo "  ✗ $1"; fail=1; }

# ── ชั้นที่ 1: พฤติกรรมจริงของ inject_oauth (ยิงฟังก์ชันตัวจริงใน stack.sh ไม่ใช่สำเนา) ──
# ใช้ hook STACK_SOURCE_ONLY ที่ stack.sh มีอยู่แล้ว: source เข้ามาได้ฟังก์ชัน โดยไม่รันอะไรเลย
BLOB="$(mktemp)"; DEST="$(mktemp)"
cat > "$BLOB" <<'BLOBEOF'
LINE_CLIENT_ID=line-id-value
LINE_CLIENT_SECRET=line-secret-value
GOOGLE_CLIENT_ID=google-id-value
GOOGLE_CLIENT_SECRET=google-secret-value
DATABASE_URL=postgresql://u:p@db.realprod.supabase.co:5432/postgres
SUPABASE_PROJECT_URL=https://realprod.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiJ9.real.sig
NEXTAUTH_URL=https://mumate.com
FACEBOOK_CLIENT_ID=fb-id-value
BLOBEOF
printf 'DATABASE_URL=postgresql://postgres:postgres@localhost:5433/mumate_test\n' > "$DEST"

# shellcheck disable=SC1090
STACK_SOURCE_ONLY=1 . "$STACK" 2>/dev/null
# 🔴 stack.sh:21 ตั้ง `set -euo pipefail` ไว้ที่หัวไฟล์ · การ `. stack.sh` ลาก errexit เข้ามาในเชลล์ของเทสต์ด้วย
# ⇒ เคสไหนที่ประเมินเป็น false (เช่น grep ไม่เจอ call site) จะ **ฆ่าสคริปต์ทิ้งก่อนพิมพ์ ✗**
#    ผลคือแดงจริง (exit 1) แต่ไม่มีบรรทัดบอกว่าตกเคสไหน — ตู๋เจอตอน verify #232
# ⇒ นี่คือบั๊กตระกูลเดียวกับที่ PR นี้เพิ่งแก้ใน stack.sh (pipefail ทำให้ status ตายก่อนพิมพ์บรรทัดสุดท้าย)
#    ผมแก้ที่ต้นทางแล้วสร้างซ้ำในไฟล์เทสต์ที่เขียนใหม่เอง ⇒ ปิดที่นี่ด้วย set +e
set +e
if ! declare -f inject_oauth >/dev/null 2>&1; then
  echo "  ✗ source stack.sh แล้วไม่เจอ inject_oauth — เทสต์นี้เฝ้าอะไรไม่ได้เลย"; exit 1
fi
OAUTH_BLOB="$BLOB" inject_oauth "$DEST" >/dev/null 2>&1

n_oauth=$(grep -cE '^(LINE|GOOGLE)_CLIENT_(ID|SECRET)=' "$DEST")
[ "$n_oauth" = "4" ] && ok "เติมคีย์ OAuth ครบ 4 ตัว" || bad "ควรได้คีย์ OAuth 4 ตัว แต่ได้ $n_oauth"

# ตัวพิษทุกตัวใน blob ต้องไม่ลงปลายทาง — วัดทีละคีย์ ไม่ใช่ยอดรวม (ยอดรวม 0 อ่านไม่ออกว่าตัวไหนหลุด)
for k in DATABASE_URL SUPABASE_PROJECT_URL SUPABASE_SERVICE_ROLE_KEY NEXTAUTH_URL FACEBOOK_CLIENT_ID; do
  if grep -qE "^$k=.*(realprod|mumate\.com|eyJ|fb-id)" "$DEST"; then bad "ตัวพิษหลุดลง .env: $k"; else ok "ตัวพิษไม่ลง: $k"; fi
done

# DATABASE_URL เดิมของปลายทางต้องไม่ถูกทับ (inject ต้อง "เติม" ไม่ใช่ "เขียนทับไฟล์")
grep -qE '^DATABASE_URL=postgresql://postgres:postgres@localhost:5433/' "$DEST" \
  && ok "DATABASE_URL เดิมยังชี้ localhost:5433" || bad "DATABASE_URL เดิมถูกแก้/หาย"

# ไม่มี blob = ต้องไม่ล้ม (fallback ไป /dev-login) และต้องไม่เขียนอะไรลงไฟล์
DEST2="$(mktemp)"; : > "$DEST2"
OAUTH_BLOB="/no/such/blob/$$" inject_oauth "$DEST2" >/dev/null 2>&1
[ ! -s "$DEST2" ] && ok "ไม่มี blob → ไม่เขียนอะไรลงไฟล์ ไม่ล้ม" || bad "ไม่มี blob แต่ยังเขียนอะไรลงไฟล์"

# ── ชั้นที่ 2: CALL SITE — ฟังก์ชันถูกเรียกจริงไหม และเรียกก่อน guard ไหม ──
# ชั้นนี้อ่านตัวบทของ stack.sh ตรง ๆ (structural) เพราะการรัน call site จริงต้อง restore ฐาน 1.2GB
# ⚠️ พูดตรง ๆ ว่ามันมีฟันแค่ไหน: มันจับ "บรรทัดหายไป/ย้ายที่" ได้ · จับ "เรียกแล้วแต่ผลไม่ถึงไฟล์" ไม่ได้
#    (ส่วนนั้นคือชั้นที่ 1) · ทั้งสองชั้นรวมกันจึงครอบทั้ง "ถูกเรียก" และ "เรียกแล้วได้ผลถูก"
call_line=$(grep -nE '^\s*\[ "\$repo" = "mootech-fe" \] && inject_oauth "\$dest"' "$STACK" | head -1 | cut -d: -f1)
if [ -n "$call_line" ]; then ok "call site เรียก inject_oauth อยู่ (บรรทัด $call_line)"
else bad "ไม่พบ call site ของ inject_oauth ใน stack.sh — คีย์ OAuth จะไม่ถูกเติมเลย"; fi

guard_line=$(grep -nE '^\s*bash "\$GUARD" \$\(active_envs "\$dir"\)' "$STACK" | head -1 | cut -d: -f1)
if [ -n "$call_line" ] && [ -n "$guard_line" ] && [ "$call_line" -lt "$guard_line" ]; then
  ok "inject อยู่ก่อน guard (บรรทัด $call_line < $guard_line) — guard จึงสแกนไฟล์หลังเติม"
else
  bad "ลำดับผิด: inject ต้องอยู่ก่อน guard ไม่งั้น guard สแกนไฟล์ที่ยังไม่ถูกเติม (inject=$call_line guard=$guard_line)"
fi

rm -f "$BLOB" "$DEST" "$DEST2"
echo
if [ "$fail" = "0" ]; then echo "✅ inject-oauth: ผ่านทั้งหมด ($pass เคส)"; exit 0
else echo "❌ inject-oauth: มีเคสที่ไม่ผ่าน"; exit 1; fi
