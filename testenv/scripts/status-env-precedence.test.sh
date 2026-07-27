#!/usr/bin/env bash
# ANCHOR: status-env-precedence — proves `stack.sh status` reads each app's env by the FRAMEWORK's load
# precedence, not glob/lexicographic order. The #192 bug: do_status iterated active_envs (glob order, where
# `.env` sorts before `.env.local`) and took the first occurrence of each key — but Next loads `.env.local`
# OVER `.env`, so a leftover `.env`=localhost would be reported 🟢 practice while the app boots on a
# `.env.local`=remote. A false-green in the very tool built to kill false-green.
# Run: bash testenv/scripts/status-env-precedence.test.sh   (bash 3.2-safe · read-only · uses temp fixtures)
set -uo pipefail
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_SOURCE_ONLY=1 source "$SELF/stack.sh"   # defines functions, runs nothing

pass=0; fail=0
ok(){ pass=$((pass+1)); echo "  ✓ $1"; }
no(){ fail=$((fail+1)); echo "  ✗ $1"; }

# Fixture: a next app carrying a localhost `.env` residue AND a remote `.env.local` — the exact #192 trap.
d="$(mktemp -d)"
printf 'DATABASE_URL=postgresql://localhost:5433/mumate\n'                        > "$d/.env"
printf 'DATABASE_URL=postgresql://db.abcdefgh.supabase.co:5432/postgres\n'        > "$d/.env.local"

# first-occurrence DATABASE_URL over a given ordering (mirrors do_status' inner read exactly)
read_first_db(){ local dir="$1" fw="$2" f v=""; for f in $(env_load_order "$dir" "$fw"); do [ -z "$v" ] && v=$(grep -m1 '^DATABASE_URL=' "$f" 2>/dev/null | cut -d= -f2- || true); done; printf '%s' "$v"; }
read_first_db_glob(){ local dir="$1" f v=""; for f in $(active_envs "$dir"); do [ -z "$v" ] && v=$(grep -m1 '^DATABASE_URL=' "$f" 2>/dev/null | cut -d= -f2- || true); done; printf '%s' "$v"; }

# 1) env_load_order(next) ranks .env.local FIRST (highest precedence), NOT .env
first="$(env_load_order "$d" next | head -1)"
[ "$(basename "$first")" = ".env.local" ] && ok "next: .env.local ranked before .env" || no "next: expected .env.local first, got $(basename "$first")"

# 2) AFTER (precedence): the classified verdict is the REMOTE one the app really loads
v_new="$(classify_one "$(read_first_db "$d" next)")"
[ "$v_new" = "real-unknown" ] && ok "AFTER: classifies remote (real-unknown) — matches what Next loads" || no "AFTER: expected real-unknown, got '$v_new'"

# 3) BEFORE (glob order = the bug): would classify the .env localhost residue as practice = the false-green
v_old="$(classify_one "$(read_first_db_glob "$d")")"
[ "$v_old" = "practice" ] && ok "BEFORE (glob): would mis-report practice — the false-green #192 kills" || no "BEFORE: expected practice(bug repro), got '$v_old'"

# 4) node app (NestJS default) loads .env ONLY — env_load_order must ignore .env.local even when present
v_node="$(classify_one "$(read_first_db "$d" node)")"
[ "$v_node" = "practice" ] && ok "node: reads .env only (ignores .env.local) — practice" || no "node: expected practice, got '$v_node'"
c_node="$(env_load_order "$d" node | wc -l | tr -d ' ')"
[ "$c_node" = "1" ] && ok "node: exactly 1 file considered (.env)" || no "node: expected 1 file, got $c_node"

# 5) shadowed / committed-template files are excluded by construction (exact-base-name match)
printf 'DATABASE_URL=postgresql://db.soxsccdlsycaevusndro.supabase.co:5432/x\n'   > "$d/.env.local.testenv-shadowed"
printf 'DATABASE_URL=postgresql://localhost/example\n'                            > "$d/.env.example"
list="$(env_load_order "$d" next | tr '\n' ' ')"
case "$list" in
  *testenv-shadowed*|*.example*) no "excl: shadowed/template leaked into load order [$list]" ;;
  *) ok "excl: shadowed + template files excluded" ;;
esac

rm -rf "$d"
echo ""
if [ "$fail" -eq 0 ]; then echo "  status-env-precedence: $pass passed"; else echo "  status-env-precedence: $fail FAILED"; exit 1; fi
