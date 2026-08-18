# harness/archive — gates that nothing runs (kept, not deleted)

## 🔴 Round 2 — 2026-08-18 · the WHOLE harness landed here (`mojisejr/mootech-fe#321`)

ฟีม's ruling in `mojisejr/mootech-fe#318`: **gates move onto the machine.** `lint` + `test` are held by
`.githooks/pre-push`; `build` is run by hand before "Ready for review". On GitHub only **`secret-scan`** and
**`main-guard`** are left. Everything the team built to gate itself came here — **moved, not deleted.**

**What arrived in this round** (52 renames, no file content changed):
```
harness/*.ts                39 files   →  harness/archive/
harness/engine/             7 files    →  harness/archive/engine/
harness/adapters/measureHtml.ts        →  harness/archive/adapters/
harness/tsconfig.json · harness/CAPTURE.md
design.contract.ts · design.reference.ts   (they sat at ROOT but are harness-only)   →  harness/archive/
.github/workflows/ci.yml · design-verify.yml   →  .github/workflows/archive/
```
GitHub reads workflows one level deep only, so a workflow inside `archive/` stops running by itself.

⚠️ **Relative imports in here point at where the file USED to be — including the ones that just arrived.**
That was already true of the 44 files from round 1 (`../features/...` resolves to `harness/features/`, which
has never existed). Nothing catches it because `tsconfig.json` `exclude` covers `harness/archive`. This is the
`../` → `./` fix the section below is talking about: **do it before you trust anything you move back.**

🔑 `design.contract.ts` / `design.reference.ts` did NOT get their imports fixed — they got moved **out of the
range `tsc` checks**. Different thing. Say it that way if you cite this move.

---

**Round 1 — moved here:** 2026-08-07 · **counted at main `a4560da`** · by goo (harness-tidy ใบ ข, on บอง’s ruling)

These 44 `run-*.ts` were **browser gates that CI never ran** — not `harness/run.ts`, not an npm
script, not a workflow. A gate nobody runs is not a gate; it only *looks* like coverage. They are
**MOVED, not deleted** (Rule 1 · Nothing is Deleted) — every file is intact and `git log --follow`
traces it. They are excluded from `tsc` (`tsconfig.json` `exclude`), like `scripts/`.

~~**CI still runs exactly 5 gates** (unchanged, still biting): `run.ts` · `run-pixel.ts` ·
`run-calendar-month.ts` · `run-calendar-select.ts` (+ `capture-coming-soon.ts`) — all in
`harness/`, wired in `.github/workflows/design-verify.yml`.~~
🔴 **NOT TRUE since 2026-08-18** — round 2 above moved all five here and archived
`design-verify.yml` too. **CI runs zero harness gates now.**

## 🚩 If you arrived here from a code comment
Some files in `features/**` and `scripts/**` still carry prose like *"the invariant run-X.ts owns"*
or *"enforced by run-X.ts"*. **Those files no longer enforce anything — nothing runs them.** The
comment records history, not a live guard. If that invariant matters, re-wire the gate (below) or
add a CI-executed `scripts/*.test.ts`; do not trust the prose as protection.

## Three buckets (they are NOT all the same)

### C · RED when they were moved — moved for NOT-RUNNING, **not** for being fixed
> ⚠️ These were **failing** at the moment they were archived (documented red in design-verify.yml).
> Archiving them is NOT sweeping a failure under the rug — it is removing a gate that was pretending
> to exist. If you revive them, they will still be red until the real cause is fixed.
- run-calendar-day.ts — red: never signs in as a PAID user, so the tier gate hides the content it asserts on
- run-calendar-fidelity.ts — red: same paid-tier cause

### B · Intended but never wired — needs a stub first
- run-calendar-flow.ts — goes red "0 cells" against a no-backend CI box; the month view is real-pipe
  since #186 and this anchor stubs nothing. Needs route-interception stubs (like run-calendar-month.ts)
  BEFORE it can run green.

### A · Unrun — nobody ran them, so their pass/fail status is **UNKNOWN** (do not assume green)
- run-app-header.ts
- run-bg-continuity.ts
- run-breakpoint-sweep.ts
- run-calendar-day-advanced.ts
- run-calendar-menu.ts
- run-calendar-notifications.ts
- run-calendar-phase0.ts
- run-calendar-save.ts
- run-compat-2e2.ts
- run-compat-2f.ts
- run-compat-2g.ts
- run-compat-3c.ts
- run-compat-result.ts
- run-compat-sprites.ts
- run-compat-ui.ts
- run-compat-zones.ts
- run-compatibility.ts
- run-daily-card.ts
- run-element-line.ts
- run-fortune-fidelity.ts
- run-fortune-hang.ts
- run-freeze-proof.ts
- run-header-structure.ts
- run-html-ref.ts
- run-loading-screen.ts
- run-mateai-button.ts
- run-nav-consistency.ts
- run-page-end.ts
- run-percent-scale.ts
- run-service-hub.ts
- run-shared-topbar.ts
- run-system.ts
- run-tier-gate.ts
- run-verdict-color.ts
- run-zone1-refine.ts
- run-zone2-card.ts
- run-zone3-somphong.ts
- run-zone4-motion.ts
- run-zone4-sian.ts
- run-zone5-sinse.ts
- run-zone6-pajeu.ts

## To revive any of these
1. Move it back to `harness/` and fix its relative imports (`../` → `./`).
2. **Wire it into a workflow** (`.github/workflows/design-verify.yml`) and prove it green locally first.
3. That's the whole revival — there is no ledger to register it with anymore (the ledger was torn out
   2026-08-07, PR #201). A running gate IS the claim now; never leave a gate advertised without a runner.
