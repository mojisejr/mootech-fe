#!/usr/bin/env bash
# ANCHOR: shadow-ignore-before-shadow — the LOCAL git-exclude for *.testenv-shadowed (and the marker) MUST
# be written BEFORE any prod-secret .env* is renamed to that suffix. Otherwise there is a window where a
# prod service-role key (SUPABASE_REAL_PRODUCTION_SERVICE_ROLE_KEY, RENDER_API_KEY, …) sits on disk under a
# git-COMMITABLE name; if the stack dies mid-run (guard fail → exit) and the rollback trap also fails to
# un-shadow, that key is exposed to a commit. The fix orders ensure_local_ignore FIRST.
#   Mutant: in stack.sh up(), move `ensure_local_ignore "$dir"` back AFTER `shadow_others …` → the
#   structural assertion (Part B) flips → RED. The behavioral window (Part A) is what that guards against.
# Run: bash testenv/scripts/shadow-ignore-order.test.sh   (bash 3.2-safe)
set -uo pipefail
SELF="$(cd "$(dirname "$0")" && pwd)"          # this scripts/ dir — kept separate: sourcing resets stack.sh's own $HERE
STACK_SOURCE_ONLY=1 source "$SELF/stack.sh"   # defines functions, runs nothing
pass=0; fail=0

# ── Part A — behavioral: the window is REAL (shadow-first exposes the secret), the fix closes it ──
# A prod-secret dotfile, exactly the file บอง flagged (be/.env.local carries the service-role key).
mk() { local d; d="$(mktemp -d)"; git -C "$d" init -q; mkdir -p "$d/.backups"
       printf 'SUPABASE_REAL_PRODUCTION_SERVICE_ROLE_KEY=super-secret\n' > "$d/.env.local"; echo "$d"; }
sh=".env.local$SHADOW_SUFFIX"

# A1 — BUGGY order (shadow, THEN ignore): right after the rename the shadowed prod-secret is NOT ignored.
bug="$(mk)"; BK="$bug/.backups"
shadow_others "$bug" "mootech-be" ".env"          # placed dotfile=.env → .env.local gets shadowed
if [ -f "$bug/$sh" ] && ! git -C "$bug" check-ignore -q "$sh"; then
  echo "  ✓ window proven: shadow-first leaves $sh git-COMMITABLE (this is the hole)"; pass=$((pass+1))
else
  echo "  ✗ could not reproduce the window (test setup wrong?)"; fail=1
fi
ensure_local_ignore "$bug"                         # the late ignore — only now safe
git -C "$bug" check-ignore -q "$sh" && { echo "  ✓ …and the late ensure_local_ignore does close it"; pass=$((pass+1)); } || { echo "  ✗ late ignore didn't register"; fail=1; }
rm -rf "$bug"

# A2 — FIXED order (ignore FIRST, then shadow): the file is born already-ignored — zero window.
fix="$(mk)"; BK="$fix/.backups"
ensure_local_ignore "$fix"                         # <-- the fix: pattern registered before any rename
shadow_others "$fix" "mootech-be" ".env"
if [ -f "$fix/$sh" ] && git -C "$fix" check-ignore -q "$sh"; then
  echo "  ✓ fixed order: $sh is git-ignored the instant it exists (safe if the script dies mid-run)"; pass=$((pass+1))
else
  echo "  ✗ EXPOSED under fixed order — $sh not ignored"; fail=1
fi
git -C "$fix" check-ignore -q "$BREADCRUMB" && { echo "  ✓ marker $BREADCRUMB also pre-ignored"; pass=$((pass+1)); } || { echo "  ✗ marker $BREADCRUMB not pre-ignored"; fail=1; }
rm -rf "$fix"

# ── Part B — structural: guard the REAL stack.sh so a future reorder can't silently reopen the window ──
S="$SELF/stack.sh"
il="$(grep -n 'ensure_local_ignore "\$dir"' "$S" | head -1 | cut -d: -f1)"
sl="$(grep -n 'shadow_others "\$dir"' "$S" | head -1 | cut -d: -f1)"
if [ -n "$il" ] && [ -n "$sl" ] && [ "$il" -lt "$sl" ]; then
  echo "  ✓ stack.sh calls ensure_local_ignore (L$il) BEFORE shadow_others (L$sl)"; pass=$((pass+1))
else
  echo "  ✗ ORDER REGRESSED: ensure_local_ignore (L${il:-?}) is not before shadow_others (L${sl:-?})"; fail=1
fi

if [ "$fail" -eq 0 ]; then echo "  shadow-ignore-order: $pass passed"; else echo "  shadow-ignore-order: SOME FAILED"; exit 1; fi
