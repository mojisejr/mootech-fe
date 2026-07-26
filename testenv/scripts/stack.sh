#!/usr/bin/env bash
# One command to stand up the test stack SAFELY — or `restore` to undo it. Never touches prod.
#   bash scripts/stack.sh [up]      → guard → docker pg(SSL) → restore+anonymize dump → swap each app's
#                                     .env to LOCAL (backup real one first, drop a marker, guard AFTER)
#   bash scripts/stack.sh restore   → put every app's real .env back from testenv/.backups/, drop markers
#
# Safety model = STRUCTURE, not discipline:
#   • the real .env (may hold PROD cred) is backed up into testenv/.backups/ (gitignored) BEFORE any swap,
#     and NEVER overwritten once it exists — so the prod cred can always be recovered.
#   • a no-secret `.env.disabled` marker is dropped in each repo so a confused human sees they're in
#     test-mode and how to get out (it holds NO cred — putting cred there would recreate the .env.prod.bak
#     leak class; it's kept out of git via each repo's .git/info/exclude, no committed change needed).
#   • if this script dies mid-swap, an EXIT trap rolls back the swaps it already made — never a half state.
#   • on success the swap PERSISTS (so the apps can boot); `restore` is the explicit way back.
#
# ⚠ RUNTIME: macOS /bin/bash is 3.2.57 (`env bash` resolves to it — there is no newer bash here). This
#   script MUST stay bash-3.2-safe: NO `declare -A` (unsupported → "declare: -A: invalid option"), and no
#   bare empty-array expansion under `set -u`. (An earlier `declare -A` version could never run its swap
#   loop under 3.2 — that's why .backups/ was incomplete. Config is a `|`-delimited here-string instead.)
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"          # testenv/
GH="$(cd "$HERE/../.." && pwd)"                    # ~/ghq/github.com/mojisejr
GUARD="$HERE/scripts/guard.sh"
BK="$HERE/.backups"
BREADCRUMB=".env.disabled"

# repo | template (relative to testenv/) | the dotfile the app actually loads
#   BE loads .env (no envFilePath) · FE loads .env · bazi loads .env.local
APPS='mootech-fe|env/fe.env|.env
mootech-be|env/be.env|.env
bazi-sft-dataset|env/bazi.env|.env.local'

bak_path() { # $1=repo $2=dotfile → canonical backup path (full repo name; matches mootech-be.env.prod.bak)
  printf '%s/%s%s.prod.bak' "$BK" "$1" "${2//\//_}"
}

ensure_local_ignore() { # $1=repo dir — keep the marker out of git via LOCAL exclude (all repos, no commit)
  local d="$1" ex="$1/.git/info/exclude"
  [ -d "$d/.git" ] || return 0
  mkdir -p "$d/.git/info"
  grep -qxF "$BREADCRUMB" "$ex" 2>/dev/null || printf '%s\n' "$BREADCRUMB" >> "$ex"
}

write_breadcrumb() { # $1=repo dir $2=bak path — a NO-SECRET marker (never write cred here)
  cat > "$1/$BREADCRUMB" <<EOF
# 🛑 TEST-MODE MARKER — contains NO secrets. Created by mootech-fe/testenv/scripts/stack.sh.
# This repo's real .env (may hold PROD credentials) was moved aside for LOCAL testing:
#   • real .env backed up (gitignored) at: $2
#   • the active .env now points ONLY at the local test DB (localhost:5433).
# Return to normal dev:   bash <mootech-fe>/testenv/scripts/stack.sh restore
# Manual recovery:        cp the .prod.bak above back over the .env, then delete this marker file.
EOF
}

restore_one() { # $1=repo $2=dotfile — put the real .env back, drop the marker (idempotent)
  local repo="$1" dotfile="$2" dir="$GH/$1" bak
  bak="$(bak_path "$1" "$2")"
  [ -d "$dir" ] || return 0
  if [ -f "$bak" ]; then
    cp "$bak" "$dir/$dotfile"
    echo "   ↩ restored $repo/$dotfile ← .backups/$(basename "$bak")"
  else
    echo "   ⚠ no backup found for $repo/$dotfile ($(basename "$bak")) — left as-is"
  fi
  if [ -f "$dir/$BREADCRUMB" ]; then rm -f "$dir/$BREADCRUMB"; echo "     removed $repo/$BREADCRUMB marker"; fi
  return 0
}

do_restore() {
  echo "── restore: return each app's real .env from testenv/.backups/ ──"
  while IFS='|' read -r repo tmplrel dotfile; do
    [ -n "$repo" ] || continue
    restore_one "$repo" "$dotfile"
  done <<< "$APPS"
  echo "✅ restore done. (docker/DB left running — stop it with:  docker compose -f testenv/docker-compose.yml down)"
}

# ──────────────────────────── subcommand dispatch ────────────────────────────
case "${1:-up}" in
  restore) do_restore; exit 0 ;;
  up) ;;
  *) echo "usage: bash scripts/stack.sh [up|restore]"; exit 2 ;;
esac

