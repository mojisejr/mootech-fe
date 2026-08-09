#!/usr/bin/env bash
# One command to stand up the test stack SAFELY — or `restore` to undo it. Never touches prod.
#   bash scripts/stack.sh [up]      → guard → docker pg(SSL) → restore+anonymize dump → swap each app's
#                                     .env to LOCAL (backup real one first, drop a marker, guard AFTER)
#   bash scripts/stack.sh restore   → put every app's real .env back from testenv/.backups/, drop markers
#
# Safety model = STRUCTURE, not discipline:
#   • the real .env (may hold PROD cred) is backed up into testenv/.backups/ (gitignored) BEFORE any swap,
#     and NEVER overwritten once it exists — so the prod cred can always be recovered.
#   • #177: Next loads `.env.local` / `.env.development.local` BEFORE `.env`, so a prod-pointing `.env.local`
#     would WIN over the safe `.env` we place and the old guard (which only saw `.env`) reported "safe" while
#     the app read prod (fail-OPEN). We now MOVE ASIDE every OTHER `.env*` file (backed up → `*.testenv-shadowed`)
#     so the placed `.env` is the ONLY active env file, and guard scans the whole active set (glob, not a
#     memorized list). `restore` un-shadows them.
#   • a no-secret `.env.disabled` marker is dropped in each repo; #178: it states the backup HONESTLY (a real
#     path only if a backup actually exists — the old marker printed a path even when no backup was made).
#   • if this script dies mid-swap, an EXIT trap rolls back the swaps it already made — never a half state.
#   • on success the swap PERSISTS (so the apps can boot); `restore` is the explicit way back.
#
# ⚠ RUNTIME: macOS /bin/bash is 3.2.57. bash-3.2-safe: NO `declare -A`, no bare empty-array under `set -u`.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"          # testenv/
GH="$(cd "$HERE/../.." && pwd)"                    # ~/ghq/github.com/mojisejr
GUARD="$HERE/scripts/guard.sh"
BK="$HERE/.backups"
BREADCRUMB=".env.disabled"
SHADOW_SUFFIX=".testenv-shadowed"

# repo | template (relative to testenv/) | the dotfile the app loads | framework (next|node)
#   Each app keeps the SAME placed dotfile as before (fe/be→.env, bazi→.env.local) so `restore` stays
#   MIGRATION-SAFE: a stack an OLDER stack.sh set up (which backed up that exact dotfile) restores cleanly.
#   For `next` apps we ALSO shadow every OTHER `.env*` (they load .env.local/.env.development.local FIRST).
APPS='mootech-fe|env/fe.env|.env|next
mootech-be|env/be.env|.env|node
bazi-sft-dataset|env/bazi.env|.env.local|next'

bak_path() { # $1=repo $2=filename → canonical backup path in .backups/
  printf '%s/%s%s.prod.bak' "$BK" "$1" "${2//\//_}"
}

ensure_local_ignore() { # $1=repo dir — keep the marker + shadowed files out of git via LOCAL exclude
  local d="$1" ex="$1/.git/info/exclude"
  [ -d "$d/.git" ] || return 0
  mkdir -p "$d/.git/info"
  grep -qxF "$BREADCRUMB" "$ex" 2>/dev/null || printf '%s\n' "$BREADCRUMB" >> "$ex"
  grep -qxF "*$SHADOW_SUFFIX" "$ex" 2>/dev/null || printf '%s\n' "*$SHADOW_SUFFIX" >> "$ex"
}

write_breadcrumb() { # $1=repo dir $2=bak path — NO-SECRET marker; #178: state the backup HONESTLY
  local dir="$1" bak="$2" backup_line
  if [ -f "$bak" ]; then
    backup_line="#   • real .env backed up (gitignored) at: $bak"
  else
    backup_line="#   • NO backup was made (this repo had no .env to save) — 'restore' leaves the .env as-is."
  fi
  cat > "$dir/$BREADCRUMB" <<EOF
# 🛑 TEST-MODE MARKER — contains NO secrets. Created by mootech-fe/testenv/scripts/stack.sh.
# This repo's real env was moved aside for LOCAL testing:
$backup_line
#   • the active .env now points ONLY at the local test DB (localhost:5433); other .env* were moved to
#     *$SHADOW_SUFFIX so they cannot shadow it.
# Return to normal dev:   bash <mootech-fe>/testenv/scripts/stack.sh restore
EOF
}

