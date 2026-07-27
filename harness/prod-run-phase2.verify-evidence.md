# verify-evidence — prod-run (local-safe-by-default Phase 2) · goo

New tooling only: `testenv/scripts/prod-run.mjs` + `testenv/scripts/prod-probe.mjs` (node built-ins only — run
without `npm ci`). **No app code touched.** Prod contact was **read-only `select 1`** only; no otp/register/
payment ever fired; no UPDATE/DELETE; no app booted full; env rest-state untouched; snapshot intact.

## what prod-run does
Injects a REAL prod env blob from `~/.mumate-prod/` into ONE spawned command and vanishes — connecting to prod
gets the lifetime of a command, not the machine's rest-state (kills the "switch in and forget to switch back"
trap). Connect-real ≠ fire-real: dangerous-button providers are neutralized by default.

## 🔴 UNVERIFIED app→file mapping (read this — it's guarded, not guessed)
The 6 vaulted blobs point at **different projects**. Ref `jgxsjhbdhttfoiyvptvy` is a **DEAD tenant** (Supavisor
"tenant/user not found" — confirmed by BOTH `psql` and the app's own `postgres.js`) yet appears in `be.env`,
`be.env.dev.local`, `fe.env.local`; only `be.env.prod.local`'s ref `soxsccdlsycaevusndro` authenticates. So
prod-run's current alias map (`be`→be.env, `fe`→fe.env.local) points at the **dead** ref. It is **left honestly
unverified — not remapped to a guess** (fix #2, deferred to ฟีม, because the dead ref means we don't yet know
the true prod file per app; `fe` has no `.prod.local` at all; `bazi`→Neon + carries a 3rd project ref, untested
by design). The **pre-flight below is what makes the wrong mapping safe** — a mismapped run fails LOUD, not
silent, so shipping it now is merely inconvenient, never dangerous.

## proof-of-teeth (real machine, neg-control-first, read-only)
- **pre-flight fail-LOUD (the core of this PR)** `ANCHOR testenv/scripts/prod-run.mjs#preflight-fail-loud`:
  `prod-run be` AND `prod-run fe` (both mapped to the dead ref) → after confirmation, the read-only pre-flight
  gets **tenant-not-found** → **REFUSES** with a human why/means/do message and the command **NEVER runs**
  (`exit 5`; probe printed no `COMMAND-RAN`). This is ตู๋'s lens #5 closed *inside the tool*: a dead/mismapped
  blob can no longer fail silently deep in the app.
- **pre-flight pass verdict**: the same check returns `ok` for the LIVE ref (`be.env.prod.local` / `soxsc`) —
  `psql select 1` → `status 0, out "1"`, the *same* verdict the app's `postgres.js` gives (`ok=1`). So the
  instrument is not blind: it passes live and refuses dead. (End-to-end pass→spawn against a real app awaits
  fix #2's mapping; `spawn` itself is exercised by the neg-control runs below, where the command DID run before
  the pre-flight existed.)
- **#1 done-condition (env reaches real prod, read-only)**: `select 1 → ok=1` against `soxsc` via the app's
  real `postgres.js` client — the injected env connects to a real prod DB and reads. (be.env/fe.env.local both
  reach Supavisor too — it echoes their real project-ref back as "tenant not found" — proving injection lands,
  the ref is just dead.)
- **#2 typed confirmation (neg-control)**: wrong word → `not confirmed`, `exit 2`, nothing ran; empty (Enter) →
  same. Only typing the exact app name proceeds. `--with-providers` demands a SECOND distinct `SEND-REAL`.
- **#3 providers blocked by default, provable**: default → `prod-probe` DNS verdict `LINE_HOST`/`SMS_8X8_HOST`
  = **BLOCKED (ENOTFOUND)**, SendGrid/Omise keys = neutralized sentinel; `--with-providers` → **LIVE (resolves)**.
  Difference shown, not asserted.
- **#4 build refused**: `prod-run be -- npm run build` → refused (`exit 3`) with a human reason (NEXT_PUBLIC bakes
  at build; runtime injection would ship wrong browser values and fail silently), before any confirm/run.
- **#5 zero disk writes**: file census before/after a full run — `~/.mumate-prod` listing sha unchanged,
  `$TMPDIR` entry count unchanged, `find`-since-marker = none. Env is injected into the child's memory via
  `spawn({env})`; no temp/backup/marker file exists at any point.
- **#6 git clean + no value leak**: all 3 repos show only baseline dirt (pre-existing images/breadcrumb), no new
  files from prod-run; the banner prints only the DB *family* (`supabase.com`), never a raw env value; pre-flight
  categorizes stderr (tenant-not-found / auth-failed / connect-failed) and never echoes it (it holds the
  username).

## adversary sign-off
**goo self-adversarial:**
- *"Would the pre-flight false-refuse a valid prod-run?"* → No — verified the psql instrument returns `ok` for
  the live `soxsc` ref (agrees with the app's postgres.js). It refuses only on real failure.
- *"Is psql a hidden hard dependency?"* → No — if psql is absent the pre-flight WARNS + proceeds (unverified),
  never hard-blocks on a missing tool; the inject+spawn core is node-built-ins only.
- *"Does the banner/pre-flight leak secrets?"* → Banner prints only the provider *family*; pre-flight prints a
  category, never the stderr (which carries the username) and never the password.
- *"Could a `build` slip through?"* → `\bbuild\b` on the joined command errs toward refusing (per ฟีม/บอง:
  refuse > half-support). A path like `rebuild` won't match (word boundary), a real `next build`/`npm run build`
  does.
- Residual/limits (stated, not hidden): the app→file mapping is **unverified** (fix #2, ฟีม); end-to-end
  pass→spawn against a live-mapped app is not shown here (no app currently maps to a live ref) — proven at the
  component level instead; `bazi`/Neon + the 3rd project ref were **not** probed (บอง's call — risk-picture goes
  to ฟีม first).

**Pending ตู๋ (too)** — full runtime review (บอง reviews first, then ตู๋).

ANCHOR: testenv/scripts/prod-run.mjs#preflight-fail-loud
