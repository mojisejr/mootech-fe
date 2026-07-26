# verify-evidence — test-env local stack (goo)

## capability → gates fired
Infra to boot FE+BE+bazi on a local DB for agent capture, with a hard boundary against prod. Fires:
fail-closed guard (the safety invariant), PII/cred leak-surface closure, filesystem side-effect fencing.

## proof-of-teeth
- **guard fail-closed — ANCHOR** `testenv/scripts/guard.test.sh#guard-fail-closed`: 8 cases — every prod
  host (supabase.co/.com, neon.tech, pooler.supabase, onrender.com, rds.amazonaws.com) REFUSED, a
  non-local non-prod-fingerprinted host (`some-random-host.example.com`) ALSO refused (open-by-default is
  the danger), local (localhost/127.0.0.1) ALLOWED. 8/8.
- **mutant (the meaningful one):** the guard is defense-in-depth — dropping a prod pattern doesn't open it
  (the default-deny still catches non-local). So teeth are proven on the DEFAULT-DENY: making
  LOCAL_PATTERNS match everything (open-by-default) → `some-random-host` ALLOWED → anchor RED; revert → 8/8.
- **guard runs before AND after the .env swap** (stack.sh) — the swap overwrites the real `.env` (prod
  cred), so the RESULT is re-verified local, not just the template.
- **PII/cred leak surfaces closed (3, none caught by gitleaks — it hunts keys not birthdates/backups):**
  (1) `dumps/` gitignored + `dump.sh` refuses to write unless `git check-ignore` confirms it (fail-closed,
  not a trusted line) — Phase-2 full.sql = 135 tables of real customer data; (2) README uses `read -rs`
  so the prod URL never enters shell history; (3) stack.sh backs the prod-cred `.env` up into
  `testenv/.backups/` (gitignored) — NOT `.env.prod.bak` loose in each repo (verified NOT ignored in
  mootech-be/mootech-fe → would be committable).
- **SSL is necessary for the whole stack (verified):** BE `app.module.ts:79` (unconditional) + FE
  `lib/db/index.ts:11` + bazi `src/db/client.ts:28` all require SSL → the compose postgres serves a
  self-signed cert; no app-code change. `docker compose config` valid; env scanned — no real secrets.

## NOT claimed (Phase-1 run, needs actual boot)
The 3 apps BOOTING against the local SSL postgres is NOT yet verified (needs the dump + `stack.sh` run):
BE's SSL handshake against the self-signed cert, bazi storage-client init, FE NextAuth. Flagged in-file.
ฟีม runs `dump.sh` (holds prod cred); goo drives the boot after — 🛑 if BE fails with correct env, STOP + report (no BE code change).

## anonymize completeness (บอง's whole-DB verify — the false-green that hid)
Phase 2 anonymize first "passed" my golden C, but the counter-proof only checked the tables in my OWN
list → it proved what I did was done, NOT that I did it completely. บอง swept the whole DB and found
`use_provider` (empty) got the UPDATE while `user_provider` (5385 real OAuth rows: emails, names, JWT
`id_token`) was never touched — a `to_regclass` guard passed on the empty table, UPDATE 0 rows, silent
success. Fixes: (1) anonymize `user_provider` (name/email/picture_url/id_token); (2) a **self-verify
DO-block inside the tx before COMMIT** that sweeps EVERY email column in information_schema and RAISEs
+ rolls back if any non-@test.local address survives — teeth proven (inject 1 real email → "anonymize
INCOMPLETE: 1 real emails remain", rollback). Re-verified WHOLE-DB: 0 real emails in any column;
dob invariant still 3988/518/2872. Lesson: verify against the whole DB, never your own list.

## adversary sign-off
**too (static/security/AST/D2) — SIGNED** (checked out the branch, ran guard.test.sh 8/8, security scan):
approved the fail-closed default-deny, the git-check-ignore dump guard, the .backups/ move, atomic
anonymize (BEGIN/COMMIT + ON_ERROR_STOP), and confirmed dev-login is safe (NODE_ENV gate + anonymized DB).
too's adversarial find: `LOCAL_PATTERNS='@?...'` allowed "localhost" inside a PASSWORD of a remote URL to
match as local. FIXED: guard now extracts the real host (after the last @) and requires it be local —
too's bypass URL is refused; anchor extended to 10 cases (incl `localhost.evil.com` + the password
injection). Non-blocking chore for Phase 3 (too): swap the human nicknames in dev-login SAMPLE_USERS for
`Dev User N (uuid8)` labels. NOTE: too's approval predated บอง's user_provider find — the anonymize
completeness fix above lands after it; the guard/structure too reviewed is unchanged + strengthened.

## Phase 3b — .env structural close (option ข) + bash-3.2 runtime fix (goo, ฟีม's pick via บอง)
The gap บอง flagged: safety depended on *running via stack.sh* (discipline), not structure. Verified 3
facts first (not guessed): (a) the `~/ghq` clones post-swap already point localhost = already safe; (b)
the real prod-hit risk is the `opilot` clone — but it's a **different GitHub repo** (`jaroensakyod/mootech-be`)
in elder **o**'s workspace, so a BE prestart guard (option ก) can't reach it and neutralizing it (option C)
needs ฟีม's call (charter: we don't touch o's repos); (c) `.env.disabled` is **not gitignored** in any of
the 3 repos → moving prod cred there would recreate the `.env.prod.bak` leak class. So option ข ships as:
- **no-secret `.env.disabled` marker** in each repo (breadcrumb only; cred stays in `testenv/.backups/`),
  kept out of git via each repo's `.git/info/exclude` (no committed change to BE/bazi) + mootech-fe's
  committed `.gitignore`.
- **`stack.sh restore`** subcommand + an **EXIT-trap rollback** so an interrupted run never leaves a half
  state (real `.env` back, markers removed); on success the swap persists so apps can boot.
- **dangling-marker check** at start: warns (never clobbers) if a prior test-mode wasn't restored; backups
  are never overwritten once they exist.
- **bash-3.2 fix (latent bug found via verify-real-path):** `env bash` = 3.2.57 (no newer bash present),
  but the old `stack.sh` used `declare -A` (unsupported on 3.2 → the swap loop could never run — corroborated
  by an incomplete `.backups/` and a mis-named bazi backup). Rewrote config as a `|`-delimited here-string.

**proof-of-teeth (sandbox, run live under `env bash` 3.2, neg-control included):** a fake GH tree (3 git
repos with prod-shaped dotfiles) + stubbed docker/psql + the REAL guard.sh. (1) `up` → all 3 dotfiles →
local, markers dropped **with no cred**, `.git/info/exclude` updated, all 3 real prod backups preserved,
guard-after passes. (2) `restore` → all 3 real prod dotfiles back, markers removed. (3) **mid-swap failure**
(bazi dotfile chmod 000 after fe+be swapped) → EXIT trap ROLLS BACK fe+be to prod, markers gone, exit 1 —
**no half state**, and the real bazi backup was NOT overwritten with garbage. (4) leftover marker → dangling
warn fires. All four under bash 3.2.57. NOT claimed: this was NOT re-run against the live `~/ghq` clones
(they're already in a working local state) — the live run is deferred; the sandbox exercises the identical code.

ANCHOR: testenv/scripts/guard.test.sh#guard-fail-closed

ANCHOR: testenv/scripts/guard.test.sh#guard-fail-closed
