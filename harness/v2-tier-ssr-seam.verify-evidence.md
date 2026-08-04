# verify-evidence — SSR-safety moved INTO the tier seam (useV2Tier)

goo · 2026-08-04 · branch `feat/v2-tier-ssr-seam` · base `d19966b` (after #171+#172) · lane = logic/seam

**What shipped** — the SSR mount-gate μุน added per-page in `useClientTier` (#171) now lives INSIDE
`useV2Tier`, so the seam is **SSR-safe by default** and no future SSR consumer can silently re-step the
leak. Root of the bug (μุน, measured): on the server `react-cookie` has no jar → `userId=''` →
`computeTier` answers KNOWN-FREE for everyone → a paid member's SSR HTML shipped the promo/upsell + a
hydration mismatch. `computeTier` is right (a pure function can't tell "no account" from "cookie unreadable
here"), so the fix belongs at the seam, not the reducer.

- `features/auth/hooks/useV2Tier.ts` — `mounted` gate: returns `{isPaid:null, loading:true}` on the server + first client pass, the reducer after mount. + comment: *empty userId on the server ≠ anon; it's "cookie unreadable in this context" — two meanings crammed into one value.*
- `features/v2-shell/hooks/useClientTier.ts` — reduced to a thin **re-export of useV2Tier** (its mount-gate is now redundant). Calendar-page imports keep working; not touched.
- `computeTier` / `isPaidMember` / the paid rule — **unchanged**.

## proof-of-teeth

Tooth **re-homed** from `mut-ssr-free` → `mut-ssr-seam` (agreed with μุน — a tooth must not be deleted, only
moved to where the guard moved). The two SSR teeth now watch different ends of the same bug-class:
- **`mut-ssr-seam` (goo, this PR)** — watches the **CAUSE**: remove the `mounted` gate inside `useV2Tier`
  (return `computeTier(...)` on the server pass too) → the seam commits a confident tier during SSR →
  `SSR-NEUTRAL` trips (server ships the free branch again). `harness/run-tier-gate.ts#mut-ssr-seam`.
- **`mut-ssr-paid-leak` (μุน, #172, kept untouched)** — watches the **EFFECT**: paid bytes on the wire of
  the day page. Still fires on `/v2/calendar/[date]`.

`mut-ssr-free` (revert `useClientTier`→`useV2Tier` direct) is now MOOT: `useV2Tier` is itself SSR-safe, so a
direct call is no longer unsafe — which is exactly why it re-homes to mutating the seam's gate instead.

ANCHOR: harness/run-tier-gate.ts#mut-ssr-seam

## adversary sign-off

Cross-oracle. The seam's tooth must be verified by someone other than its owner (charter: ฟันอยู่ในมือ
oracle อื่น). **μุน (runtime lens) runs `harness/run-tier-gate.ts`** to confirm, on this branch:
1. **60/60 checks still green** with the guard moved into the seam (SSR-NEUTRAL month + day, GATE-*, CLS, etc. unchanged — the behaviour is identical, only the guard's home moved).
2. **`mut-ssr-seam` bites**: remove the `mounted` gate in `useV2Tier` → `SSR-NEUTRAL` (month + day) turns red.
Points to attack: (a) does the seam gate change the CLIENT resolution at all? (it should not — after mount, output is exactly the old `computeTier`); (b) StrictMode double-mount with the added `mounted` state; (c) a client-only (non-SSR) consumer now gets one extra `null` pass for anon — confirm it settles to `false`.

## evidence limits (what I proved — and did NOT)

**Proven locally**: `tsc --noEmit` exit 0 · all `scripts/*.test.ts` green · `computeTier` unit 16/16
(unchanged) · `npm run build` green · diff = 2 production files (useV2Tier +gate, useClientTier→re-export)
+ harness/evidence/ledger. The mount-gate is **behaviourally identical to μุน's `useClientTier`** (same
`mounted?` gate) which μุน already proved on main via `SSR-NEUTRAL` — this PR only moves that proven guard
from the wrapper into the seam.

**NOT run by me (flagged honestly)**: I could **not run `run-tier-gate.ts` locally** — it needs a dev
server on `:3099`, and this machine's `MAINTENANCE_MODE` middleware rewrites every route to `/maintenance`
(the inline env override does not win under local `.env` precedence), so the SSR bytes come back as the
maintenance page, not the calendar. So **`mut-ssr-seam` biting + the 60/60 green on this branch are verified
by μุน** (harness owner, env ready, and — per the adversary contract — the seam's tooth should not be
self-certified). This is the same cross-oracle split as the original #171: μุน's runtime lens closes what
my logic lens cannot see from here.
