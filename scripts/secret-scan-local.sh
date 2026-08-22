#!/usr/bin/env bash
# ตัวแทนชั่วคราวของ .github/workflows/secret-scan.yml ระหว่างที่ Actions minutes เต็ม (mootech-fe#380)
#
# 🔴 นี่ไม่ใช่ด่าน มันคือ "ตาข่ายที่ต้องมีคนขึง" — ต้องรันเอง ไม่มีอะไรบังคับ
#    วันที่โควตากลับมา ให้ลบไฟล์นี้ทิ้งแล้วกลับไปใช้ workflow
#
# ใช้:  bash scripts/secret-scan-local.sh [BASE]       BASE ไม่ใส่ = origin/main
# คืน:  0 = สแกนแล้วสะอาด · 1 = พบความลับ · 2 = ตรวจไม่ได้ (❌ ไม่ใช่ "สะอาด")
set -uo pipefail

BASE="${1:-origin/main}"

command -v gitleaks >/dev/null 2>&1 || { echo "🔴 ไม่มี gitleaks — brew install gitleaks"; exit 2; }

# ── canary ─────────────────────────────────────────────────────────────────────────────────────────
# 🔴 ประกอบตอนรัน ❌ ห้ามเขียนเป็นสตริงเดียวในไฟล์ (ตู๋ #381 B1)
#    ของเดิมเขียน PAT รูปแบบจริงลงไปตรงๆ ⇒ **สคริปต์ไม่ผ่านการสแกนของตัวเอง**
#    ⇒ ดังทุกครั้งที่ช่วง commit ครอบไฟล์นี้ ⇒ กลายเป็น noise ที่คนเรียนรู้ที่จะไม่ฟัง
#    ⇒ วันที่มันดังเพราะของจริง จะไม่มีใครแยกออก
# ⚠️ ห้ามใช้ AKIAIOSFODNN7EXAMPLE — gitleaks ยกเว้นคีย์ตัวอย่างของ AWS ⇒ canary ไม่ถูกจับ
_canary() { printf '%s_%s' 'ghp' 'wWPw5k4aXcaT4fNP0UcnZwJUVFk6LO0pINUx'; }

# ── control 1 · ไบนารีอ่านไฟล์แล้วเจอความลับได้ไหม ──────────────────────────────────────────────────
cdir="$(mktemp -d)"; trap 'rm -rf "$cdir"' EXIT
printf 'GITHUB_TOKEN=%s\n' "$(_canary)" > "$cdir/canary.env"
# 🔴 ห้ามต่อ pipe ตรงเข้า grep — ใต้ `pipefail` exit 1 ของ gitleaks (เจอ leak) จะชนะ exit 0 ของ grep
c1="$(gitleaks detect --source "$cdir" --no-git --redact -v 2>&1 || true)"
printf '%s' "$c1" | grep -qiE "leaks found: [1-9]" \
  || { echo "🔴 control 1 ล้ม: canary ไม่ถูกจับ ⇒ ผลสแกนเชื่อไม่ได้"; exit 2; }
echo "✅ control 1 (โหมดไฟล์): canary ถูกจับได้"

# ── ยืนยัน BASE เป็น ref จริง ───────────────────────────────────────────────────────────────────────
# 🔴 ของเดิมใช้ `git rev-list … || echo 0` ⇒ "ไม่มี commit ใหม่" กับ "คำนวณช่วงไม่ได้" หน้าตาเหมือนกัน
#    แล้ว exit 0 ⇒ **รายงานสะอาดโดยไม่ได้สแกน** (ตู๋ #381 B2 · ยิงพิสูจน์ 3 ทาง: พิมพ์ผิด · ref ไม่มี · GIT_DIR)
git rev-parse --verify --quiet "${BASE}^{commit}" >/dev/null \
  || { echo "🔴 BASE '$BASE' ไม่ใช่ commit ที่มีอยู่จริง ⇒ ตรวจไม่ได้"; exit 2; }
HEAD_SHA="$(git rev-parse --verify --quiet HEAD)" \
  || { echo "🔴 อ่าน HEAD ไม่ได้ ⇒ ตรวจไม่ได้"; exit 2; }

