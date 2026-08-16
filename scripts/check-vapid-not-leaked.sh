#!/usr/bin/env bash
# #285 · VAPID private key must never reach the client bundle (goo · ตู๋ ด่านคู่).
#
# This gate has TEETH — it answers BOTH questions ตู๋ raised:
#   "ด่านนี้ตรวจได้ไหม"  → (1) no key configured = RED (fail closed). It never passes silently.
#   "ด่านนี้ตรวจเป็นไหม"  → (3) a canary: inject the key into a bundle file → the detector MUST catch it.
#                           Without this, a grep that finds nothing is indistinguishable from a broken
#                           grep — "หาอะไรไม่เจอเลยก็เขียว".
#
# CI sets VAPID_PRIVATE_KEY to a PLACEHOLDER (ci.yml keeps NO real secrets) — the tracer this gate
# greps for. WHAT IT CATCHES: the private-key VALUE reaching a client JS chunk in .next/static —
# hardcoded in client code, carried by a NEXT_PUBLIC_-misprefixed env, or otherwise imported into a
# client bundle. WHAT IT DOES NOT CATCH (and need not, because Next prevents it): a bare
# `process.env.VAPID_PRIVATE_KEY` in client code — Next inlines ONLY NEXT_PUBLIC_* env into the
# browser bundle, so a non-public var becomes `undefined` there and its value never ships. (ตู๋ M1:
# that case is green, correctly.) SCOPE: greps the client bundle (.next/static) only — an SSR-prop
# leak into page HTML is a different check, out of this gate's scope.
# Run: bash scripts/check-vapid-not-leaked.sh
set -euo pipefail

STATIC_DIR="${STATIC_DIR:-.next/static}"

# (1) no key → RED. The check cannot run without a value to search for, so failing closed is the only
# honest answer (single-owner repo, no fork ⇒ a job with no VAPID_PRIVATE_KEY is a misconfig, not a
# fork build). ❌ never "skip" — a skipped check that ticks a 🤖 box is a lying green.
if [ -z "${VAPID_PRIVATE_KEY:-}" ]; then
  echo "❌ VAPID_PRIVATE_KEY not set — the leak gate cannot run. Failing closed."
  exit 1
fi

if [ ! -d "$STATIC_DIR" ]; then
  echo "❌ $STATIC_DIR missing — run 'next build' before this gate."
  exit 1
fi

# (2) the real build must be clean.
if grep -rqF -- "$VAPID_PRIVATE_KEY" "$STATIC_DIR"; then
  echo "❌ LEAK: VAPID private key value found in $STATIC_DIR — a client file references the private env."
  exit 1
fi

# (3) canary — prove the detector actually detects. Inject the value into a bundle-visible file, confirm
# the SAME grep finds it, then remove the canary. If it does NOT find it, the detector has no teeth.
CANARY="$STATIC_DIR/__vapid_leak_canary.js"
cleanup() { rm -f "$CANARY"; }
trap cleanup EXIT
printf 'const __canary = "%s";\n' "$VAPID_PRIVATE_KEY" > "$CANARY"
if ! grep -rqF -- "$VAPID_PRIVATE_KEY" "$STATIC_DIR"; then
  echo "❌ DETECTOR BROKEN: injected canary not found — this grep has no teeth."
  exit 1
fi
cleanup
trap - EXIT

echo "✅ VAPID private key absent from client bundle, and the detector is proven (canary caught)."
