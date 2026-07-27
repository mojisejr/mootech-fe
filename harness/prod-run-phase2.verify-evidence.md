# verify-evidence — prod-run (local-safe-by-default Phase 2) · goo

New tooling only: `testenv/scripts/prod-run.mjs` + `testenv/scripts/prod-probe.mjs` (node built-ins only — run
without `npm ci`). **No app code touched.** Prod contact was **one read-only `select 1`** (ฟีม-authorized, now
capped); no otp/register/payment ever fired; no UPDATE/DELETE; no app booted full; env rest-state untouched.

## Project topology (ฟีม-confirmed 2026-07-27; declared in the vault file headers since 2026-06-19)
```
soxsccdlsycaevusndro = PROD (real)          — the two files holding real prod keys: be.env.prod.local + be.env.local
jgxsjhbdhttfoiyvptvy = DEV (de-prod'd 06-19, now paused → "tenant not found")
Neon                 = backup DB            — fine to point at (ฟีม); do not probe
```
We (goo + บอง) first mis-read jgxsj as "dead prod"; it is **DEV**. The mapping below reflects the corrected truth.

## what prod-run does
Injects a REAL prod env blob from `~/.mumate-prod/` into ONE spawned command, then vanishes — connecting to
prod lasts a *command*, not the machine's rest-state. **No file is ever written to disk** (env lives only in
the child). **Connect-real ≠ fire-real**: dangerous-button providers neutralized by default; `--with-providers`
re-arms them behind a second confirmation.

## app → blob mapping (VERIFIED with ฟีม)
- `be` → **be.env.prod.local** (PROD / soxsc — ฟีม-confirmed; read-only `select 1` → 1 proven, the one allowed hit).
- `bazi` → bazi.env.local (Neon backup — fine per ฟีม; not probed).
- `fe` → **refused outright**: we have NO prod key for fe on disk; `fe.env.local` is the DEV project (jgxsj).
  prod-run refuses rather than connect to DEV believing it's prod (does NOT substitute the dev blob).

## proof-of-teeth (real machine, neg-control-first)
- **fakeable-confirmation hole CLOSED (ตู๋ lens #3 — the bug บอง caught in review):** the typed confirmation now
  requires a real TTY (`process.stdin.isTTY`). Neg-controls:
  - `echo be | prod-run be -- …` → **REFUSED** (`exit 6`), command never ran.
  - `printf 'be\nSEND-REAL\n' | prod-run --with-providers be -- …` (the most dangerous path — auto-arming live
    SMS/payment) → **REFUSED** (`exit 6`), command never ran.
  So no pipe/script/CI can auto-confirm prod (or live providers) — only a human at a terminal. In any
  non-interactive context prod-run refuses before the confirm, before the pre-flight, before any connection.
- **fe refused (no prod key):** `prod-run fe …` → `exit 4` with a human message (fe.env.local is DEV, not prod;
  ask ฟีม), before any stdin/connection.
- **pre-flight fail-LOUD** `ANCHOR testenv/scripts/prod-run.mjs#preflight-fail-loud`: before spawning, a read-only
  `select 1` verifies the blob reaches a LIVE prod DB; on failure → REFUSE with why/means/do (no env value).
  Demonstrated earlier against the DEV ref (jgxsj) → `tenant-not-found` → refuse (`exit 5`), command never ran.
  The `means` line is worded per ฟีม: *"points at DEV (or a paused tenant), NOT prod — DEV is not broken, it's a
  different place; real prod is soxsc in be.env.prod.local"* — not "stale/gone". Pass verdict `ok` confirmed for
  the live soxsc ref (psql = same verdict as the app's postgres.js). `be` now maps to the live blob, so a normal
  `prod-run be` would pass the pre-flight and spawn; **not re-invoked to respect ฟีม's cap on further soxsc hits**
  (pre-flight sits after the isTTY gate, so automation can't reach a connection anyway).
- **build refused:** `prod-run be -- npm run build` → `exit 3`, human reason (NEXT_PUBLIC bakes at build; runtime
  injection would ship wrong browser values and fail silently), before confirm/connection.
- **providers blocked by default, provable:** default → `prod-probe` DNS verdict LINE/8x8 = **BLOCKED (ENOTFOUND)**,
  SendGrid/Omise keys neutralized; `--with-providers` → **LIVE (resolves)**. (Verdict shown, not asserted.)
- **zero disk writes:** file census before/after a full run — `~/.mumate-prod` sha + `$TMPDIR` unchanged, 0 new
  files, git clean x3. Env injected into the child via `spawn({env})`; no temp/backup/marker exists at any point.
- **no value leak:** banner prints only the DB *family* (`supabase.com`); pre-flight categorizes stderr and never
  echoes it (it holds the username); the password is never rendered anywhere.

## adversary sign-off
**goo self-adversarial:**
- *"Can the confirmation be faked by a pipe / here-string / `< file`?"* → No — `isTTY` gate refuses all
  non-terminal stdin (both neg-controls proven). This was the live hole; it's closed.
- *"Does the isTTY gate break legitimate use?"* → A human in an interactive shell has a TTY and proceeds
  normally. Only automation is refused — by design (per บอง/ฟีม: the dangerous path must not be scriptable).
- *"Would the pre-flight false-refuse valid prod?"* → No — verified `ok` for the live soxsc ref (agrees with the
  app's postgres.js). psql absent → warn+proceed, never hard-block on a missing tool.
- *"Is the mapping a guess?"* → No longer — ฟีม-confirmed (soxsc=prod). fe is refused honestly (no key) rather
  than pointed at dev.
- Limits (stated): `bazi`/Neon and the 3rd project ref in bazi's `SUPABASE_URL` were **not** probed (ฟีม's call);
  end-to-end pass→spawn against `be` is not re-run here to respect the soxsc-connection cap (pre-flight `ok`
  verdict + spawn are each proven separately).

**Pending ตู๋ (too)** — full runtime review (บอง reviews first, then sends ตู๋).

ANCHOR: testenv/scripts/prod-run.mjs#preflight-fail-loud
