# verify-evidence — useV2Tier paid-tier seam (μุน Zone-4 free/paid gate)

goo · 2026-08-03 · branch `v2-tier-seam` · lane = logic/gate (μุน owns the gated UI)

**What shipped**: a page-agnostic paid-tier seam so ANY v2 page can gate free-vs-paid without useV2Home's
routing/redirect.
- `lib/v2/tier.ts` — PURE: `isPaidMember(source)` (the single paid rule) + `computeTier(...)` (the full state reducer) + `V2Tier` type.
- `features/auth/hooks/useV2Tier.ts` — thin hook: fetch `UserGetById` (cookie `MEMBER_ID`) → feed `computeTier`. Idempotent effect (alive guard, no doneRef — same discipline as useV2Home/#176). NO routing.
- `lib/home/profile.ts` — refactored `deriveHomeProfile.showUpgrade = !isPaidMember(user)` so the header badge and the tier gate share ONE rule (can never disagree). Behavior identical (home-profile.test.ts 7/7 green).

Contract: `useV2Tier(): { isPaid: boolean | null, loading }`. **`null` = not determined — do NOT gate on it**
(μุน's requirement: no guessing). `false` = KNOWN not-paid (free/anon). `true` = confirmed paid.

Did NOT touch useV2Home's routing, μุน's UI, or any endpoint.

## proof-of-teeth

Bug-class owned: **a paid-gate that GUESSES an unknown tier**. Unknown is wrong BOTH ways — read as free ⇒
a paying user loses paid content; read as paid ⇒ free user sees everything. So `computeTier` returns `null`
(not false) while loading AND on error, and never reports `true` without strict `is_not_expired === true`.

Mutants (cp-snapshot → mutate → run → restore), each must turn the suite RED:

| mutant | change | result |
|---|---|---|
| M1 error→free | error branch returns `isPaid:false` | 🔴 RED — `fetch error → isPaid=null (NOT false — do not hide paid content)` |
| M2 loading→free | loading branch returns `isPaid:false` | 🔴 RED — `loading → isPaid=null (…no free flash)` |
| M3 truthy rule | `isPaidMember` → `!!(...)` instead of `=== true` | 🔴 RED — `strict: string "true" is NOT paid` |
| (restore) | — | 🟢 `16 assertions passed` |

Neg-control (not vacuous): 16 assertions pass on the real code — the full state-table (no-account→false ·
loading→null · error→null · no-user→null · paid→true · free→false) plus the three explicit "never" guards.

ANCHOR: scripts/v2-tier.test.ts#v2-tier-gate-both-directions

## adversary sign-off

Cross-oracle, not self-certified. Claims I want ตู๋ (static/AST) + μุน (contract) to try to REFUTE:
- **no false-paid** — can `isPaid` be `true` without `payment.is_not_expired === true`? strict `=== true` rejects `"true"`, `1`, `{}`, truthy. `computeTier` only reaches the paid check on a settled non-errored user row.
- **no false-free** — can a transient error or an in-flight fetch read as `false` (hiding a paying user's content)? Both return `null`. Explicit "never false-while-loading / never false-on-error" assertions.
- **single rule, no drift** — the header badge (`showUpgrade`) and the tier gate both come from `isPaidMember`; a change to the rule moves both. (home-profile.test.ts still 7/7.)
- **no redirect leak** — useV2Tier must be usable off-home; it does NOT import/trigger any router redirect (unlike useV2Home which bounces a no-chart user to /register).

## evidence limits (what each artifact proves — and does NOT)

**Proven:** the PURE state-table — `isPaidMember` + `computeTier` — by 16 assertions + 3 teeth mutants;
tsc `--noEmit` exit 0; `verify-architecture` PASS; the profile refactor is behaviour-identical (home-profile
7/7). Cookie key (`cookie-mumate-id`) and `UserGetById` signature verified against useV2Home (the existing
proven fetcher this mirrors).

**NOT covered here (flagged honestly):** the **hook's fetch lifecycle rendered in a browser** — the
StrictMode double-invoke / alive-guard / userId-change reset path is tsc-checked and copies useV2Home's
already-proven idempotent pattern, but is NOT rendered-tested in this PR (no React test harness for it).
μุน exercises it when wiring the Zone-4 gate on a real page — recommend one browser pass (paid + free +
loading states) at that point to close the product loop. The pure reducer that decides the state is fully
covered; the React wiring around it is proven by mirror + tsc, not by render.
