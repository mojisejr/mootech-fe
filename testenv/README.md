# mumate test-env — local FE + BE + bazi stack, safe-by-default

Boot the 3 apps + a real-shaped local DB and capture any `/v2` page **without ever touching prod** and without
hand-assembling backend URL / bazi URL / passkey / MEMBER_ID. Two design rules run through everything:

- **Safe by default** — you don't have to *remember* you're in test-mode; the tools tell you where you are, and
  a plain `npm run dev` refuses to boot when it can't prove it's local (structure, not discipline).
- **Explicit for the rare prod path** — connecting to real prod is a separate, deliberate command (`prod-run`)
  with typed confirmation and the dangerous-button providers neutralized by default.

Lives in `mootech-fe/testenv/` (next to `harness/`, whose tooling was archived 2026-08-18 — see below).

## Port map
| service | port | notes |
|---|---|---|
| mootech-fe | **3000** | `npm run dev` (prints a mode banner first — see Awareness) |
| mootech-be | **4000** | `PORT=4000 npm run start:dev` (default is 3000 → collides with FE, so forced) |
| bazi | **3100** | `npm run dev -- -p 3100` |
| postgres | **5433** | docker, SSL self-signed, db `mumate_test` |
| line-stub | **3200** | booted BY `stack.sh up` — do not start it by hand (see *Signing up on the arena*) |

## The everyday loop
```
# ── refresh the data (anyone — cred is read from ~/.mumate-prod at run time, never stored) ──
bash scripts/dump.sh --with-data   # → dumps/full.sql (REAL PII until anonymize runs) · omit the flag for schema only
                                   # set PROD_DATABASE_URL yourself to override the vault blob

# ── every session ──
bash scripts/stack.sh up       # guard → docker pg(SSL) → DROP+CREATE db → restore → anonymize → swap each app's
                               #   .env to a LOCAL one (+ inject OAuth keys) → boot line-stub → print boot cmds
# boot the 3 apps it prints. On `npm run dev`, fe prints a mode banner FIRST (Awareness).
bash scripts/stack.sh status   # READ-ONLY: where each app points · docker · line-stub · dump age · pipes · residue
bash scripts/reset-user.sh     # who signed up on this arena (add --yes to delete them → sign up fresh again)
bash scripts/stack.sh restore  # leave test-mode: every real .env back, markers dropped, files un-shadowed
```
> `dumps/`, `.backups/`, `certs/`, `.line-stub.log`, and each real `.env` are gitignored — no prod data or cred
> can be committed. If you pass `PROD_DATABASE_URL` by hand, use `read -rs` so it stays out of shell history.

**`stack.sh up` is idempotent and safe to re-run.** It drops and recreates `mumate_test` before loading, so a
stale docker volume can never survive underneath a fresh dump. If the restore fails, the run **stops there** —
no env is swapped, nothing is left half-done. (Both were real bugs, found the first time the arena was used for
real: the volume from a previous run made every `CREATE` fail with "already exists", the restore aborted
correctly, and the stack then walked on to print "ready to boot" anyway — serving data that was two weeks old.)

## Signing up on the arena — what is real and what is not

`/v2/login` only offers LINE and Google (no email/password), so "sign up as a brand-new user" needs the real
OAuth round trip. Two things make that work locally:

- **OAuth keys** are injected into `<repo>/.env` by `stack.sh up`, read from `~/.mumate-prod/fe.env.local`
  (allowlist: `LINE_*`/`GOOGLE_CLIENT_*` only). They are **never** written into `env/fe.env`, which is committed.
  `NEXTAUTH_URL` is `http://localhost:3000` and that redirect URI is already registered with the providers, so
  the LINE/Google consent screen really opens and really calls back.
- **`line-stub.mjs` (:3200)** stands in for the LINE Messaging API. `mootech-be` calls
  `GET {LINE_HOST}/profile/{userId}` to verify identity before creating a user — and the same host is used by
  `POST /message/multicast`, which `cronjob.service.ts` fires automatically at **06:00 and 09:00** Asia/Bangkok.
  So the stub answers `/profile/*` and **refuses `/message/*` with 403, always**. Pointing `LINE_HOST` at the
  real `api.line.me` would leave only one thing standing between a cron tick and real customers: the fact that
  `user_provider.id_token` happens to be empty after anonymize. That is *data* — it disappears the day someone
  seeds new rows. The stub refuses *structurally*.