# ──────────────────────────── up: rollback safety ────────────────────────────
SWAPPED=""          # newline list of "repo|dotfile" swapped this run (string, not array → 3.2-simple)
STACK_DONE=0
rollback() {
  [ "$STACK_DONE" = "1" ] && return 0     # finished OK → keep the swap so apps can boot
  [ -n "$SWAPPED" ] || return 0           # nothing swapped yet → nothing to undo
  echo "⚠ stack.sh did not finish — rolling back the env(s) already swapped (never leave a half state):"
  while IFS='|' read -r repo dotfile; do
    [ -n "$repo" ] || continue
    restore_one "$repo" "$dotfile"
  done <<< "$SWAPPED"
}
trap rollback EXIT
trap 'exit 130' INT TERM

echo "── 0. dangling test-mode check (warn, never clobber) ──"
while IFS='|' read -r repo tmplrel dotfile; do
  [ -n "$repo" ] || continue
  if [ -f "$GH/$repo/$BREADCRUMB" ]; then
    echo "   ⚠ $repo already carries a $BREADCRUMB marker — a previous test-mode wasn't restored."
    echo "     the real .env is safe in testenv/.backups/ (backups are never overwritten). 'stack.sh restore' recovers it."
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
if [ -f "$HERE/dumps/full.sql" ]; then
  bash "$HERE/scripts/restore.sh" "$HERE/dumps/full.sql" && RESTORED=full
elif [ -f "$HERE/dumps/schema.sql" ]; then
  bash "$HERE/scripts/restore.sh" "$HERE/dumps/schema.sql" && RESTORED=schema
else
  echo "   ⚠ no dump yet — run dump.sh (ฟีม, holds prod cred) then re-run stack.sh"
fi

echo "── 3b. anonymize (scrub PII BEFORE any app can read it — safety, not optional) ──"
# Run always after a restore: harmless on a schema-only DB (UPDATE 0), scrubs real PII on a full DB.
# 🛑 the DB holds real customer PII between restore and this step — never boot an app until it's done.
if [ -n "$RESTORED" ]; then
  /opt/homebrew/Cellar/postgresql@17/17.6/bin/psql \
    'postgresql://postgres:postgres@localhost:5433/mumate_test?sslmode=require' \
    -v ON_ERROR_STOP=1 -f "$HERE/scripts/anonymize.sql" >/dev/null \
    && echo "   ✅ anonymized (dob/time/gender/place kept; names/emails/tel/chat → deterministic fakes)" \
    || { echo "   🛑 anonymize FAILED — do NOT boot apps (DB still holds real PII)"; exit 1; }
fi

echo "── 4. swap each app's .env (BACKUP real → drop marker → copy template → guard AFTER) ──"
# Backups go to testenv/.backups/ (gitignored) — NOT ".env.prod.bak" loose in each repo, where it would
# hold PROD cred and is NOT gitignored → committable (goo's earlier leak find). The marker holds NO cred.
mkdir -p "$BK"
while IFS='|' read -r repo tmplrel dotfile; do
  [ -n "$repo" ] || continue
  tmpl="$HERE/$tmplrel"; dir="$GH/$repo"; dest="$dir/$dotfile"; bak="$(bak_path "$repo" "$dotfile")"
  [ -d "$dir" ] || { echo "   ⚠ $repo not found at $dir — skip"; continue; }
  # back up the REAL dotfile ONCE — never overwrite an existing prod-cred backup with a now-local .env
  if [ -f "$dest" ] && [ ! -f "$bak" ]; then
    cp "$dest" "$bak"; echo "   💾 backed up $repo/$dotfile → testenv/.backups/$(basename "$bak")"
  fi
  write_breadcrumb "$dir" "$bak"
  ensure_local_ignore "$dir"
  cp "$tmpl" "$dest"
  SWAPPED="${SWAPPED}${repo}|${dotfile}"$'\n'   # track BEFORE the guard so a guard-fail also rolls this back
  # 🛡️ guard AFTER the copy — the RESULTING dotfile must point local, not prod. </dev/null so it can't eat the loop's here-string.
  bash "$GUARD" "$dest" </dev/null || { echo "   🛑 post-copy guard FAILED for $repo — rolling back"; exit 1; }
  echo "   ✅ $repo/$dotfile ← $(basename "$tmpl") (guarded local; marker $BREADCRUMB dropped)"
done <<< "$APPS"

STACK_DONE=1   # success — KEEP the swap so the apps can boot; the rollback trap now no-ops

cat <<EOF

── 5. boot the 3 apps (each in its own terminal) ──
  FE    : (cd $GH/mootech-fe && npm run dev)                 # :3000
  BE    : (cd $GH/mootech-be && PORT=4000 npm run start:dev) # :4000
  bazi  : (cd $GH/bazi-sft-dataset && npm run dev -- -p 3100) # :3100
  DB    : localhost:5433  (mumate_test, SSL self-signed)

🛡️ never point any of these at prod — guard.sh refuses prod hosts (before + after env swap).
↩  done testing?  bash scripts/stack.sh restore   (puts every real .env back, removes the markers)
EOF
