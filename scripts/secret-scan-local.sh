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

# 🔴 GIT_DIR ที่ชี้รีโปอื่น ทำให้อ่าน ref ของรีโปอื่น แล้วรายงานว่าสะอาด
#    สภาพนี้คือสภาพของการรันใต้ git hook พอดี — บั๊กเดียวกับ mootech-fe#337 (GIT_DIR ชนะ cwd)
#
# ⚠️ ฉบับก่อนเทียบ `rev-parse --show-toplevel` กับที่ตั้งสคริปต์ — **ด่านนั้นมองไม่เห็น GIT_DIR** (ตู๋ #381 รอบสอง)
#    เพราะเมื่อมี GIT_DIR แต่ไม่มี GIT_WORK_TREE `--show-toplevel` ยังตอบตาม cwd
#    ⇒ ทั้งสองข้างของการเทียบเคลื่อนตาม cwd ทั้งคู่ ⇒ ด่านผ่านเสมอ ขณะที่การอ่าน ref ไปตาม GIT_DIR
#    ยิงพิสูจน์: GIT_DIR=<อีกรีโป> → show-toplevel ไม่ขยับ · absolute-git-dir ขยับ · HEAD เป็นของรีโปอื่น
#
# 🔑 ตัวชี้วัดที่ไวจริงคือ `--absolute-git-dir`
# ⚠️ แต่ใน worktree มันตอบ `<หลัก>/.git/worktrees/<ชื่อ>` ❌ ไม่ใช่ `$here/.git`
#    ⇒ เทียบพาธตรงๆ จะแดงเก๊ทุกครั้งที่รันใน worktree ซึ่งเป็นที่ที่ตู๋รีวิวทุกใบ
#    ⇒ เกณฑ์คือ "git dir อยู่ใต้รีโปเดียวกับสคริปต์" ❌ ไม่ใช่ "เท่ากันเป๊ะ"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
gdir_abs="$(git rev-parse --absolute-git-dir 2>/dev/null || echo '')"
common="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null || echo '')"
[ -n "$common" ] || { echo "🔴 อ่าน git-common-dir ไม่ได้ ⇒ ตรวจไม่ได้"; exit 2; }

# 🔑 เกณฑ์คือ "git dir กับสคริปต์ เป็นของ **รีโปเดียวกัน**" ❌ ไม่ใช่ "อยู่ในโฟลเดอร์เดียวกัน"
#    รันจาก worktree เป็นเรื่องปกติ (ตู๋รีวิวทุกใบใน worktree) — common-dir จะเป็น <หลัก>/.git ส่วน here เป็นโฟลเดอร์ worktree
#    ⇒ เทียบด้วย **remote origin URL** ซึ่งเหมือนกันทุก worktree ของรีโปเดียวกัน แต่ต่างทันทีเมื่อ GIT_DIR ชี้รีโปอื่น
want="$(git -C "$here" --git-dir="$here/.git" remote get-url origin 2>/dev/null || \
        git -C "$here" remote get-url origin 2>/dev/null || echo '')"
have="$(git remote get-url origin 2>/dev/null || echo '')"
if [ -z "$have" ] || [ "$want" != "$have" ]; then
  echo "🔴 git ชี้ไปรีโปอื่น — origin ที่อ่านได้: '${have:-<ว่าง>}' · ของสคริปต์: '${want:-<ว่าง>}'"
  echo "   (git dir: '$gdir_abs') ⇒ GIT_DIR ถูกตั้งไว้? กำลังจะอ่าน ref ของรีโปอื่น ⇒ ตรวจไม่ได้"
  exit 2
fi

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
