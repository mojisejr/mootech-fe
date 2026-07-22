# Ledger entry + proof-of-teeth — v2 auth-gate hydration (webgang v2 rollout step 1, goo)

Co-located evidence for `e2e/v2-hydration-invariant.spec.ts`. The canonical shared bug-history
ledger location is a team decision (proposed: `oracle-skills` overlay); this file is the entry +
run-record for THIS anchor until the shared ledger is frozen (step 2).

## bug-history ledger entry (provisional schema v0)

```yaml
- id: v2-authgate-hydration-mismatch
  invariant: "server-rendered HTML === client first-paint HTML for any useV2AuthGate-gated /v2 page;
              cookie-mumate-id is identity-truth but invisible to SSR, so the render must be held on
              a mount-gate until after hydration"
  injection_recipe: "strip `!hasMounted || ` from useV2AuthGate.showLoading — server renders
                     AuthLoadingGate (status='loading', cookie unseen), client first paint renders
                     home (status='authed', cookie seen) → mismatch"
  bug_class: seam                 # lived BETWEEN goo's hook (runtime) and the page render (มุน visual)
  gate_should_catch: goo-runtime  # + มุน-visual — seam = 2 owners (schema has only ONE slot: see feedback)
  reached: team                   # Lamun caught @393 (dev overlay), before ฟี ม
  triage: verify-hole             # ground-truth existed (console hydration error); my render-only gate missed it
  commit_hash: 1feafc5            # the FIX commit (mount-gate); bug lived in the pre-fix state
  schema_version: 0
```

## proof-of-teeth (capability-scoped: runtime hydration class only)

Runtime mutant, history-independent (applied to CURRENT code, not a checkout). Verified by hand this
build against FE :3000 (`V2_PREVIEW_KEY=lamun-local-dev`, cookies `v2_access` + a valid-uuid
`cookie-mumate-id`):

| step | code state | anchor result |
|---|---|---|
| 1 | fix in place (`!hasMounted` present) | ✓ PASS (0 hydration signals) |
| 2 | mutant applied (`!hasMounted` stripped) | ✘ FAIL — `Hydration failed because the initial UI does not match what was rendered on the server` |
| 3 | reverted | ✓ PASS (hook clean, 0 changed lines) |

Step 2 is the **negative control**: it proves the anchor is non-vacuous. A render-only assertion
(`toBeVisible`) passes in ALL three states — that is exactly the hole Lamun's @393 catch exposed and
this anchor closes: it asserts on the console/pageerror channel a render assertion is blind to.

## adversary sign-off

Pending — a different oracle (ตู๋ or มุน) must try to sneak a hydration mismatch PAST this anchor
(e.g. a mismatch that emits no console signal, or one on a /v2 page the anchor doesn't visit) and
record what they tried. Per the frame, a new anchor cannot merge as "teeth-proven" on the author's
word alone.