# is_committed_template — a `.env*` file Next NEVER loads (committed docs, e.g. .env.example) → must be
# neither shadowed nor guard-scanned. Next loads .env / .env.local / .env.<mode>[.local] only.
is_committed_template() { case "$1" in *.example|*.sample|*.template|*.dist) return 0 ;; *) return 1 ;; esac; }

# inject_oauth (#231 Phase 3) — เติมคีย์ OAuth จริงลง .env ที่เพิ่งวาง เพื่อให้ "สมัครใหม่ด้วยปุ่ม LINE/Google"
# เดินได้เส้นจริงบน local (/v2/login มีแค่ปุ่ม OAuth — ไม่มี email/password ให้กรอก)
#
# 🔴 ทำไมต้อง inject ตอน runtime แทนที่จะใส่ใน env/fe.env
#    env/fe.env เป็นไฟล์ที่ COMMIT เข้า git ⇒ คีย์จริงลงไปที่นั่น = ความลับหลุดถาวร
#    ปลายทาง (<repo>/.env) ถูก .gitignore ⇒ คีย์อยู่แค่บนดิสก์เครื่องนี้ ไม่มีทางถูก commit
#
# ⛔ ALLOWLIST เท่านั้น — ดึงแค่คีย์ผู้ให้บริการ OAuth · ห้ามลาก DATABASE_URL / SUPABASE_* / NEXTAUTH_URL
#    ติดมาเด็ดขาด ไม่งั้นแอปจะเด้งกลับไปชี้ prod แล้ว guard ที่รันทีหลังจะจับได้ (fail-closed) แต่เราต้อง
#    ไม่พึ่ง guard เป็นด่านเดียว — คัดตั้งแต่ต้นทาง
# ไม่มี blob = ไม่ล้ม แค่บอกว่าปุ่ม OAuth จะกดไม่ได้ แล้วให้ใช้ /dev-login แทน (ทางเลือกสำรองใน #229)
OAUTH_BLOB="$HOME/.mumate-prod/fe.env.local"
OAUTH_KEYS='LINE_CLIENT_ID LINE_CLIENT_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET'
inject_oauth() { # $1=dest .env ที่เพิ่งวาง
  local dest="$1" k line n=0
  if [ ! -f "$OAUTH_BLOB" ]; then
    echo "   ⚠ ไม่มี $OAUTH_BLOB → ปุ่ม LINE/Google บน /v2/login จะกดไม่ได้ (ใช้ /dev-login แทน)"
    return 0
  fi
  printf '\n# --- OAuth (เติมโดย stack.sh จาก ~/.mumate-prod · ไม่เคยอยู่ในไฟล์ที่ commit) ---\n' >> "$dest"
  for k in $OAUTH_KEYS; do
    line=$(grep -E "^$k=" "$OAUTH_BLOB" | head -1 || true)
    [ -n "$line" ] || continue
    printf '%s\n' "$line" >> "$dest"; n=$((n+1))
  done
  echo "   🔑 เติมคีย์ OAuth $n ตัวลง .env (ไม่แสดงค่า · ไฟล์นี้ถูก gitignore)"
}

shadow_others() { # $1=dir $2=repo $3=placed_dotfile — #177: move aside every .env* Next loads EXCEPT the
                  # PLACED dotfile (Next loads .env.local/.env.development.local FIRST). Result: only the
                  # placed env is active. Excludes the placed file so restore's dotfile↔backup pairing holds.
  local dir="$1" repo="$2" placed="$3" f base bak
  for f in "$dir"/.env*; do
    [ -f "$f" ] || continue
    base="$(basename "$f")"
    [ "$base" = "$placed" ] && continue
    [ "$base" = "$BREADCRUMB" ] && continue
    case "$base" in *"$SHADOW_SUFFIX") continue ;; esac
    is_committed_template "$base" && continue   # never touch .env.example / .env.sample / … (committed, not loaded)
    bak="$(bak_path "$repo" "$base")"
    [ -f "$bak" ] || cp "$f" "$bak"
    mv "$f" "$f$SHADOW_SUFFIX"
    echo "   🌓 neutralized $repo/$base (moved off the active env set) → $base$SHADOW_SUFFIX"
  done
}

