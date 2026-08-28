#!/usr/bin/env bash
# #432 · the v2 Omise PUBLIC key must actually REACH the browser bundle.
#
# WHY A BUILD-TIME GATE AND NOT ONLY A UNIT TEST: scripts/public-env-inlinable.test.ts proves the SHAPE is
# inlinable (no NEXT_PUBLIC_* read through a subscript). It cannot prove the VALUE arrived — that depends
# on the build actually having the env set. Both failures look identical from the browser: the key is
# undefined and every card payment dies before a request leaves the page. This gate answers the second
# half, on the real artifact.
#
# TEETH — the two questions ตู๋ asks of any gate:
#   "ตรวจได้ไหม"  → (1) no key configured = RED. It never passes silently.
#   "ตรวจเป็นไหม" → (2) a canary: plant the value in a temp chunk and the detector MUST find it. A grep
#                     over a directory that moved returns 0 and reads exactly like a clean pass.
#
# 🔴 NO PLACEHOLDER FALLBACK, unlike the VAPID gate next to it — the two gates ask OPPOSITE questions.
# VAPID asks "is this value ABSENT from the bundle?", so a placeholder is a safe stand-in: it is absent,
# and the check still exercises itself. This gate asks "is this value PRESENT?" — a placeholder is never
# present, so wiring one in would make the check fail with the wrong reason: it would say "the shape is
# not inlinable" when the truth is "nobody set the key". A gate whose red message names the wrong cause
# sends the next person hunting the wrong bug, which is the exact disease .env.example was written for.
# Run: bash scripts/check-omise-key-inlined.sh
set -euo pipefail

STATIC_DIR="${STATIC_DIR:-.next/static}"
VAR=NEXT_PUBLIC_OMISE_KEY_V2
KEY="${NEXT_PUBLIC_OMISE_KEY_V2:-}"

# ── where this gate is BINDING, and where it is not ────────────────────────────────────────────────
# ฟีมเคาะ 2026-08-25: the team does NOT test /v2 on Vercel Preview. /v2 is passkey-gated (V2_PREVIEW_KEY),
# so the team checks it straight on production behind that gate. Preview therefore has no v2 Omise key on
# purpose — and a gate that reddens over a key nobody intends to set there is a false alarm that would
# turn every teammate's PR red for a condition none of them can fix or should.
#
# 🔴 IT SKIPS, BUT IT SAYS SO — LOUDLY. A silent skip is the failure this whole family of gates exists to
# prevent: "not checked" and "checked and clean" must never print the same thing. The line below is the
# only place this gate is allowed to pass without looking, and it names the reason every single time.
#
# 🔑 THE SKIP IS CONDITIONED ON *BOTH* — ตู๋ 2026-08-25, PR #433 round 2.
# The first version keyed the skip on VERCEL_ENV alone. That let through the one case where this gate has
# everything it needs and still refuses to look: preview + key IS set + value NOT in the bundle. The real
# condition for skipping is "there is nothing to check"; VERCEL_ENV=preview is merely today's most common
# CAUSE of that condition. Watching the cause instead of the condition is the exact shape of pin ⑤ in
# scripts/env-example-drift.test.ts that ตู๋ caught in #425 — a guard that watches one spelling of what it
# fears. So: skip only when preview AND the key is genuinely absent.
#
# 📌 ORDERING IS DELIBERATE: this test runs BEFORE the whitespace trim below, so it reads the RAW value.
# preview + key=" " therefore does NOT skip — it falls through and reddens. That is the answer we want:
# Preview is supposed to have NO key at all, so a key made of spaces means somebody DID set one and it
# came out wrong. Trimming first would turn that into a silent skip — a real mistake made invisible by
# the very branch that exists to tolerate an intentional absence. Verified: preview+" " → rc=1.
if [ "${VERCEL_ENV:-}" = "preview" ] && [ -z "$KEY" ]; then
  echo "⏭️  $VAR gate SKIPPED — VERCEL_ENV=preview."
  echo "   NOT CHECKED (≠ checked and clean). The team tests /v2 on production behind V2_PREVIEW_KEY,"
  echo "   so Preview deliberately has no v2 Omise key (ฟีมเคาะ 2026-08-25). Production builds are binding."
  exit 0
fi

