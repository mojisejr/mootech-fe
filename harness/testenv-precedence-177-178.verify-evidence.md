# verify-evidence — testenv #177 (env-precedence) + #178 (phantom marker) · goo · PR-A

Script-only (stack.sh/guard.sh), no runtime touched — sandbox-proven under `env bash` 3.2.57 (the real
runtime), never against the live stack μุน is capturing on.

## #177 — env-precedence fail-OPEN (the whole-chain hole)
Root: Next loads `.env.local` / `.env.development.local` BEFORE `.env`. stack.sh placed a local `.env` and
guard scanned only `.env`, but `~/ghq/mootech-fe/.env.local` points PROD (Supabase DATABASE_URL +
onrender NEXT_PUBLIC_BACKEND_URL) → it WINS over the safe `.env` and guard said "safe" while the app read
prod. Fix: (1) after placing `.env`, `shadow_others` moves EVERY other `.env*` aside (backed up →
`*.testenv-shadowed`) using a GLOB (whole-space, not a memorized list), so `.env` is the ONLY active env;
(2) guard scans the WHOLE ACTIVE set; (3) guard now also scans `NEXT_PUBLIC_BACKEND_URL` (a prod backend URL
reaches the prod DB — DB-key-only scanning missed it).

## #178 — phantom-marker
Root: `write_breadcrumb` printed the backup `$bak` path UNCONDITIONALLY, but the cp is conditional — so the
`.env.disabled` marker advertised a backup that was never made. Fix: `test -f "$bak"` — the marker states a
real path only if the backup exists, else "NO backup was made".

## proof-of-teeth (sandbox, run LIVE under bash 3.2, neg-control-first)
- **ANCHOR** `testenv/scripts/guard.test.sh#guard-fail-closed` — 12/12 (adds the #177 `NEXT_PUBLIC_BACKEND_URL`
  file-scan: prod onrender refused, local allowed). Mutant (drop a PROD_PATTERN or local requirement) → RED.
- **#177 whole run (fake GH tree, bash 3.2):** `up` on mootech-fe (next) with prod `.env` + prod `.env.local`
  + prod `.env.development.local` → both shadowed → only local `.env` active → guard-active PASS; be (node) no
  shadow; bazi (next, NO `.env`, only prod `.env.local`) → local `.env` placed + `.env.local` shadowed. All 5
  backups saved. `restore` → un-shadows (`.env.local`/`.env.development.local` back) + restores prod `.env` +
  removes marker.
- **#177 mutant (neg-control):** DISABLE `shadow_others` → the prod `.env.local`/`.env.development.local` stay
  ACTIVE → the guard-active-set scan REFUSES them (neon.tech / supabase / onrender) → post-copy guard FAILED →
  rollback. So the fix genuinely closes the fail-open (without shadowing, guard catches the shadowing prod file).
- **#178 (same run):** bazi had no `.env` → no backup made → the marker reads **"NO backup was made"** (honest),
  not a phantom `.prod.bak` path.
- bash-3.2-safe (no `declare -A`, glob loops guarded); `env bash -n` parses stack.sh + guard.sh.
- NOT run against the live ~/ghq clones (μุน is capturing) — the sandbox exercises the identical scripts;
  the live full round is the pre-merge gate for PR-B's window (with #183/#184), not PR-A.

## adversary sign-off
**Pending ตู๋ (too).** Lens ask: `shadow_others` glob is complete (catches any `.env*` variant, not a list) ·
`restore` un-shadows every `*.testenv-shadowed` · the honest-marker `test -f` · guard scanning the active set
(excludes `*.testenv-shadowed` so it doesn't re-flag the neutralized prod files) · the NEXT_PUBLIC_BACKEND_URL
addition. (Cosmetic, noted: the PROD-pattern branch prints host "https" for a URL — refusal is correct, label only.)

ANCHOR: testenv/scripts/guard.test.sh#guard-fail-closed
