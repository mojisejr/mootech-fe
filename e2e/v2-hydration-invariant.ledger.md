# Ledger entry + proof-of-teeth — v2 auth-gate hydration (webgang v2, goo)

Co-located evidence for `e2e/v2-hydration-invariant.spec.ts`. Canonical shared ledger location is a
team decision (proposed: `oracle-skills` overlay); this file is the entry + run-record until then.

**Step 2 (widen):** step-1 anchored one page/one state and was penetrated in the adversary round for
being EARLY. This version closes the holes the **mutant proved real** (not the hole-map's guesses).

## bug-history ledger entry (schema v1)

```yaml
- id: v2-authgate-hydration-mismatch
  invariant: "server-rendered HTML === client first-paint HTML for EVERY useV2AuthGate-gated /v2 page;
              cookie-mumate-id is identity-truth but invisible to SSR, so the render must be held on a
              mount-gate until after hydration"
  injection_recipe: "strip `!hasMounted || ` from useV2AuthGate.showLoading"
  mutant_kind: source-patch                     # NOT css-inject — a .ts source mutation (goo schema feedback #3)
  bug_class: seam
  gate_should_catch: [goo-runtime, มุน-visual, too-static]   # seam = 2+ owners (list, goo feedback #1)
  caught_by: มุน-visual                          # actual catch @393; should=goo-runtime → under-fire delta (feedback #4)
  runtime_context:                              # goo feedback #2 — runtime needs machine-replay context
    render_phase: hydration
    trigger_state: "cookie-mumate-id=valid-uuid present, no next-auth session (client authed, server loading)"
    detection_signal: "console/pageerror matching /hydrat|initial UI does not match|#418|#423/"
  reached: team                                 # Lamun @393, before ฟีม
  triage: verify-hole
  commit_hash: 1feafc5
  schema_version: 1
```

## Widened traps + proof-of-teeth (capability-scoped: runtime hydration class)

All run this build against FE :3000 (`V2_PREVIEW_KEY=lamun-local-dev`). Fixed code: **7/7 green**.

### Trap A — console mismatch, ALL gated pages (goo-runtime)
The gated set is DERIVED from source (pages importing useV2AuthGate = index/login/register). Mutant
(strip `!hasMounted`) → **3 mismatch sites turn red**, more than step-1's one:

| state | fixed | mutant |
|---|---|---|
| /v2 [authed] | ✓ | ✘ `Hydration failed…` |
| /v2/login [authed] | ✓ | ✘ (redirecting is hasMounted-gated → client renders LoginView, server the loading gate) |
| /v2/register [authed] | ✓ | ✘ `Hydration failed…` |
| /v2 [anon], /v2/login [anon], /v2/register [anon] | ✓ | ✓ (anon can't diverge — both renders are 'loading' at first paint) |

### Trap B — coverage-drift → MOVED to ตู๋'s AST (verify-architecture.ts)
A first-cut derived-glob coverage guard lived in this anchor. **ตู๋ (static lens) adversarially
penetrated it — "Phantom Page hole":** `readdirSync` is shallow (a gated `pages/v2/settings/profile.tsx`
is invisible) and a source regex misses `const { useV2AuthGate } = await import(...)` (dynamic). A
phantom page slips discovery → never forced into STATE_MAP → the 3 traps never test it = falsely green.
Discovery is static analysis (his lens, fails in ms without a browser), so it moves to a **recursive
ESTree walk (ImportDeclaration + dynamic CallExpression)** in verify-architecture.ts. Seam contract:
ตู๋'s AST produces the authoritative gated-page list → this anchor consumes it as the source-of-truth
for coverage + all 3 traps. ⚠️ pure-runtime `await import()` may not statically resolve → ตู๋'s rule
lint-bans an unregisterable dynamic gated import (else discovery becomes a new proxy). This anchor
exports `ANCHORED_GATED_PAGES` for the cross-check. Proof-of-teeth = ตู๋'s Phantom-Page attack must go
RED once wired. (Co-build in flight; this PR delegates coverage, does not claim it.)

### Trap C — mount-flash / CLS (มุน-visual lens) → ADVISORY
`window.__cls` (PerformanceObserver layout-shift), budget **0.015**. Measured: baseline ≤0.004,
mutant **0.027 (/v2)** / **0.031 (/v2/register)**. **Lamun ratified ADVISORY, not blocking:** for THIS
bug the console signal fires first, so CLS is correlated — shipping it blocking now would be
*vacuous-blocking* (CLS riding console's teeth). It measures + reports (test annotation), does not fail
the run. Scope: **default state only** — injected states carry test-artifact CLS (Lamun's long-text
injection reads 0.116 from a post-load reflow, not app CLS). **Promote-gate:** build `mut-cls-silent-flash`
— a mutant with `hydrationErrors===0` AND `CLS≥budget` *simultaneously* (SSR===first-paint so console is
silent, post-mount setState shifts layout). When that mutant turns CLS red while console stays green,
CLS is proven an independent lens → promote to blocking. Co-build w/ Lamun (goo: hook mutation, Lamun:
CLS recipe).

## Dropped from the hole-map (mutant DISPROVED it)
**"ban suppressHydrationWarning"** — tested directly: a `suppressHydrationWarning` wrapper on both
render branches did NOT silence the mismatch (hydErr stayed 5, CLS stayed 0.027). React only
suppresses element-level text/attr diffs, never a structural tree mismatch. It guards a non-threat
for our bug-class, so it is not in the anchor. (Per bong: the mutant decides, not the hole-map.)

## Seam sign-off (3 lenses, each covers what the others miss) — round 1 complete
- **goo-runtime** (console/state, all gated pages) — ✅ built + mutant-proven (console blocking).
- **too-static** (gated-page discovery) — 🗡️ **ตู๋ FOUND-HOLE** (Phantom Page: shallow readdir + dynamic
  import). Discovery moves to his AST; goo consumes the list. Co-build in flight; Phantom attack → RED = the gate.
- **มุน-visual** (CLS) — 🗡️ **มุน ratified ADVISORY** (blocking-now = vacuous). Promotes via `mut-cls-silent-flash`. Co-build in flight.

The adversary round already fired **within the seam** (ตู๋ + มุน each penetrated a lens outside their
own) — exactly the cross-role value the frame predicts. "Teeth-proven" lands when the Phantom-Page
attack goes red (AST discovery wired) and, for CLS, when the silent-flash mutant promotes it.