# ── the second place there is nothing to check: a developer's own machine ──────────────────────────
# mootech-fe#482. `npm run build` was red for EVERY teammate, because no file that Next loads is checked
# in: .gitignore:29 ignores .env, :30 ignores .env*.local, and :32 keeps only .env.example — which Next
# never reads. So a fresh clone cannot satisfy this gate no matter how carefully anyone follows a README,
# and the rule "build green before pressing Ready for review" was unsatisfiable rather than merely unmet.
#
# 🔴 THE QUESTION THIS GATE ASKS IS A DEPLOY QUESTION: "did the key reach the bundle the USER downloads?"
# A developer building locally to catch a type error is not shipping that bundle to anyone. Demanding a
# payment credential from them answers nothing and teaches the whole team to ignore a red postbuild —
# which is how the VAPID gate beside it would die too.
#
# 🔴 THE CONDITION IS DELIBERATELY NARROW, and narrow in the direction that costs us if it is wrong.
# Skipping too widely re-creates mootech-fe#432 exactly: a deploy whose key was never set, a gate that
# stayed green, and every card payment on /v2 throwing OmiseKeyMissingError before a request leaves the
# browser. So the skip requires ALL THREE — not on Vercel, not in CI, and no key present:
#   VERCEL is set on every Vercel build (all environments); CI is set by GitHub Actions and every other
#   runner we might add. Either one present means somebody is building something that gets shipped or
#   gated, and this gate stays binding.
#
# 🔑 WATCHING THE CONDITION, NOT ONE CAUSE OF IT — same lesson ตู๋ drew for the preview branch above in
# PR #433 round 2, and the same shape as pin ⑤ in scripts/env-example-drift.test.ts. The condition is
# "nobody will download this bundle"; being off Vercel is one cause of that, being outside CI is another.
# Keying on a single spelling of it is what lets the real case through.
#
# 📌 ORDERING: this sits AFTER the preview branch and BEFORE the trim, for the same reason that one does.
# A key of pure whitespace is somebody's mistake, not an absence, and it must not be skipped into silence.
if [ -z "${VERCEL:-}" ] && [ -z "${CI:-}" ] && [ -z "$KEY" ]; then
  echo "⏭️  $VAR gate SKIPPED — local build, no key set."
  echo "   NOT CHECKED (≠ checked and clean). This gate asks whether the key reached the bundle the USER"
  echo "   downloads, which is a deploy question; a local build ships to nobody. Vercel and CI builds are"
  echo "   binding and this branch cannot be reached there. (mootech-fe#482)"
  echo "   To exercise the v2 card lane locally, put a TEST public key in .env.local:"
  echo "     $VAR=pkey_test_...   ← Omise Dashboard → Settings → Keys → Public key, in TEST mode"
  echo "   Ask Feem if you do not have dashboard access. Never use the live key here, and never commit one."
  exit 0
fi

# (0) the value must be SEARCHABLE before it is searched for — ตู๋ 2026-08-25, PR #433 round 3.
# `grep -F` matches a SUBSTRING, so a one-character or whitespace key is "found" in almost any bundle and
# this gate goes green over a key Omise will reject. That is the SAME outcome #432 was opened for: gate
# green, env set, payment impossible. The realistic way in is a trailing space pasted into the Vercel UI.
#
# 🔑 WHY LENGTH AND NOT A `pkey_` PREFIX: a prefix check ties this gate to Omise's current key format, so
# the day the vendor changes it the gate reddens with the wrong reason — the misdirection disease that
# .env.example was written against. Length says the only thing we actually need: a real credential cannot
# be short enough for grep to hit it by accident. 12 is deliberately far below any real key.
KEY=$(printf '%s' "$KEY" | tr -d '[:space:]')
if [ -n "$KEY" ] && [ "${#KEY}" -lt 12 ]; then
  echo "❌ $VAR is set but is only ${#KEY} character(s) after trimming whitespace."
  echo "   Too short to be a real key — and short enough that grep would 'find' it in any bundle,"
  echo "   so this gate would go GREEN over a key Omise rejects. Refusing to answer. (mootech-fe#433)"
  exit 1
fi

# (1) fail closed. A build without the key produces a bundle that cannot take a payment; shipping it
# quietly is the exact outcome #432 was opened for.
if [ -z "$KEY" ]; then
  echo "❌ $VAR is not set at build time — the /v2 card screen would ship with no key."
  echo "   Set it (Vercel → Environment Variables, or your .env for a local build) and rebuild."
  exit 1
fi

if [ ! -d "$STATIC_DIR" ]; then
  echo "❌ $STATIC_DIR not found — run this AFTER 'next build' (it is wired as postbuild)."
  exit 1
fi

# (2) canary FIRST: prove the detector can see a value in this tree before trusting what it says about
# the real one. Without it, "found" and "looked in the wrong place" are the same output.
CANARY_FILE="$STATIC_DIR/.omise-canary-$$.js"
CANARY_VALUE="pkey_test_CANARY_$$"
printf 'var _canary="%s";\n' "$CANARY_VALUE" > "$CANARY_FILE"
trap 'rm -f "$CANARY_FILE"' EXIT
if ! grep -rqF "$CANARY_VALUE" "$STATIC_DIR"; then
  echo "❌ canary NOT found in $STATIC_DIR — this gate cannot see values in the bundle, so its verdict"
  echo "   about $VAR would be meaningless. Fix the gate (path? grep?) before trusting a green."
  exit 1
fi
rm -f "$CANARY_FILE"; trap - EXIT

# (3) the real question.
if grep -rqF "$KEY" "$STATIC_DIR"; then
  HITS=$(grep -rlF "$KEY" "$STATIC_DIR" | wc -l | tr -d ' ')
  echo "✅ $VAR reached the client bundle ($HITS file(s)), and the detector is proven (canary caught)."
  exit 0
fi

cat <<MSG
❌ $VAR is SET at build time but its VALUE is absent from $STATIC_DIR.
   That means the source reads it in a shape the bundler cannot substitute — an alias
   (env[NAME_CONST]) instead of a literal process.env.$VAR. The browser will get undefined and every
   card payment on /v2 will throw OmiseKeyMissingError before a request leaves the page.
   This is mootech-fe#432. Read it in features/v2-shop/omise-token.ts.
MSG
exit 1
