# verify-evidence — capture harness names "BE not booted" instead of a phantom UI bug · goo

Harness-only change. No component / no page / no prod / no env touched. Live proof ran against the test-env
(FE :3000 · BE :4000 · pg :5433, booted via `stack.sh up`; restored after).

## the problem (มุน hit it on Zone 4)
When the BE (NestJS :4000) is not booted, the FE BFF (`/api/*`) answers **502 upstream-unreachable**, the page
falls back, and the browser logs a red console error. A reviewer reads that as a **UI bug** — it isn't, it's
**infra** (BE not running). μุน saw `GET /api/chinese-horoscope → 502` on /v2 while the rest of the page was fine.

## the fix
- `harness/backend-hint.ts` (pure) — `backendUnreachableHint(failed)` turns the signal into a plain line.
- `capture-route.ts` (the team review-capture tool μุน uses) now collects 4xx/5xx responses and prints the hint
  after the summary. The tool **explains** what it sees — it does **not** auto-boot the env (บอง: a tool should
  describe what it observes, not silently mutate the environment).

### narrow on purpose (บอง: don't make it noise)
Fires **only** on HTTP **502** to an **/api** path — the BFF's exact `upstream unreachable` branch (it 502s only
when its fetch to BE throws; a bazi-overlay failure is graceful, and a BE that IS up but errors is proxied as its
own **500**). A 404 or 500 on /api is a *different* problem and is deliberately **not** claimed to be "BE not
booted" — we stay silent rather than print a confident wrong line.

## proof-of-teeth — verify-the-instrument BOTH ways
บอง: a one-directional test can't tell "correct" from "always-on" (μุน's Zone-3 vacuous guard). So we prove it
**fires when it should AND stays silent when it should**, at two levels:

**Unit (`scripts/backend-hint.test.ts`, 9/9, CI-gated):**
- FIRES: `502` on /api (object form + the `"STATUS url"` string form capture.ts collects); mixed noise containing one `502`-on-/api.
- SILENT: `500` on /api (BE up, errored) · `404` on /api · `502` **off** /api · empty · unparseable garbage · mixed with no `502`-on-/api.

**Live, through the real `capture-route --route /v2 --user default`:**
- **(b) BE UP** → `errors=0`, **hint ABSENT** (`/api/chinese-horoscope` returns 200 `{data:null}` from the merged null-guard — so no 502).
- **(a) BE killed** → **hint APPEARS**:
  `⚠️  BE upstream unreachable: 1 request(s) to /api returned 502 (e.g. …/api/chinese-horoscope?userId=…&code=…). The backend (NestJS :4000) is likely not booted — run: bash testenv/scripts/stack.sh up. The page's fallback + this red console error are INFRA, not a UI bug.`

## adversary sign-off
**goo self-adversarial:** proved BOTH directions (the silent direction is the one that catches an always-on
vacuous guard) · kept it narrow to 502-on-/api and explicitly tested that 500/404-on-/api and 502-off-/api do
NOT trigger — so it won't erode into ignored noise · the tool describes, it does not auto-boot BE (no hidden
env mutation) · hint wording says "likely not booted" (honest hedge — 502 is reliably unreachable, but I do not
overclaim "definitely") · pure detector is deterministic + unit-tested; the live run left env SHAs + git
unchanged (restored) · no secrets printed (the URL in the hint is a local test host + anonymized fake user/code).
**Pending ตู๋ (too).**

ANCHOR: harness/backend-hint.ts#backend-unreachable-hint