# 🔴 GIT_DIR ที่ชี้รีโปอื่น ทำให้สแกน 0 commit แล้วคืน 0 — สภาพนี้คือสภาพของการรันใต้ git hook พอดี
#    บั๊กเดียวกับ mootech-fe#337 (GIT_DIR ชนะ cwd) ที่รีโปนี้เคยโดนมาแล้ว
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
top="$(git rev-parse --show-toplevel 2>/dev/null || echo '')"
[ "$top" = "$here" ] \
  || { echo "🔴 git ชี้ไป '$top' แต่สคริปต์อยู่ที่ '$here' (GIT_DIR ตั้งไว้?) ⇒ ตรวจไม่ได้"; exit 2; }

n="$(git rev-list --count "${BASE}..${HEAD_SHA}")" \
  || { echo "🔴 นับ commit ไม่ได้ ⇒ ตรวจไม่ได้"; exit 2; }

# ── control 2 · โหมดเดียวกับด่านจริง (git range) ────────────────────────────────────────────────────
# 🔴 control 1 พิสูจน์แค่ว่าไบนารีอ่านไฟล์เป็น ❌ ไม่ได้พิสูจน์ว่า "ช่วงที่สั่งสแกน มีอะไรถูกสแกนจริง"
#    เคส GIT_DIR คือหลักฐาน: control 1 เขียว แต่สแกน 0 commit (ตู๋ #381 T1)
# ⚠️ ห้ามสแกนโฟลเดอร์รีโปจริงด้วย --no-git เพื่อทดสอบ — มันไล่ node_modules จนค้าง (บองตกหลุมนี้ตอนแก้ T1)
#    ใช้รีโป git ชั่วคราวที่มี canary 1 commit แทน ⇒ ทดสอบ --log-opts ตรงโหมด และเร็ว
gdir="$(mktemp -d)"; trap 'rm -rf "$cdir" "$gdir"' EXIT
(
  cd "$gdir" && git init -q . &&
  git -c user.email=c@x -c user.name=c commit -q --allow-empty -m base &&
  printf 'GITHUB_TOKEN=%s\n' "$(_canary)" > c.env &&
  git add c.env && git -c user.email=c@x -c user.name=c commit -q -m canary
) >/dev/null 2>&1 || { echo "🔴 control 2 ตั้งรีโปทดสอบไม่ได้ ⇒ ตรวจไม่ได้"; exit 2; }
c2="$(cd "$gdir" && gitleaks detect --source . --redact -v --log-opts="HEAD~1..HEAD" 2>&1 || true)"
printf '%s' "$c2" | grep -qiE "leaks found: [1-9]" \
  || { echo "🔴 control 2 ล้ม: canary ในโหมด git-range ไม่ถูกจับ ⇒ ผลสแกนเชื่อไม่ได้"; exit 2; }
echo "✅ control 2 (โหมด git range): canary ถูกจับได้"

# ── สแกนจริง ───────────────────────────────────────────────────────────────────────────────────────
echo "── สแกน ${BASE}..${HEAD_SHA:0:9} ($n commit)"
[ "$n" = "0" ] && { echo "  ไม่มี commit ใหม่ — ไม่มีอะไรต้องสแกน"; exit 0; }

report="$(mktemp -t gitleaks-XXXX).json"   # 🔴 พาธไม่คงที่ (ตู๋ T3) — /tmp ตัวเดิมทำให้อ่านรายงานรอบก่อน
gitleaks detect --source . --redact -v \
  --log-opts="${BASE}..${HEAD_SHA}" \
  --report-format json --report-path "$report"
rc=$?

# 🔴 แยก "เจอความลับ" (rc=1) ออกจาก "เครื่องมือล้ม" (rc≥2) — ของเดิมพิมพ์ข้อความเดียวกัน (ตู๋ T2)
#    ⇒ คนจะไปตามหาความลับที่ไม่มี
case "$rc" in
  0) echo "✅ ไม่พบความลับใน $n commit" ;;
  1) echo "🔴 พบความลับ — รายงาน: $report"
     echo "   ⛔ ห้าม push · ห้ามเปิด issue/PR · รายงานฟีมโดยตรงเท่านั้น (CLAUDE.md)" ;;
  *) echo "🔴 gitleaks ล้มเอง (rc=$rc) — ❌ ไม่ใช่ 'เจอความลับ' และ ❌ ไม่ใช่ 'สะอาด'"
     rc=2 ;;
esac
exit $rc
