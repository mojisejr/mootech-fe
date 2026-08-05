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
import { useV2User } from './useV2User'
import { computeTier, type V2Tier } from '@/lib/v2/tier'

export function useV2Tier(): V2Tier {
  // Single, page-shared /api/user fetch (dedup in useV2User). Same reducer inputs as before the extraction.
  const { userId, done, errored, user } = useV2User()

  // SSR-safe gate: false on the server + the first client render, true after the mount effect. Until then
  // the tier reads `null` (see the header) so no branch commits before the cookie is actually readable.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return { isPaid: null, loading: true }
  return computeTier({ userId, done, errored, user })
}