Consequences worth knowing before you trust a result:

| | |
|---|---|
| display name / picture from LINE | **stub values**, not the real profile (`ผู้ใช้สนามซ้อม …`) |
| every user restored from prod | **cannot log back in via OAuth** — `anonymize` blanks `user_provider.id_token`, so the BE never matches them and creates a new user instead. Use `/dev-login` to test a returning user. |
| a user who signs up here | gets a real `id_token` → that is exactly how `reset-user.sh` tells arena users apart from restored ones |

## Starting over as a new user
```
bash scripts/reset-user.sh          # lists who signed up here (id_token <> '') — deletes nothing
bash scripts/reset-user.sh --yes    # deletes them across every table that has a user_id column
```
Then clear localhost cookies (or use a private window) and sign up again. The delete is scoped by
`user_provider.id_token <> ''`, and every restored row has it blank — so this **cannot touch prod-derived data**
even if it is run at the wrong moment. Target tables are discovered from `information_schema` at run time, so a
new table with a `user_id` column is swept without editing the script.

## Awareness — the tools say where you are
Safety here is **structural, not memory**. Three layers, each reading the REAL env on disk (never a doc/marker):

- **predev banner** — `mode-banner.mjs`, wired as fe's `predev`, so every `npm run dev` on fe prints a FIRST
  line before boot (`ANCHOR: awareness-mode-banner`):
  - 🟢 **สนามซ้อม (practice)** — `DATABASE_URL` is the local test DB → proceed.
  - 🔴 **ไม่ใช่สนามซ้อม (remote)** — shows the host **family** only (never an env value); it deliberately does
    **not** claim "production" (a supabase host may be prod *or* the paused dev project) → run `stack.sh status`
    for the finer call.
  - ⚪ **unknown / no DATABASE_URL** → **STOP** (exit non-zero → npm aborts `dev`). can't-verify ≠ safe.
- **`stack.sh status`** (read-only) — reads each app's active env in the framework's **load order** (not glob
  order) and reports: where each app's DB points (practice / prod / dev / neon / unknown, and ⚠️ if one app's
  DB keys disagree), docker health, whether the outbound SMS/LINE pipe is blocked, and leftover shadow/marker
  residue. `ANCHOR: status-read-only`.
- **guard.sh** (fail-closed) — refuses the stack if ANY DB target is a prod host; on refuse it teaches how to
  proceed (both the normal `stack.sh up` and the intentional `prod-run` paths).

## Intentional prod access — `prod-run`
For the rare, deliberate "connect to real prod for ONE command" (never as a side effect of a normal boot):
```
node testenv/scripts/prod-run.mjs [--with-providers] <fe|be|bazi> -- <command> [args...]
```
- Injects a real prod env blob from `~/.mumate-prod/` into the child process's **memory only** — it **never
  writes to disk** (no temp / backup / marker).
- **Providers neutralized by default** (SMS/LINE/email/payment → sentinel keys) so an accidental call cannot
  leave the machine; `--with-providers` re-arms them and demands a second, distinct confirmation.
- **Typed confirmation** (you type the app name, never y/Enter) · loud banner (app + which prod DB, no secrets) ·
  **never prints an env value**, even on error · **refuses `build`** (browser vars bake at build time → it would
  fail silently, so it refuses loudly instead).
- `prod-probe.mjs` (read-only) — reports whether the dangerous-button providers are BLOCKED or LIVE (DNS-resolve
  the host for LINE/8x8; check the sentinel key for SendGrid/Omise) **without firing anything** or printing a secret.

## Capture / verify tooling (`harness/archive/` — ARCHIVED 2026-08-18)

