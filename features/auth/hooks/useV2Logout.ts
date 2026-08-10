// MuMate v2 — logout action (logic seam). Lamun owns the confirm-modal UI + open/close state; this
// hook owns the SIDE-EFFECT only: clear the identity cookies then sign out. Provisional per the slice-2
// freeze ("หาวิธีดีกว่าทีหลัง"). Mirrors v1 menu.tsx handleLogout: wipe MEMBER_* + LOGIN_PROVIDER,
// then next-auth signOut. callbackUrl lands back inside the /v2 subtree (not the legacy "/").
import { useCallback } from 'react'
import { useCookies } from 'react-cookie'
import { signOut } from 'next-auth/react'
import { CookieKey } from '@/constants/cookie-key'
import { clearUserCache } from '@/lib/v2/user-cache'
import { clearDayDetailCache } from '@/features/v2-calendar/hooks/day-detail-cache'
import { clearMonthCache } from '@/features/v2-calendar/hooks/month-cache'
import { clearChartCache } from '@/features/auth/hooks/chart-cache'
import { clearSummaryCache } from '@/features/v2-first-run/hooks/summary-cache'

// Every cookie that carries identity/display — MEMBER_ID is identity-truth, the rest are satellites.
// LOGIN_PROVIDER must go too, else a stale `=DEV` marker would make the self-heal skip re-registration.
const IDENTITY_COOKIES = [
  CookieKey.MEMBER_ID,
  CookieKey.MEMBER_NAME,
  CookieKey.MEMBER_SURNAME,
  CookieKey.MEMBER_IMAGE,
  CookieKey.MEMBER_REFER_CODE,
  CookieKey.LOGIN_PROVIDER,
] as const

export type V2Logout = { logout: () => void }

export function useV2Logout(): V2Logout {
  const [, , removeCookie] = useCookies([...IDENTITY_COOKIES])

  const logout = useCallback(() => {
    // Clear identity FIRST (path '/' — the same scope they were written with) so that even if the
    // signOut redirect is slow, useCurrentUser already resolves 'anon' and no gated page renders authed.
    for (const name of IDENTITY_COOKIES) removeCookie(name, { path: '/' })
    // Abandon any in-flight /api/user fetch for the old identity (useV2User dedup cache) so the next login
    // on this machine starts clean — a late-resolving old fetch cannot feed the next person's session.
    clearUserCache()
    clearDayDetailCache() // drop the previous identity's cached days too (deterministic cache, but per-person)
    clearMonthCache() // and the persisted (localStorage) month cache — next person on this machine starts clean (DoD #6)
    clearChartCache() // and the in-memory home chart cache (P3 DoD#5) — next identity gets no stale mascot
    clearSummaryCache() // and the first-run reading prefetch (#233 C3) — next identity gets no stale reading
    // signOut settles the next-auth session; land back on the /v2 preview entry, not the legacy "/".
    signOut({ callbackUrl: '/v2' })
  }, [removeCookie])

  return { logout }
}
