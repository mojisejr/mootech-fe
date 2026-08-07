# harness/archive — gates that nothing runs (kept, not deleted)

**Moved here:** 2026-08-07 · **counted at main `a4560da`** · by goo (harness-tidy ใบ ข, on บอง’s ruling)

These 44 `run-*.ts` were **browser gates that CI never ran** — not `harness/run.ts`, not an npm
script, not a workflow. A gate nobody runs is not a gate; it only *looks* like coverage. They are
**MOVED, not deleted** (Rule 1 · Nothing is Deleted) — every file is intact and `git log --follow`
traces it. They are excluded from `tsc` (`tsconfig.json` `exclude`), like `scripts/`.

**CI still runs exactly 5 gates** (unchanged, still biting): `run.ts` · `run-pixel.ts` ·
`run-calendar-month.ts` · `run-calendar-select.ts` (+ `capture-coming-soon.ts`) — all in
`harness/`, wired in `.github/workflows/design-verify.yml`.

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
3. ONLY THEN re-add its `enforced_by` to the matching `harness/bug-ledger/*.json` entry. The old value
   is preserved there as a `WAS:` note in the description — connect it or leave the claim withdrawn,
   never leave a claim standing without a runner.
