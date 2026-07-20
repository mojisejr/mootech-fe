// MuMate v2 — login wiring hook. WRAPS the existing next-auth machine (does NOT rewrite it — the
// machine has a fragile login-loop history). Mirrors pages/login's handleLogin, with ONE change:
// the OAuth callbackUrl lands back INSIDE the gated /v2 subtree (`/v2/register`) instead of the
// legacy `/auth/after/<provider>` → `/` path, so the preview flow stays within /v2.
//
// Identity (MEMBER_ID) is NOT minted by this flow directly — it's minted by the GLOBAL self-heal
// (_app.tsx <IdentitySelfHeal/> → useSelfHealIdentity) once the user lands on /v2/register
// authenticated-but-without-MEMBER_ID. Verified: the self-heal is mounted globally and exists
// precisely for "deep-link pages that skipped /". So we deliberately skip `/` and let it heal.
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useCookies } from 'react-cookie'
import { CookieKey } from '@/constants/cookie-key'
import { CONFIG } from '@/constants/config'

const V2_LOGIN_CALLBACK = '/v2/register'

// Copied from pages/login (defined inline there, not exported) — LINE's in-app webview UA.
const isLineInAppBrowser = () =>
  typeof navigator !== 'undefined' && /\bLine\//i.test(navigator.userAgent)

// The seam Lamun's LoginView binds to: two provider callbacks + a loading flag.
export type V2LoginApi = {
  loading: boolean
  onLine: () => void
  onGoogle: () => void
}

export function useV2Login(): V2LoginApi {
  const [, setCookie] = useCookies([CookieKey.LOGIN_PROVIDER])
  const [loading, setLoading] = useState(false)

  const login = (provider: string) => {
    setCookie(CookieKey.LOGIN_PROVIDER, provider, {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })

    // Google OAuth is blocked inside LINE's in-app webview (disallowed_useragent — permanent Google
    // policy). Escort out to the OS browser, same as legacy /login (minus the consent modal, which
    // is Lamun's UI to port). ⚠️ known limitation: the external browser won't carry the team
    // `v2_access` cookie, so a Google-in-LINE-webview tester re-enters the preview passkey there —
    // acceptable for an internal preview; revisit if it bites.
    if (provider === 'google' && isLineInAppBrowser()) {
      window.location.href = `${window.location.origin}/v2/login?openExternalBrowser=1`
      return
    }

    setLoading(true)
    signIn(provider, { callbackUrl: V2_LOGIN_CALLBACK })
  }

  return {
    loading,
    onLine: () => login('line'),
    onGoogle: () => login('google'),
  }
}
