// Renders nothing. Mounted once in pages/_app.tsx next to <IdentitySelfHeal/>, and for the same reason
// that one is global: the member id is minted in two places (pages/index.tsx and
// lib/auth/use-self-heal-identity.ts) and neither should know about analytics. This component watches
// the OUTCOME — cookie-truth `status` from useCurrentUser flipping to 'authed' — and does three things
// once per login in this browser (CIEL mootech-ga4-instrumentation-001, D2/D3):
//
//   1. asks /api/v2/analytics/identity for the keyed user_id + stored consent (cookies land server-side);
//   2. pushes { user_id, member_state: 'member' } to the dataLayer so hits from now on carry the person;
//   3. sends the `login` event with the provider the user chose (cookie-mumate-provider-login).
//
// "Once per login" is the absence of the `mumate-aid` cookie while authed: a fresh login has none, a
// page reload has one, a logout clears it below so the next login fires again. That is exactly GA's
// meaning of `login` — a session that established an identity — and never "a page loaded".
//
// On a settled 'anon' the identity cookies are removed so a shared device does not keep counting the
// previous person. Nothing here runs before hydration or during 'loading' (the login-loop invariant).
import { useEffect, useRef } from 'react'
import { useCookies } from 'react-cookie'
import { CookieKey } from '@/constants/cookie-key'
import { useCurrentUser } from '@/lib/auth/use-current-user'
import { track } from '@/lib/analytics/track'
import { ANALYTICS_CONSENT_COOKIE } from '@/lib/analytics/consent'

const ANALYTICS_ID_COOKIE = 'mumate-aid'
const KNOWN_METHODS = new Set(['line', 'google', 'facebook'])

function loginMethod(raw: unknown): string {
  const m = String(raw ?? '').toLowerCase()
  return KNOWN_METHODS.has(m) ? m : 'unknown'
}

const LOGIN_SENT_FLAG = 'mumate-login-sent'

function sessionFlag(): boolean {
  try { return window.sessionStorage.getItem(LOGIN_SENT_FLAG) === '1' } catch { return false }
}
function setSessionFlag(on: boolean): void {
  try { on ? window.sessionStorage.setItem(LOGIN_SENT_FLAG, '1') : window.sessionStorage.removeItem(LOGIN_SENT_FLAG) } catch { /* private mode */ }
}

export default function AnalyticsIdentity(): null {
  const { status } = useCurrentUser()
  const [cookies, , removeCookie] = useCookies([ANALYTICS_ID_COOKIE, ANALYTICS_CONSENT_COOKIE, CookieKey.LOGIN_PROVIDER])
  const inFlight = useRef(false)
  const hasAid = Boolean(cookies[ANALYTICS_ID_COOKIE])

  useEffect(() => {
    if (status === 'anon') {
      if (hasAid) removeCookie(ANALYTICS_ID_COOKIE, { path: '/' })
      setSessionFlag(false)
      return
    }
    // A reload with the id cookie present is not a login. The session flag covers the one case where
    // the cookie cannot appear — ANALYTICS_USER_ID_KEY unset, or the identity call failing — so a
    // member is not counted as logging in on every page while that lasts.
    if (status !== 'authed' || hasAid || sessionFlag() || inFlight.current) return
    inFlight.current = true
    const method = loginMethod(cookies[CookieKey.LOGIN_PROVIDER])
    void (async () => {
      try {
        const r = await fetch('/api/v2/analytics/identity', { cache: 'no-store' })
        if (!r.ok) return
        const j = (await r.json().catch(() => null)) as { aid?: string | null } | null
        const w = window as Window & { dataLayer?: unknown[] }
        w.dataLayer = w.dataLayer ?? []
        if (j?.aid) w.dataLayer.push({ user_id: j.aid, member_state: 'member' })
        track('login', { method })
        setSessionFlag(true)
      } catch {
        // Analytics never blocks a screen. A failed identity call means this login goes uncounted; the
        // next page load retries because neither the cookie nor the flag is set.
      } finally {
        inFlight.current = false
      }
    })()
  }, [status, hasAid, cookies, removeCookie])

  return null
}
