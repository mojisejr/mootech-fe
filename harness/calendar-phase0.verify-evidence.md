# verify-evidence — Calendar Phase 0 (data / state / routing skeleton · goo)

**Scope**: logic-only (types · fixtures · hooks · state machines · routing). **NO designed UI** (that is Lamun's
Phase 1-6), **NO network** (done-condition #8). Because this is a LOGIC seam, the teeth are on the pure logic +
a runtime 0-app-fetch proof, not a pixel anchor.

ANCHOR: scripts/calendar-phase0.test.ts#save-flow-double-commit-latch

## proof-of-teeth

Pure-logic tests: `npx tsx scripts/calendar-phase0.test.ts` → **18/18 pass** (baseline).

Mutation-proven (the anchor actually catches the bug-classes it claims — run, neg-control-first):

| # | mutation (real source edit) | expected catch | result |
|---|---|---|---|
| A | add a `commit` edge to `saving` in `SAVE_FLOW_TRANSITIONS` (allow a 2nd commit = double-write, the PR#97 class) | double-commit-latch + no-self-write tests go red | **CAUGHT — 16/18** |
| B | remove the `/api/auth/*` framework exclusion in `isAppFetch` (false-flag NextAuth infra) | "NextAuth /api/auth/* is NOT app-fetch" goes red | **CAUGHT — 15/18** |

Both mutations reverted → back to **18/18**. (`grep MUTATED` clean; re-run green — verified, the untracked-file
`git checkout` revert no-op was caught and fixed by hand.)

Runtime 0-app-fetch proof — `npx tsx harness/run-calendar-phase0.ts` with **NO backend booted** (FE only, no
BE:4000 / bazi:3100 / DB — nothing to reach is the strongest proof):

```
✓ /v2/calendar               app-fetch=0  console-errors=0
✓ /v2/calendar/2026-07-14    app-fetch=0  console-errors=0
✓ /v2/calendar/notifications app-fetch=0  console-errors=0
✓ PASS — 0 app-fetch, console-0 on all calendar routes (no backend booted)
```

The tracker is REQUEST-level (`page.on('request')`), not response-level: a would-be `/api` call to a downed
backend emits no `response` event, so a response-level check reads "0 app-fetch" while a fetch actually left the
page — a vacuous pass (the Zone-3 class). Request-level catches the attempt itself. Same helper Lamun imports for
her calendar anchor (one assertion, two lenses, cannot diverge).

Screenshot @393 (verify artifact, gitignored `harness/captures/cal-phase0/`): month grid July 2026 renders full
(day + ganzhi 干支 + %), **today (28) bold/underlined** = the mount-fenced Bangkok-today marker resolving
post-hydration with **console-0** (no hydration mismatch — the timezone-straddle trap ตู๋ flagged, fenced via the
repo's `useHasMounted`). Menu active on ปฏิทิน. Day + notifications routes render the day-detail (advanced toggle,
save sheet) and the 2-group reminder list.

## adversary sign-off

Self-adversary pass (edges tried before hand-off — ตู๋ does the independent review):

- **input-boundary**: empty ยาม selection → `hasCommittableDraft=false` (save blocked); out-of-range date → day
  detail falls back gracefully (no crash); month cursor crosses year boundary (Dec→Jan, Jan→Dec) — tested via grid
  builder over arbitrary (year, month).
- **client side-effect / replay**: double-commit while `saving` = NO-OP (one reminder, not two); reload-while-saved
  derives menu-state 3 from the reminder EXISTING, not a remembered flag; add() de-dupes by id (replay-safe).
- **hydration**: toggle/selection defaults are CONSTANTS (advanced default ON) → hydration-safe by construction, NOT
  fenced (no gratuitous loading flash); only the clock-derived "today" is mount-fenced (verified console-0 + the 28
  marker appears post-mount).
- **matcher**: `/api/user`, `:4000`, `:3100` flagged; `/api/auth/*`, `_next/*`, favicon excluded (verified against a
  real FE-only capture, not assumed).

**NOT covered (not hidden)**:
- **menu-state enum = HYPOTHESIS (v0)**: the 4 states are บอง-inferred + ฟีม-confirmed COUNT, NOT yet enumerated
  cell-by-cell against Figma 461:3224. Labeled as such in `menu-state.ts`. Lamun's Phase-1 first step is the
  enumerate-verify; a 5th state → STOP, route บอง→ฟีม, amend the contract together.
- **fixture VALUES illustrative**: shapes are frozen (the contract), but per-day ganzhi/%/grade are deterministic
  illustrative values, NOT reconciled cell-by-cell to Figma 375:16710 (that is Lamun's Phase-2 visual reconcile; the
  data SHAPE does not change when they are). `grade↔%` mapping is bazi's ground-truth and is deliberately NOT invented
  here — fixtures carry `grade` explicitly.
- **no designed UI**: pages render THIN scaffolds (clearly labeled) to prove the state layer + routing; Lamun's
  components replace the scaffold bodies in Phase 2-6 (hooks/routing unchanged).

🤖 goo · Phase 0 · logic-only · 0 network
