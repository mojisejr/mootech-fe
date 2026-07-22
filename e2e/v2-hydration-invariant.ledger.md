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

### Trap B — coverage-drift guard (too-static lens)
The anchor asserts its tested set == the gated set derived from source. Mutant = add
`useV2AuthGate` import to `pages/v2/calendar.tsx` (currently ungated, 1 of 4 ungated /v2 pages)
without a STATE_MAP entry → coverage test **FAILS**: `derived-from-source: /v2, /v2/calendar, …` ≠
anchored. This kills the exact step-1 adversary hole ("a gated page the anchor never visits").

### Trap C — mount-flash / CLS (มุน-visual lens)
`window.__cls` (PerformanceObserver layout-shift), budget **0.015**. Measured: baseline ≤0.004,
mutant **0.027 (/v2)** / **0.031 (/v2/register)** — separates ~4× either side.
**Honest caveat (mutant decides):** for THIS bug-class the console signal always fires and fires
first, so in the combined test the console assertion short-circuits before CLS. CLS's *independent*
value is a **console-silent flash** (e.g. a naive "fix" that moves the auth check into a post-mount
useEffect+setState — no hydration error, but a visible shift). I have NOT yet produced a mutant that
trips CLS while the console stays clean, so CLS is **measured + correlated, not independently
teeth-proven**. → มุน (visual owner) ratifies whether CLS ships **blocking** or **advisory**.

## Dropped from the hole-map (mutant DISPROVED it)
**"ban suppressHydrationWarning"** — tested directly: a `suppressHydrationWarning` wrapper on both
render branches did NOT silence the mismatch (hydErr stayed 5, CLS stayed 0.027). React only
suppresses element-level text/attr diffs, never a structural tree mismatch. It guards a non-threat
for our bug-class, so it is not in the anchor. (Per bong: the mutant decides, not the hole-map.)

## Seam sign-off (3 lenses, each covers what the others miss)
- **goo-runtime** (console/state, all gated pages) — ✅ built + mutant-proven
- **too-static** (coverage-drift derived guard) — ✅ built self-deriving in the anchor; **ตู๋ to review** whether the canonical home is here or `verify-architecture.ts`
- **มุน-visual** (CLS budget) — ✅ measured; **มุน to ratify** blocking-vs-advisory + the 0.015 threshold

Adversary sign-off (another oracle tries to sneak a mismatch past) still required before "teeth-proven".
