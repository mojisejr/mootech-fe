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
- **B. gated-page discovery (too-static) → SEAM, WIRED** — after an adversary loop (goo penetrated a shallow-glob then a graph attempt with namespace/alias/transitive vectors), ตู๋ landed complete-by-construction (bans evading forms). Re-attack: all evasion RED, real code green. Wired: this anchor consumes his manifest; phantom RED both sides (static `/v2/settings/profile` → his scanner RED; manifest `/v2/ghost` → goo coverage RED). 7/7 baseline green.
- **C. CLS (มุน-visual, BLOCKING)** — promoted after `mut-cls-silent-flash` proved independence: neg-control real /v2 (hydErr=0 AND CLS=0.0000), then the mutant fails /v2 on the CLS assertion (CLS 0.0608 ≥ 0.015) while console PASSES (hydErr=0) → CLS catches a console-silent geometry flash. Lamun independently repro'd (0.1776). Scope: geometry-shift only (opacity/same-box → pixel-L3).
- **D. inline-identity crawl (goo-runtime, BLOCKING) — D3 self-harden loop** — the family beyond import-discovery: a page gating on inline `useCurrentUser`/MEMBER_ID-cookie evades ตู๋'s scanner (no useV2AuthGate import) AND coverage (not in manifest), yet hydration-mismatches. Run-proven: mutant `pages/v2/inline-bug.tsx` (inline useCurrentUser, no mount-gate) → static gate PASSES (evades) + not in manifest, but authed load → `Prop did not match. Server: height:40px Client: height:600px`. The full-route crawl (every /v2 route authed, ground-truth) catches it RED; remove → green; ungated pages (calendar/shop/service) stay clean. Enforced in `harness/bug-ledger/inline-identity-gate-evasion.json`; 8/8 baseline green.

ANCHOR: e2e/v2-hydration-invariant.spec.ts#inline-identity-crawl

## dropped (mutant disproved)
`ban suppressHydrationWarning` — a suppress wrapper did NOT silence the structural mismatch (hydErr 5→5, CLS 0.027→0.027). Guards a non-threat for this bug-class. Removed per "mutant decides, not hole-map".

## adversary sign-off (different oracle — anti-rubber-stamp)
FIRED, within the seam: **ตู๋** penetrated the coverage guard (Phantom Page — nested route + dynamic
import) → discovery moves to his AST. **มุน** penetrated the CLS claim (vacuous-blocking — CLS rides
console) → downgraded to advisory + a promote-gate. Each hit a lens outside their own.

**D3 crawl (D) — adversary FIRED, holes closed:** **มุน** penetrated the crawl (visual lens):
- **A (regression, fixed):** v1 destructured `{ hydrationErrors }` and threw away the `cls`
  loadAndObserve already returns → CLS coverage = 0 on every route, silently regressing the CLS lens
  shipped in #94. A console-silent geometry flash would sneak. Fixed: the crawl now asserts BOTH
  channels (console + `cls < 0.015`); proven — a silent-flash page → crawl RED on CLS 0.0771 (console
  silent) in authed AND anon.
- **B (fixed):** v1 drove only `authed`. Now drives authed + anon (baselines ≤0.0042 / ≤0.0006 —
  neg-control, budget safe). An anon-only mismatch is now caught.
- **C (routed → ตู๋):** the glob targets `pages/v2/**`; a route defined elsewhere (rewrite, `src/pages`)
  or dynamic/catch-all evades. Route discovery is static — ตู๋'s lens.
- **D (routed → มุน):** even with CLS, the crawl is blind to opacity/transform/same-box flashes (CLS
  reads 0 on those, Lamun-proven) → pixel-L3 (Lamun's next).
goo did NOT self-certify — มุน found A/B, each fixed run-proven.

## seam co-sign (SEAM = 2+ owners required) — ALL THREE CLOSED
- goo-runtime ✅ (console BLOCKING, mutant-proven)
- มุน-visual ✅ (CLS BLOCKING, promoted + independently co-signed via mut-cls-silent-flash)
- too-static ✅ (discovery complete-by-construction, survived goo's re-attack, consumer wired, phantom RED both sides)

**D3 inline-identity family (self-harden loop, this PR):** goo-runtime ✅ full-route crawl backstop
(mutant-proven). too-static ⏳ complementary **ban** of inline `useCurrentUser`/MEMBER_ID-cookie in
pages/v2 (source prevention — routed to ตู๋, his lens; matches his complete-by-construction ban
pattern). Seam: static prevents the pattern, runtime detects any that slip.

Each lens was adversarially penetrated by a DIFFERENT oracle before it hardened (goo→ตู๋'s discovery,
ตู๋→goo's coverage-glob, มุน→goo's CLS-blocking claim) — the cross-role forcing-function, run-proven,
not self-certified. PR#93 (ตู๋'s discovery) is already in main; this PR is the runtime half (widened
anchor + CLS-blocking + manifest consumer), re-verified fresh on post-#93 main. (It supersedes the
interim that merged as #92 before this work landed — CLS was advisory and coverage was unwired there.)
