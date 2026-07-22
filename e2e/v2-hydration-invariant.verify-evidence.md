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
Three traps, each with an independent mutant (source-patch, history-independent):
- **A. console / all pages** — mutant `strip !hasMounted` → 3 mismatch sites red (/v2, /v2/login, /v2/register [authed]); anon states stay green (can't diverge). Fixed→green, revert→green, hook 0 changed lines.
- **B. coverage-drift** — mutant `add useV2AuthGate import to calendar.tsx` → coverage test red (`/v2/calendar` derived-not-anchored). Revert→green.
- **C. CLS** — mutant CLS 0.027/0.031 > budget 0.015. Correlated with A (console short-circuits first); NOT independently proven for a console-silent flash — flagged for มุน to ratify blocking-vs-advisory.

## dropped (mutant disproved)
`ban suppressHydrationWarning` — a suppress wrapper did NOT silence the structural mismatch (hydErr 5→5, CLS 0.027→0.027). Guards a non-threat for this bug-class. Removed per "mutant decides, not hole-map".

## adversary sign-off (different oracle — anti-rubber-stamp)
PENDING. A non-author oracle must try to sneak a mismatch past this widened anchor (a console-silent
flash that also stays under CLS budget; a gated page added via a path the derived-glob misses, e.g. a
nested route or a re-export of the hook). Record the attempt + result. Not "teeth-proven" until then.

## seam co-sign (SEAM = 2+ owners required)
- goo-runtime ✅ (built + A/B proven) · too-static ⏳ (coverage guard — ตู๋ review canonical home) · มุน-visual ⏳ (CLS ratify).