active_envs() { # $1=dir — echo every ACTIVE .env* the app may load, in GLOB order (excludes *.testenv-shadowed,
                # marker, and committed templates like .env.example). Order-INDEPENDENT consumers only (e.g.
                # guard.sh, which fail-closes if ANY file is unsafe). For "which value does the app actually
                # read" use env_load_order — glob order is NOT the framework's load precedence.
  local dir="$1" f base
  for f in "$dir"/.env*; do
    [ -f "$f" ] || continue
    base="$(basename "$f")"
    [ "$base" = "$BREADCRUMB" ] && continue
    case "$base" in *"$SHADOW_SUFFIX") continue ;; esac
    is_committed_template "$base" && continue
    printf '%s\n' "$f"
  done
}

# ANCHOR: status-env-precedence
# Echo the ACTIVE env files in the order the FRAMEWORK actually loads them (HIGHEST precedence FIRST), so a
# "first occurrence of a key wins" read yields the value the app REALLY uses. Glob order is the OPPOSITE of what
# we need: `.env` sorts BEFORE `.env.local` lexicographically, yet Next loads `.env.local` OVER `.env` — so a
# glob-order read (do_status #192 bug) would report a `.env`=localhost residue as 🟢 practice while the app boots
# on a `.env.local`=remote = a false-green in the very tool built to kill false-green.
#   • next: Next.js dev resolution — .env.development.local > .env.local > .env.development > .env
#     (mirrors mode-banner.mjs FILES; NODE_ENV=development is the mode stack.sh boots apps in).
#   • node: NestJS/@nestjs/config default reads .env ONLY (no .env.local) — so we consider .env alone. Applying
#     next's precedence to a node app would misreport a .env.local the runtime never loads.
# Matched by EXACT base name, so a shadowed (*.testenv-shadowed) / marker (.env.disabled) / template
# (.env.example) file is excluded by construction (its name is not in the load list).
env_load_order() { # $1=dir $2=fw → active env files, highest framework-precedence first (one per line)
  local dir="$1" fw="$2" base f
  # Positional params (set --) instead of splitting an unquoted string, so the ordering survives regardless of
  # the caller's IFS/word-split behaviour (bash splits `$order`, zsh would not — this is robust in both).
  case "$fw" in
    next) set -- .env.development.local .env.local .env.development .env ;;
    node) set -- .env ;;
    *)    set -- .env ;;  # unknown framework → the base file only; never invent a precedence we can't verify
  esac
  for base in "$@"; do
    f="$dir/$base"
    [ -f "$f" ] && printf '%s\n' "$f"
  done
}

restore_one() { # $1=repo $2=dotfile — put the real env back, un-shadow, drop the marker (idempotent)
  local repo="$1" dotfile="$2" dir="$GH/$1" bak f
  bak="$(bak_path "$1" "$2")"
  [ -d "$dir" ] || return 0
  if [ -f "$bak" ]; then
    cp "$bak" "$dir/$dotfile"
    echo "   ↩ restored $repo/$dotfile ← .backups/$(basename "$bak")"
  else
    echo "   ⚠ no backup for $repo/$dotfile ($(basename "$bak")) — left as-is"
  fi
  # #177: un-shadow every file we moved aside (the original .env.local etc.)
  for f in "$dir"/.env*"$SHADOW_SUFFIX"; do
    [ -f "$f" ] || continue
    mv "$f" "${f%"$SHADOW_SUFFIX"}"
    echo "     ↩ un-shadowed $repo/$(basename "${f%"$SHADOW_SUFFIX"}")"
  done
  if [ -f "$dir/$BREADCRUMB" ]; then rm -f "$dir/$BREADCRUMB"; echo "     removed $repo/$BREADCRUMB marker"; fi
  return 0
}

do_restore() {
  echo "── restore: return each app's real .env (+ un-shadow) from testenv/.backups/ ──"
  while IFS='|' read -r repo tmplrel dotfile fw; do
    [ -n "$repo" ] || continue
    restore_one "$repo" "$dotfile"
  done <<< "$APPS"
  echo "✅ restore done. (docker/DB left running — stop:  docker compose -f testenv/docker-compose.yml down)"
}

