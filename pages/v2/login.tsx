// MuMate v2 — /v2/login (Slice 1). Team-gated (SSR). Client identity + hydration via useV2AuthGate
// (mount-safe: no SSR mismatch; authed → /v2; login-loop invariant preserved). WRAPS next-auth via
// useV2Login (no rewrite). Figma "03-register" (route-swap: Figma register = code /login).
import { useEffect, useState } from 'react'
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { useV2AuthGate } from '@/features/auth/hooks/useV2AuthGate'
import { AuthLoadingGate } from '@/features/v2-shell/components/AuthLoadingGate'
import ScreenIdentityStuck from '@/components/screen-identity-stuck'
import { LoginView } from '@/features/auth/components/LoginView'
import { OpenInBrowserScreen } from '@/features/auth/components/OpenInBrowserScreen'
import { useV2Login } from '@/features/auth/hooks/useV2Login'
import { loginErrorNotice } from '@/lib/auth/login-error'
import { openInExternalBrowser } from '@/lib/browser/open-external'
import { REFERRAL_KEY, STAY_IN_APP_KEY, cleanRef, escapeLabels, loginEscapeUrl } from '@/lib/browser/login-escape'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req) // team preview gate
  if (redirect) return redirect
  return { props: {} }
}

function readStorage(store: 'local' | 'session', key: string): string | null {
  try {
    return (store === 'local' ? window.localStorage : window.sessionStorage).getItem(key)
  } catch {
    return null
  }
}

function writeStorage(store: 'local' | 'session', key: string, value: string): void {
  try {
    ;(store === 'local' ? window.localStorage : window.sessionStorage).setItem(key, value)
  } catch {
    /* storage ปิด — ข้ามได้ */
  }
}

type Escape = { appName: string; browserName: string; url: string }

export default function V2LoginPage() {
  const { showLoading, identityStuck } = useV2AuthGate({ redirectWhenAuthed: '/v2' })
  const { loading, onLine, onGoogle } = useV2Login()
  // slice 7b: OAuth ที่พลาดกลับมาที่นี่พร้อม ?error= — เดิมไม่แสดงอะไร ผู้ใช้เห็นเป็น loop. อ่านหลัง mount (ใช้ UA).
  const { query, isReady } = useRouter()
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => {
    setNotice(loginErrorNotice(query.error, navigator.userAgent))
  }, [query.error])

  // slice 7c: เปิดจาก Facebook/Instagram → พาไปเบราว์เซอร์จริงก่อนเริ่ม OAuth (โค้ดเชิญติดไปเป็น ?ref=).
  // ฝั่งเบราว์เซอร์จริง: ?ref= → เก็บกลับ localStorage ให้หน้า register อ่านเหมือนเดิม.
  const [escape, setEscape] = useState<Escape | null>(null)
  const [escapeChecked, setEscapeChecked] = useState(false) // ยังไม่รู้ว่าต้องพาออกไหม → อย่าเพิ่งโชว์ปุ่มล็อกอิน
  useEffect(() => {
    if (!isReady) return
    const refFromUrl = cleanRef(query.ref)
    if (refFromUrl) writeStorage('local', REFERRAL_KEY, refFromUrl)
    const labels = escapeLabels(navigator.userAgent)
    if (!labels || readStorage('session', STAY_IN_APP_KEY) === '1') {
      setEscape(null)
    } else {
      const ref = refFromUrl ?? cleanRef(readStorage('local', REFERRAL_KEY))
      setEscape({ ...labels, url: loginEscapeUrl(window.location.origin, ref) })
    }
    setEscapeChecked(true)
  }, [isReady, query.ref])

  // #246 — authed-but-no-MEMBER_ID limbo would spin AuthLoadingGate forever here too. Offer re-login.
  if (identityStuck) return <ScreenIdentityStuck callbackUrl="/v2" />
  if (showLoading || !escapeChecked) return <AuthLoadingGate />

  if (escape) {
    return (
      <OpenInBrowserScreen
        appName={escape.appName}
        browserName={escape.browserName}
        onOpen={() => void openInExternalBrowser(escape.url)}
        onCopy={async () => {
          try {
            await navigator.clipboard.writeText(escape.url)
            return true
          } catch {
            return false
          }
        }}
        onStay={() => {
          writeStorage('session', STAY_IN_APP_KEY, '1')
          setEscape(null)
        }}
      />
    )
  }

  return (
    <LoginView
      onLine={onLine}
      onGoogle={onGoogle}
      // เอ็ม 2026-09-22: ลิงก์ "เข้าสู่ระบบ" เดิมผูก () => undefined = กดแล้วไม่เกิดอะไร (ผู้ใช้แจ้ง "กดเข้าสู่ระบบ
      // ไม่ได้"). returning user ล็อกอินด้วย OAuth ปุ่มเดิม (register-login เป็น upsert idempotent) → ผูกลิงก์นี้
      // ให้เริ่มล็อกอิน LINE (provider หลักของผู้ใช้ส่วนใหญ่) แทนการเป็นลิงก์ตาย.
      onExistingAccount={onLine}
      loading={loading}
      notice={notice}
    />
  )
}
