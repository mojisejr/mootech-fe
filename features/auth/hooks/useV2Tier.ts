// useV2Tier — the page-agnostic paid-tier seam (μุน Zone-4). Any v2 page (service / calendar / …) reads
// { isPaid, loading } from here to gate free-vs-paid content, WITHOUT useV2Home's routing/redirect (that
// hook also bounces a no-chart user to /register — unusable outside home). The paid rule lives once in
// lib/v2/tier.ts (isPaidMember); this hook feeds the fetched user into the pure computeTier reducer.
//
// IDENTITY FETCH is now owned by useV2User (goo · G-0c #165): the /api/user fetch is de-duplicated across
// every hook on the page (calendar mounts BOTH this and useCalendarMonth), so one identity = one request.
// The de-dup is in-flight ONLY (lib/v2/user-cache) — no stored row, so a later mount always re-fetches a
// FRESH row (a paid user who just paid is not stuck on a stale free gate). Behaviour here is unchanged: the
// exact same { userId, done, errored, user } still flow into computeTier, so all four consumers see the
// identical isPaid — including `null` = not-determined, which the gate must never guess in either direction.
//
// SSR-SAFE BY DEFAULT (μุน found this on #171): an empty `userId` on the SERVER does NOT mean "no account"
// — it means the cookie is unreadable in THIS render context (react-cookie has no jar during SSR). So the
// tier is trusted only once MOUNTED on the client: before mount (SSR + first client pass) it reads `null`,
// the gate renders NEITHER branch, server and client-first render an identical tree (no hydration mismatch)
// and no page ships a paid member the free/upsell branch. Guarding here (not per-page) means the next SSR
// consumer cannot silently re-step the leak.
//
// Home note: home already fetches the user via useV2Home and derives isPaid from `profile.showUpgrade` —
// it does NOT call this hook, keeping home's single UserGetById (#165). useV2Tier is for the other pages.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useV2User } from './useV2User'
import { useCurrentUser } from '@/lib/auth/use-current-user'
import { computeTier, resolveDisplayTier, type V2Tier } from '@/lib/v2/tier'
import { resolveTierOverride } from '@/lib/v2/tier-override'

// `teamPreview` (issue #225): may this render honour a `?tier=` override? It is the v2 gate verdict for
// THIS request — the page's getServerSideProps computes it from the httpOnly v2_access cookie (via
// isV2TeamPreview) and drills it down, because the cookie is unreadable by client JS. It replaces the
// #213 `NODE_ENV !== 'production'` guard so the override works on prod for anyone past the team passkey,
// while a non-team visitor (flag false — the default) is never affected. Default false = fail-safe: a
// caller that forgets to thread the flag gets NO override, not an accidental leak.
export function useV2Tier(teamPreview = false): V2Tier {
  // Single, page-shared /api/user fetch (dedup in useV2User). Same reducer inputs as before the extraction.
  const { userId, done, errored, user } = useV2User()
  // resolveAuth verdict — distinguishes true anon from identity-limbo (#246). Without it computeTier saw
  // only userId='' for BOTH and answered KNOWN-free, showing a paying user in limbo the upsell.
  const { status } = useCurrentUser()
  const router = useRouter()

  // SSR-safe gate: false on the server + the first client render, true after the mount effect. Until then
  // the tier reads `null` (see the header) so no branch commits before the cookie is actually readable.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Pre-mount stays `null` (SSR-safe): the override is read only AFTER mount, so a `?tier=` param can never
  // change the server/first-client render — no hydration mismatch, and the "null must stay null" line below
  // is never reached before we even have a determined tier.
  if (!mounted) return { isPaid: null, tier: null, loading: true }
  const base = computeTier({ status, userId, done, errored, user })

  // Team-preview URL override (issue #225, was #213): view a page as free/paid from `?tier=`. Gated by the
  // server-verified `teamPreview` flag instead of NODE_ENV, so it ships in the prod bundle and works there —
  // but only for a request that carried a valid v2_access cookie (isV2TeamPreview in getServerSideProps).
  // 🔴 Closing-criterion mutant: delete this `if (teamPreview)` guard → case ② in scripts/v2-tier.test.ts
  // (flag false + ?tier=paid must not move) goes RED. The page-wiring twin (that a page actually SENDS the
  // flag) is proven separately in scripts/tier-prod-pages.test.tsx.
  if (teamPreview) {
    const override = resolveTierOverride(router.query.tier)
    // no/junk param → leave base untouched. 🔴 And never manufacture certainty: a null (loading/error) tier
    // stays null — the override only flips a KNOWN true/false, the very thing a previewer wants to swap.
    // #383 — the NAME must not contradict the previewed flag, so it goes through the SAME reconciler every
    // other consumer uses instead of a hand-written rule here. (ตู๋ B1: the hand-written version only
    // handled `override === false`. Forcing "paid" onto a user whose v2 row says FREE handed the caller
    // `{ isPaid: true, tier: 'FREE' }` — the exact pair lib/v2/tier.ts declares unreachable. A second copy
    // of a rule is how the copy that was not thought through hard enough ships.)
    if (override !== null && base.isPaid !== null) {
      return { ...base, isPaid: override, tier: resolveDisplayTier(override, base.tier) }
    }
  }
  return base
}
