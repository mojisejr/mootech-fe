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
import { useCookies } from 'react-cookie'
import { startOAuthRedirect } from '@/lib/auth/oauth-redirect'
import { openInExternalBrowser } from '@/lib/line/liff'
import { CookieKey } from '@/constants/cookie-key'
import { CONFIG } from '@/constants/config'

// Land back on /v2 (NOT /v2/register): /v2's useV2Home now routes returning(has-chart)→home vs
// new(no-chart)→/v2/register (parity gap C). Sending everyone straight to /v2/register was the bug —
// a returning user re-did profile setup instead of seeing their home.
const V2_LOGIN_CALLBACK = '/v2'

// โปรฯ landing: /v2/login?next=<path> → หลังล็อกอินเด้งกลับหน้านั้น (เช่น checkout ที่กรอกโค้ดไว้แล้ว).
// 🔴 กัน open-redirect: รับเฉพาะ path ภายในเว็บนี้ — ขึ้นต้น '/' ตัวเดียว, ห้าม '//' หรือมี '://' (โดเมนอื่น).
// next-auth เองก็รับ callbackUrl แค่ same-origin อยู่แล้ว แต่ validate ตรงนี้ด้วยกัน redirect หลุดออกนอก.
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== 'string' || next === '') return null
  if (!next.startsWith('/') || next.startsWith('//')) return null
  if (next.includes('://') || next.includes('\\')) return null
  return next
}

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
  // 🔴 2026-09-28: ถอด next ออกจาก OAuth callback ชั่วคราว — การส่ง callbackUrl เป็น URL checkout (มี query)
  // ทำให้ LINE login ค้างทั้งเว็บตรง/LIFF (เอ็มพบ). คืนเป็น /v2 (เส้นทางที่ทำงานเดิม). การเด้งกลับหน้า 159
  // จะทำใหม่แบบปลอดภัยผ่าน /v2 (ไม่ยัดใน OAuth callbackUrl). safeNextPath คงไว้ (มีเทสต์) แต่ยังไม่ใช้กับ callback.
  const callbackUrl = V2_LOGIN_CALLBACK

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
      // เอ็ม 2026-09-22 (LINE LIFF browser): Google บล็อกใน LINE webview (disallowed_useragent). เดิมใช้
      // window.location = ...?openExternalBrowser=1 แต่ query param นี้ "ไม่ทำงานใน LIFF" → คลิกแล้วรีโหลด
      // หน้าเดิม (ปุ่มเหมือนกดไม่ได้). แก้: เปิดเบราว์เซอร์ภายนอกด้วย liff.openWindow({external:true}) ผ่าน
      // openInExternalBrowser (fallback window.open ถ้าไม่ใช่ LIFF) → ผู้ใช้ไปล็อกอิน Google ต่อข้างนอกได้จริง.
      void openInExternalBrowser(`${window.location.origin}/v2/login`)
      return
    }

    setLoading(true)

    // 🔴 2026-10-01: ถอดการล็อกอินผ่าน LIFF (#846) — ช่อง LIFF อยู่คนละ LINE Provider กับช่อง Login → LINE userId (sub)
    // ไม่ตรงกัน → คนเดิมกลายเป็น "คนใหม่" (บัญชีซ้ำ / เด้งหน้า welcome-back). กลับมาใช้ OAuth ช่อง Login อย่างเดียว
    // จนกว่าจะย้าย LIFF app ไปอยู่ใน Provider เดียวกับ LINE_CLIENT_ID.
    // เลี่ยง getProviders ของ signIn() ทั้งหมด (ต้นเหตุ "รหัสอ้างอิง: undefined") — เริ่ม OAuth ด้วย full-page
    // form POST ตรงไป /api/auth/signin/<provider> ให้เบราว์เซอร์เดินตาม 302 เอง. ดู oauth-redirect.ts
    //
    // เอ็ม 2026-09-20: เคยลองใส่ disable_auto_login=true (#727) เพื่อกัน LINE เด้งเปิดแอป — แต่ผลคือมันบังคับ
    // ขึ้นหน้า "อีเมล/รหัสผ่าน" ของ LINE ซึ่งคนที่จำ LINE ไม่ได้เข้ายากมาก. ถอดออก → กลับไปใช้ auto-login ของ
    // LINE (แตะทีเดียวผ่านแอป). ทางที่ลื่นที่สุด = เปิดจากใน LINE (OA rich menu) ให้อยู่ใน in-app browser.
    void startOAuthRedirect(provider, callbackUrl)

    // เอ็ม 2026-09-28: cold-start ใน LINE webview — หน้า access.line.me ค้างรอบแรก, กดซ้ำรอบสองผ่าน ("ต้องกด 2 รอบ").
    // ทำ "รอบสอง" ให้อัตโนมัติ: ถ้า 6 วิแล้วยังอยู่หน้านี้ (ไม่ได้ไปต่อ) → ยิงใหม่ 1 ครั้ง; 14 วิยังค้าง → ปลดปุ่มให้กดเองได้.
    // ออกจากหน้าไปแล้ว (pagehide) → ยกเลิก timer ทั้งหมด.
    const retry = window.setTimeout(() => {
      if (document.visibilityState === 'visible') void startOAuthRedirect(provider, callbackUrl)
    }, 6000)
    const unlock = window.setTimeout(() => setLoading(false), 14000)
    window.addEventListener('pagehide', () => { window.clearTimeout(retry); window.clearTimeout(unlock) }, { once: true })
  }

  return {
    loading,
    onLine: () => login('line'),
    onGoogle: () => login('google'),
  }
}
