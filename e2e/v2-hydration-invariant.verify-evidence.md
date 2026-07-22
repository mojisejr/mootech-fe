# verify-evidence — webgang v2 step 2: widen hydration anchor (goo, seam w/ too+มุน)

## capability → gates fired
This change is a **safety-invariant harness** (client-state/hydration class). Per the logic-role
trigger-table it must fire: runtime edge-matrix (state × page) + console(A3) + negative-control
MANDATORY + verify-at-the-consumer. It touches NO product code (only `e2e/`), so no build/data gates.

## ground-truth artifacts
- Fixed code, all gated states + coverage: **7/7 green** (`npx playwright test e2e/v2-hydration-invariant.spec.ts`).
- CLS measured (same `window.__cls` the test asserts): baseline /v2[authed]=0.0000, /v2/register[authed]=0.0038; mutant 0.0272 / 0.0311.
- Gated set derived-from-source = index, login, register (onboarding/calendar/service/shop import-free → ungated).

## proof-of-teeth (capability-scoped — runtime hydration class only)
- **A. console / all pages (goo-runtime, BLOCKING)** — mutant `strip !hasMounted` → 3 mismatch sites red (/v2, /v2/login, /v2/register [authed]); anon states stay green (can't diverge). Fixed→green, revert→green, hook 0 changed lines. Re-verified after the CLS/coverage edits.
- **B. gated-page discovery (too-static)** — MOVED to ตู๋'s AST after he penetrated the derived-glob (Phantom Page: shallow readdir + dynamic import). goo consumes his list; Phantom-Page attack → RED is the gate. Co-build in flight (not claimed in this PR).
- **C. CLS (มุน-visual, ADVISORY)** — mutant CLS 0.027/0.031 vs budget 0.015. Ratified advisory (correlated with A → blocking-now = vacuous). Promotes via `mut-cls-silent-flash` (hydErr===0 AND CLS≥budget). Co-build in flight.

## dropped (mutant disproved)
`ban suppressHydrationWarning` — a suppress wrapper did NOT silence the structural mismatch (hydErr 5→5, CLS 0.027→0.027). Guards a non-threat for this bug-class. Removed per "mutant decides, not hole-map".

## adversary sign-off (different oracle — anti-rubber-stamp)
FIRED, within the seam: **ตู๋** penetrated the coverage guard (Phantom Page — nested route + dynamic
import) → discovery moves to his AST. **มุน** penetrated the CLS claim (vacuous-blocking — CLS rides
console) → downgraded to advisory + a promote-gate. Each hit a lens outside their own. "Teeth-proven"
lands when the Phantom-Page attack goes red (AST wired) and the silent-flash mutant promotes CLS.

## seam co-sign (SEAM = 2+ owners required)
- goo-runtime ✅ (built + A proven, BLOCKING) · too-static 🗡️→🔧 (found-hole; discovery→AST, co-build) · มุน-visual 🗡️→🔧 (found-hole; CLS advisory + promote-gate, co-build).