# Layer 3 — classify a DB value by WHERE it points (never echo the value; caller prints only the verdict).
# Topology (ฟีม-confirmed): soxsc = PROD · jgxsj = DEV (paused) · Neon = backup · localhost = practice.
classify_one() {  # $1 = ONE connection value (a URL, or "host ref") → prints: practice|prod|dev|neon|real-unknown|unknown
  local v="$1" tok host
  v=$(printf '%s' "$v" | sed -E 's/[[:space:]]+#.*$//')          # strip trailing "# comment" first
  [ -z "$v" ] && { echo unknown; return; }
  # REMOTE/ref FIRST — so a prod string that merely CONTAINS "localhost" (in a password, a decoy host, or a
  # comment) can never fall to 🟢 practice. These patterns are specific; a false match errs to remote/dev/prod
  # (the SAFE direction), never to green. (ตู๋ #122: the old `*localhost*`-first case was a fail-OPEN.)
  case "$v" in *soxsccdlsycaevusndro*) echo prod; return ;; esac
  case "$v" in *jgxsjhbdhttfoiyvptvy*) echo dev; return ;; esac
  case "$v" in *neon.tech*) echo neon; return ;; esac
  case "$v" in *supabase.co*|*supabase.com*|*.onrender.com*|*render.com*|*.rds.amazonaws.com*) echo real-unknown; return ;; esac
  # practice ONLY if an EXTRACTED host is EXACTLY local (never a substring match) — same discipline as mode-banner
  for tok in $v; do
    host=$(printf '%s' "$tok" | sed -E 's#^[a-zA-Z]+://##; s#\?.*$##; s#^.*@##; s#[:/].*$##')
    case "$host" in localhost|127.0.0.1|host.docker.internal) echo practice; return ;; esac
  done
  echo unknown
}

render_verdict() {  # $1=verdict $2=value(for family extraction) → "icon label"
  local cls="$1" v="$2" fam
  case "$cls" in
    practice)     echo "🟢 สนามซ้อม (localhost)" ;;
    prod)         echo "🔴 ของจริง (PRODUCTION)" ;;
    dev)          echo "🟡 dev (paused project)" ;;
    neon)         echo "🟠 Neon (backup DB)" ;;
    real-unknown) fam=$(printf '%s' "$v" | grep -oiE 'supabase\.(com|co)|neon\.tech|[a-z0-9-]*\.onrender\.com|render\.com|rds\.amazonaws\.com' | head -1); echo "🔴 remote ($fam) — project ไม่รู้จัก" ;;
    *)            echo "⚪ ไม่รู้" ;;
  esac
}