> 🔴 **Everything in this section was moved to `harness/archive/` by `mojisejr/mootech-fe#321`** (ฟีม's ruling in
> `mojisejr/mootech-fe#318`: gates live on the machine — `lint`/`test` on pre-push, `build` before Ready for
> review — and nothing self-built runs on GitHub except `secret-scan` + `main-guard`). Nothing runs these files
> anymore: no workflow, no npm script. They are **kept, not deleted** (`git log --follow` traces every one).
> The paths below now read `harness/archive/<file>`, and a file moved back to `harness/` needs its relative
> imports fixed first — see `harness/archive/README.md`. **Do not cite a run of these as evidence.**

- **`capture-route.ts`** — team-standard review capture: dev-login → screenshot a route at 393/360/320. Per
  viewport it saves `full` (whole page) + `vp-top` (first screen, viewport-sized) + `vp-bottom` (the bottom
  screen, when the page is taller than one viewport — where a `fixed bottom-0` overlaps the last content, which
  a fullPage shot misplaces), and prints every `fixed`/`sticky` element (count + box) so an overlap can't hide
  from the eye. Needs the stack booted (FE :3000 · BE :4000 · bazi :3100). `ANCHOR: viewport-shot`.
- **animation freeze** (`freeze-animation.ts`) — before any pixel-COMPARED capture (`pixel-anchor.ts`) the page
  is rendered in its reduced-motion static state (`reducedMotion: 'reduce'` → the page's own guards), so a
  looping animation can't make two frames falsely differ. Deterministic regardless of load timing.
- **BE-unreachable hint** (`backend-hint.ts`, printed by `capture-route`) — if any `/api` request returns 502,
  it says "BE upstream unreachable — run `stack.sh up`; this fallback + red console error are infra, not a UI
  bug." Narrow on purpose: only a **502 on /api** (a 404/500 from a BE that IS up is a different problem, left
  alone). *(Lands with PR #127 — see the note at the bottom.)*

## Why the local postgres serves SSL (do not remove)
All three apps hard-require an SSL connection to the DB (prod is Supabase, SSL-only): `mootech-be
app.module.ts:79` (`ssl:{rejectUnauthorized:false}`), `mootech-fe lib/db/index.ts:11` (`ssl:'require'`), `bazi
src/db/client.ts:28` (`ssl:'require'`) — all verified current. A stock local postgres would crash all three at
boot with "server does not support SSL connections". Fixed at the **infra** layer (no app-code change): the
compose postgres generates a self-signed cert at start and runs `ssl=on`; `rejectUnauthorized:false` /
`ssl:'require'` accept self-signed. Local-only → safe.

## One shared DB (verified)
ฟีม confirmed 1 DB — bazi was merged into Supabase (Neon kept as backup only; `getDatabaseUrl =
APP_DATABASE_URL ?? DATABASE_URL`, prod sets `APP_DATABASE_URL`=Supabase). All three apps point at the one local
db `mumate_test`. **Proof point in `dump.sh`:** it counts bazi-prefixed tables (real dump 2026-07-26 = **~44**;
the exact number doesn't matter, **presence** does — **0 → STOP + report**: prod isn't the merged 1-DB we assume).

## Safety (fail-closed, structure not intent)
- **guard.sh** refuses to boot if any DB target matches a prod host (`supabase.*`/`neon.tech`/`render.com`/…) and
  requires local hosts. Runs **before** boot **and after** the .env swap, scanning the **whole active env set**
  (not just `.env`) — closing the #177 hole where a prod `.env.local` outranked the safe `.env`.
- **shadowing (#177):** `stack.sh up` moves every OTHER `.env*` aside to `*.testenv-shadowed`, so the placed
  local env is the **only active file** the framework can load. (`status` also reads by framework load-order, so
  it reports what the app *actually* loads, not whatever sorts first in the glob.)
- **backups:** `stack.sh` backs up each app's real dotfile → `testenv/.backups/<repo><dotfile>.prod.bak`
  (gitignored) BEFORE overwriting, and **never overwrites an existing backup** — prod cred is always recoverable.
- **`.env.disabled` marker:** a **no-secret** breadcrumb dropped in each swapped repo so a confused human sees
  they're in test-mode + how to leave. Holds no cred on purpose. Kept out of git via each repo's
  `.git/info/exclude` (no committed `.gitignore` change needed in BE/bazi).
- **Interrupted run = no half state:** if `stack.sh` dies mid-swap, an EXIT trap rolls back the swaps it already
  made. On success the swap persists so the apps can boot. **`restore` is the way back**, idempotently.
- **Runtime:** macOS `/bin/bash` is 3.2 (`env bash` resolves to it). `stack.sh` is bash-3.2-safe (no `declare
  -A`, no empty-array-under-`set -u`) and verified end-to-end under it.
- `env/*.env` are committable — dummy externals only, DB points local. `anonymize.sql` scrubs names/emails/phones
  from restored data while keeping dob + birth-time (needed for the fortune compute).

## Manual recovery (if a run was killed and `restore` isn't handy)
Each app's real `.env` is at `testenv/.backups/<repo><dotfile>.prod.bak`. To recover by hand:
```
cp testenv/.backups/mootech-be.env.prod.bak            ~/ghq/github.com/mojisejr/mootech-be/.env
cp testenv/.backups/bazi-sft-dataset.env.local.prod.bak ~/ghq/github.com/mojisejr/bazi-sft-dataset/.env.local
# then un-shadow any *.testenv-shadowed files (rename off the suffix) and delete the marker(s):  rm <repo>/.env.disabled
```
(`mootech-fe` has no backup — its real `.env` was already local, no prod cred to restore.)

## Files
```
docker-compose.yml            postgres:17 · 5433 · named volume · SSL self-signed (generated at start)
env/fe.env be.env bazi.env    committable dummy env; stack.sh copies → each repo's real dotfile
                              NEVER put a real secret here — it is committed. OAuth keys are injected at run time.
scripts/dump.sh               pg17 pg_dump; cred from ~/.mumate-prod (or $PROD_DATABASE_URL), never stored;
                              schema-only default, --with-data for rows; verifies the target is the prod ref; proves bazi tables
scripts/restore.sh            pg17 psql restore of a dump → local pg; DROPs + CREATEs the db first (idempotent)
scripts/anonymize.sql         scrub names/emails/phones from restored data (keep dob + birth-time)
scripts/line-stub.mjs         stand-in LINE API on :3200 — GET /profile/* → 200 · POST /message/* → 403 always
                              booted by stack.sh up; without it, LINE sign-up bounces back to onboarding with no clue why
scripts/reset-user.sh         list/delete users who signed up on the arena (id_token <> ''); prod-derived rows are unreachable by it
scripts/guard.sh              fail-closed prod-host refusal, scans the whole active env set (before + after)
scripts/stack.sh              [up|restore|status] — orchestrate boot / leave / read-only status · shadowing + EXIT-trap rollback · bash-3.2-safe
scripts/mode-banner.mjs       fe predev banner: 🟢 practice / 🔴 remote / ⚪ unknown→STOP (reads the real env)
scripts/prod-run.mjs          intentional prod-for-one-command; no disk write · providers blocked by default · typed confirm · refuses build
scripts/prod-probe.mjs        read-only provider-reachability verdict for prod-run (never fires, never prints a secret)
scripts/*.test.sh             guard.test.sh · shadow-ignore-order.test.sh · status-env-precedence.test.sh (bash, run manually: bash scripts/<name>)
```

## What's NOT covered yet (so nobody assumes it's complete)
- The **predev banner is fe-only** — `mootech-be` and `bazi` have **no** banner wiring (verified: no `predev`
  hook). A direct `cd mootech-be && npm start` does **not** self-warn which DB it points at; for be/bazi the
  awareness is `stack.sh status` (read-only, covers all 3) only. (Adding a be banner needs the BE repo touched →
  ฟีม approval; bazi's is deferred.)
- `stack.sh status` classifies the DB target and the SMS/LINE outbound pipe — it does not probe every external
  integration (SendGrid/Omise etc.); `prod-run` + `prod-probe` cover the provider verdict on the intentional path.
- The bash `*.test.sh` files are run **manually**, not in CI (CI runs `scripts/*.test.ts`).
