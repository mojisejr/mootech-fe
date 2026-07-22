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

### Trap B — coverage-drift → SEAM (ตู๋ discovers, goo consumes), through an adversary loop
A first-cut derived-glob lived here; ตู๋ penetrated it (Phantom Page: shallow readdir, dynamic import),
so discovery moved to his AST. Then the loop ran **both ways**: goo penetrated his first two attempts
(a graph attempt let namespace/alias/transitive-via-namespace sneak — 4+ run-proven vectors), which
drove the root diagnosis — *import-detection is a PROXY for auth-gate behaviour; chasing forms is
whack-a-mole*. The fix is **complete-by-construction**: ตู๋'s scanner now BANS every evading form
(namespace, alias, transitive-wrapper-outside-pages/v2, barrel) → any gated page MUST use a direct
named import his scanner catches. Re-attack: all four evasion forms go RED, real code stays green.
Seam wiring + phantom-RED proven BOTH sides:
- **static (ตู๋):** a real nested `pages/v2/settings/profile.tsx` → `gated-page-not-anchored` RED (pre-browser).
- **runtime (goo):** this anchor reads his `scripts/gated-v2-pages.generated.json`; a manifest route
  with no STATE_MAP seed (e.g. `/v2/ghost`) → the coverage test RED. Baseline (manifest = 3, all
  anchored) → 7/7 green.
**Residual boundary (out of this round's scope, noted):** discovery keys on *importing useV2AuthGate*,
still a proxy for *having the SSR-cookie hydration behaviour*. A page that inlines the pattern
(`useCurrentUser` + `useHasMounted` directly, the pre-refactor register.tsx style) has the risk without
the import → invisible here. It's already forbidden by the ownership-seam (pages must gate via
useV2AuthGate); closing it fully = also ban raw `useCurrentUser`/MEMBER_ID-cookie reads in pages/v2.

### Trap C — mount-flash / CLS (มุน-visual lens) → BLOCKING (promoted, independently teeth-proven)
`window.__cls` (PerformanceObserver layout-shift), budget **0.015** (default state only; /v2-measured).
Promoted advisory→blocking after `mut-cls-silent-flash` proved CLS an INDEPENDENT lens — co-built w/
Lamun, both sides run independently:
- **NEG-CONTROL first** (Lamun constraint 3): real /v2 → hydErr=0 AND CLS=0.0000 (<0.015). Non-vacuous.
- **mut-cls-silent-flash** = naive "fix" (useState+useEffect gate; SSR===first-paint so console is
  SILENT; post-mount setState swaps a 40px placeholder for 600px content → a below footer shifts down
  = GEOMETRY shift, per Lamun constraint 1 — not opacity/transform/same-box which read 0).
- **In the actual anchor:** the mutant fails /v2 states on the **CLS assertion** (`CLS 0.0608 ≥ 0.015,
  geometry-shift silent flash`) while the **console assertion PASSES** (hydErr=0). CLS caught what
  console is blind to → independent. (goo /v2 0.061–0.077; Lamun's synthetic page 0.1776 — magnitude
  is layout-dependent per-screen, both ≥budget → qualitative claim robust; 0.015 ratified for /v2.)
- **Scope of teeth:** geometry-shift console-silent flash only. Opacity/transform/same-box flashes read
  CLS 0 (Lamun verified) → those await pixel-L3 (Lamun's next). CLS does NOT close all silent flashes.

## Dropped from the hole-map (mutant DISPROVED it)
**"ban suppressHydrationWarning"** — tested directly: a `suppressHydrationWarning` wrapper on both
render branches did NOT silence the mismatch (hydErr stayed 5, CLS stayed 0.027). React only
suppresses element-level text/attr diffs, never a structural tree mismatch. It guards a non-threat
for our bug-class, so it is not in the anchor. (Per bong: the mutant decides, not the hole-map.)

## Seam sign-off (3 lenses, each covers what the others miss) — round 1 complete
- **goo-runtime** (console/state, all gated pages) — ✅ built + mutant-proven (console BLOCKING).
- **มุน-visual** (CLS) — ✅ **BLOCKING**, promoted + independently co-signed (Lamun repro'd; mut-cls-silent-flash proves independence in-anchor).
- **too-static** (gated-page discovery) — ✅ SURVIVED re-attack + WIRED. Adversary loop closed: goo
  penetrated two attempts → ตู๋ landed complete-by-construction (bans all evading forms) → all evasion
  vectors RED, real code green → goo wired the consumer → phantom RED both sides. Residual inline-behaviour
  boundary noted (defended by the ownership-seam).

The adversary round already fired **within the seam** (ตู๋ + มุน each penetrated a lens outside their
own) — exactly the cross-role value the frame predicts. "Teeth-proven" lands when the Phantom-Page
attack goes red (AST discovery wired) and, for CLS, when the silent-flash mutant promotes it.
