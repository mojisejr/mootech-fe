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

// Land back on /v2 (NOT /v2/register): /v2's useV2Home now routes returning(has-chart)→home vs
// new(no-chart)→/v2/register (parity gap C). Sending everyone straight to /v2/register was the bug —
// a returning user re-did profile setup instead of seeing their home.
const V2_LOGIN_CALLBACK = '/v2'

// Copied from pages/login (defined inline there, not exported) — LINE's in-app webview UA.
const isLineInAppBrowser = () =>
  typeof navigator !== 'undefined' && /\bLine\//i.test(navigator.userAgent)

// เอ็ม 2026-09-20 (สมัครใหม่ด้วย LINE ครั้งแรกพัง — "เข้าสู่ระบบไม่สำเร็จ / รหัสอ้างอิง: undefined"):
// next-auth's signIn() ยิง fetch('/api/auth/providers') เองก่อนเปิดหน้า OAuth เสมอ — ถ้า fetch นั้นพลาด
// (มักเกิดกับ cold-start ครั้งแรกในเว็บบราวเซอร์ของแอป LINE ซึ่งเป็นเคสของ "user ใหม่ที่ไม่เคยใช้") มันจะ
// เด้งไป /api/auth/error โดยไม่มี query เลย (error=ค่า undefined จริงๆ ไม่ใช่ string) → เพจ /auth/error ของเรา
// โชว์ "รหัสอ้างอิง: undefined" — เกิดก่อนถึงหน้า LINE OAuth ด้วยซ้ำ ไม่เกี่ยวกับ callback/session ใดๆ เลย.
// แก้: ลอง fetch เส้นเดียวกันเองก่อน (พร้อม retry สั้นๆ) เผื่อ warm-up การเชื่อมต่อให้ผ่านก่อนค่อยเรียก signIn()
// จริง — ลด race ของ cold-start ได้มาก โดยไม่เปลี่ยน public API ของ hook นี้ (ถ้า retry ครบแล้วยังไม่ผ่าน ก็ยัง
// เรียก signIn() ต่อเหมือนพฤติกรรมเดิม ไม่แย่ไปกว่าก่อนแก้).
export async function ensureAuthProvidersReachable(retries = 2, delayMs = 350): Promise<void> {
  for (let i = 0; i <= retries; i += 1) {
    try {
      const res = await fetch('/api/auth/providers', { credentials: 'same-origin' })
      if (res.ok) return
    } catch {
      /* เครือข่ายพลาด — ลองรอบถัดไป */
    }
    if (i < retries) await new Promise((r) => setTimeout(r, delayMs))
  }
}

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
    void ensureAuthProvidersReachable().finally(() => {
      signIn(provider, { callbackUrl: V2_LOGIN_CALLBACK })
    })
  }

  return {
    loading,
    onLine: () => login('line'),
    onGoogle: () => login('google'),
  }
}
