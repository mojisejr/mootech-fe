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
# local — must be allowed
allow 'postgresql://postgres:postgres@localhost:5433/mumate_test'
allow 'postgresql://postgres:postgres@127.0.0.1:5433/mumate_test'

if [ "$fail" -eq 0 ]; then echo "  guard-fail-closed: $pass passed"; else echo "  guard-fail-closed: SOME FAILED"; exit 1; fi