# ANCHOR: status-read-only
do_status() {  # READ-ONLY: reports where each app points, docker, outbound pipe, residue — from REAL state, not markers
  echo "── test-env status (read-only · อ่านจากสถานะจริง ไม่ใช่ marker) ──"
  # 1) where does each app point — from its ACTIVE (non-shadowed) env, not the .env.disabled marker
  while IFS='|' read -r repo tmplrel dotfile fw; do
    [ -n "$repo" ] || continue
    local dir="$GH/$repo" f badge
    [ -d "$dir" ] || { echo "  • $repo → (ไม่พบโฟลเดอร์)"; continue; }
    # Gather each key's value SEPARATELY (first occurrence in FRAMEWORK LOAD ORDER) — NEVER concat across keys,
    # so a word from one key can't decide another (บอง #122 bug 2). Precedence = env_load_order (the file the
    # framework actually loads first), NOT glob order — else a `.env` residue would mask the `.env.local` the
    # app really boots on (#192 false-green). `fw` (next|node) comes from the APPS row.
    local dburl="" appurl="" dbhost="" dbuser="" beurl=""
    for f in $(env_load_order "$dir" "$fw"); do
      # `|| true` + if-blocks: grep returns 1 when a key is absent, which under `set -e` would abort the script
      if [ -z "$dburl" ];  then dburl=$(grep -m1 '^DATABASE_URL='          "$f" 2>/dev/null | cut -d= -f2- || true); fi
      if [ -z "$appurl" ]; then appurl=$(grep -m1 '^APP_DATABASE_URL='     "$f" 2>/dev/null | cut -d= -f2- || true); fi
      if [ -z "$dbhost" ]; then dbhost=$(grep -m1 '^DB_HOST='              "$f" 2>/dev/null | cut -d= -f2- || true); fi
      if [ -z "$dbuser" ]; then dbuser=$(grep -m1 '^DB_USERNAME='          "$f" 2>/dev/null | cut -d= -f2- || true); fi
      if [ -z "$beurl" ];  then beurl=$(grep -m1 '^NEXT_PUBLIC_BACKEND_URL=' "$f" 2>/dev/null | cut -d= -f2- || true); fi
    done
    # Classify each DB CONNECTION on its own (host+ref of the SAME connection = one value). Collect DISTINCT
    # verdicts — if the DB keys disagree, we REPORT the mismatch, never pick the best-looking one.
    local verds="" vd rep=""
    for pair in "url:$dburl" "app:$appurl" "hostref:$dbhost $dbuser"; do
      local kind="${pair%%:*}" val="${pair#*:}"
      case "$kind" in url) [ -n "$dburl" ] || continue ;; app) [ -n "$appurl" ] || continue ;; hostref) [ -n "$dbhost" ] || continue ;; esac
      vd=$(classify_one "$val"); rep="$val"
      case " $verds " in *" $vd "*) : ;; *) verds="${verds:+$verds }$vd" ;; esac
    done
    local ndb; ndb=$(printf '%s' "$verds" | wc -w | tr -d ' ')
    if [ "$ndb" -eq 0 ]; then
      # no DB key → fall back to the backend URL, reported AS backend (never claimed to be the DB)
      if [ -n "$beurl" ]; then badge="⚪ ไม่มี DB · backend → $(render_verdict "$(classify_one "$beurl")" "$beurl")"
      else badge="⚪ ไม่รู้ (ไม่พบทั้ง DB และ backend ใน active env)"; fi
    elif [ "$ndb" -eq 1 ]; then
      badge=$(render_verdict "$verds" "$rep")
    else
      badge="⚠️ ไม่ตรงกัน — คีย์ DB ชี้คนละที่: [$verds] · เช็ค env ให้ตรงก่อนรัน"
    fi
    echo "  • $repo → $badge"
  done <<< "$APPS"
  # 2) docker DB
  local dst; dst=$(docker inspect -f '{{.State.Health.Status}}' mumate_testenv_pg 2>/dev/null || true)
  echo "  • docker DB (mumate_testenv_pg): ${dst:-ไม่ได้รันอยู่}"
  # line-stub (#231) — ไม่ได้รัน = สมัครด้วย LINE จะเด้งกลับ onboarding แบบไม่มีอะไรบอกสาเหตุ ⇒ ต้องเห็นตรงนี้
  if lsof -ti tcp:"${LINE_STUB_PORT:-3200}" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "  • line-stub (:${LINE_STUB_PORT:-3200}): 🟢 รันอยู่"
  else
    echo "  • line-stub (:${LINE_STUB_PORT:-3200}): 🔴 ไม่ได้รัน — สมัครด้วย LINE จะเด้งกลับ (แก้: stack.sh up)"
  fi
  # อายุของ dump — ของเก่าไม่ได้พังทันที แต่ยิ่งเก่ายิ่งห่างจาก schema/ข้อมูล prod วันนี้
  # ⇒ บอกอายุเป็นตัวเลข ไม่ตัดสินแทนคน (ไม่มีเส้น "หมดอายุ" ที่ถูกต้องสำหรับทุกงาน)
  if [ -f "$HERE/dumps/full.sql" ]; then
    local days; days=$(( ( $(date +%s) - $(stat -f %m "$HERE/dumps/full.sql" 2>/dev/null || echo 0) ) / 86400 ))
    echo "  • dump ที่ใช้อยู่: full.sql อายุ $days วัน $( [ "$days" -ge 14 ] && echo '(เก่าแล้ว — พิจารณา dump.sh --with-data ใหม่)' || echo '' )"
  else
    echo "  • dump ที่ใช้อยู่: ❌ ไม่มี — stack.sh up จะหยุดที่ขั้น restore"
  fi
  # 3) outbound pipe (SMS/LINE lives in the BE env) — read the active be env, verdict only
  local beenv="$GH/mootech-be/.env" pipe
  if [ -f "$beenv" ]; then
    # ตรวจ LINE กับ SMS แยกกัน (#231): เดิมรวมเป็น grep เดียว ⇒ ถ้าตัวหนึ่งตันอีกตัวเปิด จะรายงานว่า
    # "ตัน" ทั้งคู่เพราะ pattern แรก match ได้จากตัวที่ตัน — ครึ่งเดียวที่เปิดอยู่หายไปจากสายตา
    local lh sh
    lh=$(grep -iE '^LINE_HOST=' "$beenv" 2>/dev/null | head -1)
    sh=$(grep -iE '^SMS_8X8_HOST=' "$beenv" 2>/dev/null | head -1)
    verdict_host() { # $1=บรรทัด env → คำตัดสินของท่อนั้น
      case "$1" in
        *.invalid*)                      echo "🟢 ตัน" ;;
        *localhost*|*127.0.0.1*)         echo "🟢 stub ในเครื่อง" ;;   # #231: line-stub ปฏิเสธ /message/* เสมอ
        *api.line.me*|*8x8.com*)         echo "🔴 provider จริง" ;;
        '')                              echo "(ไม่ตั้ง)" ;;
        *)                               echo "⚪ ไม่รู้จัก" ;;
      esac
    }
    pipe="LINE=$(verdict_host "$lh") · SMS=$(verdict_host "$sh")"
  else pipe="(ไม่มี be/.env)"; fi
  echo "  • ท่อขาออก BE (SMS/LINE): $pipe"
  # 4) leftover residue (shadow files + markers) across the 3 repos
  local shadows markers
  # `ls A B C | wc -l` ตายใต้ set -euo pipefail เมื่อ "ไม่มีไฟล์เลย" (ls คืน non-zero → pipefail → set -e)
  # ⇒ บรรทัด "เศษค้าง" ข้างล่างเคยพิมพ์ไม่ออก *เฉพาะตอนสะอาด* และ status ออก exit 1 ทั้งที่ทุกอย่างปกติ
  # (พบตอน #231 Phase 1 · repro: `set -euo pipefail; s=$(ls /nope/* 2>/dev/null | wc -l)` → exit 1)
  # `|| true` วางที่ท้าย command substitution จึงกลืนเฉพาะสถานะ ไม่กลืนตัวเลขที่นับได้
  shadows=$(ls "$GH"/mootech-fe/*"$SHADOW_SUFFIX" "$GH"/mootech-be/*"$SHADOW_SUFFIX" "$GH"/bazi-sft-dataset/*"$SHADOW_SUFFIX" 2>/dev/null | wc -l | tr -d ' ' || true)
  markers=0; for r in mootech-fe mootech-be bazi-sft-dataset; do [ -f "$GH/$r/$BREADCRUMB" ] && markers=$((markers+1)); done
  echo "  • เศษค้าง: shadow=$shadows · marker=$markers $( [ "$shadows" = 0 ] && [ "$markers" = 0 ] && echo '(สะอาด)' || echo '(มี test-mode residue — restore เพื่อเก็บกวาด)')"
}

# test hook: `STACK_SOURCE_ONLY=1 source stack.sh` defines the functions and runs NOTHING (for the
# proof-of-teeth test). The env var is never set on a real invocation, so this line is inert in normal use.
if [ "${STACK_SOURCE_ONLY:-}" = "1" ]; then return 0 2>/dev/null || exit 0; fi

# ──────────────────────────── subcommand dispatch ────────────────────────────
case "${1:-up}" in
  restore) do_restore; exit 0 ;;
  status) do_status; exit 0 ;;
  up) ;;
  *) echo "usage: bash scripts/stack.sh [up|restore|status]"; exit 2 ;;
esac

# ──────────────────────────── up: rollback safety ────────────────────────────
SWAPPED=""
STACK_DONE=0
rollback() {
  [ "$STACK_DONE" = "1" ] && return 0
  [ -n "$SWAPPED" ] || return 0
  echo "⚠ stack.sh did not finish — rolling back the env(s) already swapped:"
  while IFS='|' read -r repo dotfile; do
    [ -n "$repo" ] || continue
    restore_one "$repo" "$dotfile"
  done <<< "$SWAPPED"
}
trap rollback EXIT
trap 'exit 130' INT TERM

echo "── 0. dangling test-mode check (warn, never clobber) ──"
while IFS='|' read -r repo tmplrel dotfile fw; do
  [ -n "$repo" ] || continue
  if [ -f "$GH/$repo/$BREADCRUMB" ]; then
    echo "   ⚠ $repo already carries a $BREADCRUMB marker — a previous test-mode wasn't restored."
    echo "     backups are never overwritten. 'stack.sh restore' recovers the real env."
  fi
done <<< "$APPS"

echo "── 1. guard env templates (before) ──"
bash "$GUARD" "$HERE/env/fe.env" "$HERE/env/be.env" "$HERE/env/bazi.env" </dev/null

echo "── 2. postgres:17 (SSL) up ──"
docker compose -f "$HERE/docker-compose.yml" up -d
echo "   waiting for healthy…"
for i in $(seq 1 24); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' mumate_testenv_pg 2>/dev/null || echo none)" = "healthy" ] && break
  sleep 5
done

echo "── 3. restore dump (if present) ──"
RESTORED=""
# 🛡️ fail-CLOSED (พบตอน #231 Phase 1): เดิมเขียน `restore.sh … && RESTORED=full` ซึ่งวาง restore ไว้ใน
# เงื่อนไข ⇒ set -e ไม่สะดุด ⇒ restore ล้ม แต่ stack เดินต่อไป swap env แล้วพิมพ์ "พร้อมบูต" ตามปกติ
# ผลจริงที่เกิด: volume เก่าค้างจาก 2026-07-26 → ทุก CREATE ชน "already exists" → restore abort →
# anonymize ถูกข้าม → คนบูตแอปขึ้นมาเจอข้อมูลเก่า 2 สัปดาห์ โดยไม่มีสัญญาณใดบอก
# ⇒ restore ล้ม = หยุดทันที ห้ามแตะ env ของ repo ใดๆ (env ยังไม่ถูก swap ณ จุดนี้ = ไม่มีอะไรต้องม้วนกลับ)
if [ -f "$HERE/dumps/full.sql" ]; then
  bash "$HERE/scripts/restore.sh" "$HERE/dumps/full.sql" || exit 1
  RESTORED=full
elif [ -f "$HERE/dumps/schema.sql" ]; then
  bash "$HERE/scripts/restore.sh" "$HERE/dumps/schema.sql" || exit 1
  RESTORED=schema
else
  echo "   ⚠ no dump yet — run dump.sh (ฟีม, holds prod cred) then re-run stack.sh"
fi

echo "── 3b. anonymize (scrub PII BEFORE any app can read it — safety, not optional) ──"
if [ -n "$RESTORED" ]; then
  /opt/homebrew/Cellar/postgresql@17/17.6/bin/psql \
    'postgresql://postgres:postgres@localhost:5433/mumate_test?sslmode=require' \
    -v ON_ERROR_STOP=1 -f "$HERE/scripts/anonymize.sql" >/dev/null \
    && echo "   ✅ anonymized" \
    || { echo "   🛑 anonymize FAILED — do NOT boot apps (DB still holds real PII)"; exit 1; }
fi

echo "── 4. swap each app's env (BACKUP real → copy template → ignore-first → shadow others → marker → guard the ACTIVE set) ──"
mkdir -p "$BK"
while IFS='|' read -r repo tmplrel dotfile fw; do
  [ -n "$repo" ] || continue
  tmpl="$HERE/$tmplrel"; dir="$GH/$repo"; dest="$dir/$dotfile"; bak="$(bak_path "$repo" "$dotfile")"
  [ -d "$dir" ] || { echo "   ⚠ $repo not found at $dir — skip"; continue; }
  # back up the REAL dotfile ONCE — never overwrite an existing prod-cred backup with a now-local .env
  if [ -f "$dest" ] && [ ! -f "$bak" ]; then
    cp "$dest" "$bak"; echo "   💾 backed up $repo/$dotfile → testenv/.backups/$(basename "$bak")"
  fi
  cp "$tmpl" "$dest"
  # #231 Phase 3: เฉพาะ fe — เติมคีย์ OAuth จริงจาก ~/.mumate-prod (allowlist) ให้ปุ่ม LINE/Google ใช้ได้
  # วางไว้ก่อน guard ด้านล่างโดยตั้งใจ: guard จะได้สแกนไฟล์ "หลังเติม" ⇒ ถ้าเผลอลาก DB คีย์ติดมา guard จับได้
  [ "$repo" = "mootech-fe" ] && inject_oauth "$dest"
  # #177 follow-up: write the LOCAL exclude patterns (marker + *$SHADOW_SUFFIX) BEFORE shadowing anything, so a
  # prod-secret file renamed to *$SHADOW_SUFFIX is born already-git-ignored. Otherwise there is a window
  # between the rename and the exclude-write where a prod service-role key sits on disk under a
  # git-commitable name — and if the script dies mid-run (guard fail → exit) and the rollback trap also
  # fails to un-shadow, that key is exposed to a commit. Ordering it first closes the window to ZERO.
  ensure_local_ignore "$dir"
  # #177 + PR-B(#184): move aside every OTHER .env* — for EVERY app, not just `next`. A next app loads
  # .env.local BEFORE .env (the original load-order hole). A node/NestJS app (mootech-be) loads ONLY .env,
  # but its prod .env.dev.local / .env.prod.local / .env.local still sit ACTIVE on disk holding prod DB +
  # real provider hosts — and the whole-active-set guard (#177/#184) MUST refuse them. Shadowing removes
  # them from the active set (a real reduction of what's reachable, not a narrower guard) and is
  # defense-in-depth even for a framework that wouldn't load them. ensure_local_ignore ran ABOVE (#119) so
  # each shadowed prod-secret file is born already git-ignored — same window-closed guarantee for the BE dir.
  # ANCHOR: shadow-all-apps-active-set — shadow runs for EVERY app (node incl.), not just next.
  shadow_others "$dir" "$repo" "$dotfile"
  write_breadcrumb "$dir" "$bak"
  SWAPPED="${SWAPPED}${repo}|${dotfile}"$'\n'   # track BEFORE the guard so a guard-fail also rolls this back
  # 🛡️ guard AFTER: scan the WHOLE ACTIVE env set (#177 — a shadow file we missed would fail-closed here).
  # shellcheck disable=SC2046
  bash "$GUARD" $(active_envs "$dir") </dev/null || { echo "   🛑 post-copy guard FAILED for $repo — rolling back"; exit 1; }
  echo "   ✅ $repo/$dotfile ← $(basename "$tmpl") (guarded local; only .env active; marker dropped)"
done <<< "$APPS"

STACK_DONE=1   # success — KEEP the swap so the apps can boot; the rollback trap now no-ops

# ── 5. line-stub — ตัวแทน LINE ที่ BE ต้องใช้ตอนสมัคร (#231) ──
# ทำไม stack.sh ต้องบูตให้เอง ไม่ปล่อยเป็นคำสั่งให้คนไปรันเอง:
#   be.env ชี้ LINE_HOST=http://localhost:3200 ⇒ ถ้าไม่มีใครรัน stub การสมัครจะพังแบบ *เงียบและงง* —
#   ผู้ใช้เห็นแค่ "เข้า home แป๊บนึงแล้วเด้งกลับ onboarding" ไม่มีอะไรบอกว่าเพราะ stub ไม่ได้รัน
#   (ฟีมเจออาการนี้จริงตอน LINE_HOST=.invalid — เสียเวลาไล่ 3 ชั้น log กว่าจะเจอ)
# ⇒ ผูกอายุ stub ไว้กับ stack: `up` บูตให้ · ตัวเดิมที่ค้างอยู่ถูก kill ก่อน (idempotent) · `status` รายงาน
STUB_PORT="${LINE_STUB_PORT:-3200}"
STUB_LOG="$HERE/.line-stub.log"
if lsof -ti tcp:"$STUB_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  kill $(lsof -ti tcp:"$STUB_PORT" -sTCP:LISTEN) 2>/dev/null || true
  sleep 1
fi
nohup node "$HERE/scripts/line-stub.mjs" > "$STUB_LOG" 2>&1 &
sleep 1
if lsof -ti tcp:"$STUB_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "── 5. line-stub ── ✅ ฟังอยู่ที่ :$STUB_PORT (log: testenv/.line-stub.log)"
else
  echo "── 5. line-stub ── 🛑 บูตไม่ขึ้นที่ :$STUB_PORT — การสมัครด้วย LINE จะเด้งกลับ onboarding"
  echo "     ดู $STUB_LOG · รันเองด้วย: node testenv/scripts/line-stub.mjs"
fi

cat <<EOF

── 6. boot the 3 apps (each in its own terminal) ──
  FE    : (cd $GH/mootech-fe && npm run dev)                 # :3000
  BE    : (cd $GH/mootech-be && PORT=4000 npm run start:dev) # :4000
  # bazi runs from a pdf-dev WORKTREE, NOT the main clone (goo 2026-08-05):
  #   (a) man-vs-day's grade enrichment (PR-18/19) lives on pdf-dev, not main — main's route returns no grade
  #   (b) the main clone's HEAD belongs to another agent's work; flipping it would pull the rug (our rule:
  #       never checkout in a worktree someone else may be using). Reversible: git -C $GH/bazi-sft-dataset
  #       worktree remove $GH/bazi-testenv. Create once: worktree add $GH/bazi-testenv pdf-dev && npm install.
  bazi  : (cd $GH/bazi-testenv && npm run dev -- -p 3100)     # :3100  (pdf-dev worktree — see note above)
  DB    : localhost:5433  (mumate_test, SSL self-signed)

🛡️ never point any of these at prod — guard.sh refuses prod hosts (before + after the swap, whole env set).
↩  done testing?  bash scripts/stack.sh restore   (restores every real env, un-shadows, removes the markers)
EOF
