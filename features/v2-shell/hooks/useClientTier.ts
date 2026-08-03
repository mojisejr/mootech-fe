// features/v2-shell/hooks/useClientTier.ts — useV2Tier, but safe to branch layout on during SSR.
//
// THE BUG THIS EXISTS FOR (measured, not theorised — see harness/tier-gate.verify-evidence.md):
// these pages are server-rendered, and on the server `useCookies` has no cookie jar, so useV2Tier's
// `userId` is ''. computeTier reads an empty userId as "there is no account, therefore certainly not a
// paying member" — correct as a pure function, and exactly wrong as a server answer. The server was
// therefore asserting KNOWN-FREE for everybody:
//
//   curl /v2/calendar with a real session cookie → the HTML came back containing calendar-promo AND
//   header-upgrade. A paying member was shipped an upsell in their markup, and React then threw a
//   hydration mismatch when the client disagreed.
//
// So the tier is only trusted once the component has mounted on the client, where the cookie actually
// exists. Before that it reads as `null` — the same "not determined" state the gate already handles by
// showing neither branch, which means the server and the client's first pass render the identical tree.
//
// This wrapper is deliberately NOT a change to goo's useV2Tier: the paid rule and its hook are his seam
// and I only consume them. Whether the SSR guard belongs inside the hook itself (so the next consumer
// cannot step on this) is his call — reported to him with the curl above rather than decided here.
import { useEffect, useState } from 'react'
import { useV2Tier } from '@/features/auth/hooks/useV2Tier'
import type { V2Tier } from '@/lib/v2/tier'

export function useClientTier(): V2Tier {
  const tier = useV2Tier()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? tier : { isPaid: null, loading: true }
}
