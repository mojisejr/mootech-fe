// ปีชง 2570 — the page (ciel-os workstream mumate-taisui-2570-001). The static frame and stylesheet come from
// preview D; taisui-motion.ts runs the scroll stage and fills every scene from the reading.
import { useEffect, useRef } from 'react'

import { useV2Login } from '@/features/auth/hooks/useV2Login'
import { track as trackEvent } from '@/lib/analytics/track'
import type { AnalyticsEventName } from '@/lib/analytics/events'
import { REFERRAL_KEY } from '@/lib/browser/login-escape'
import type { TaisuiReading } from '@/lib/taisui/types'
import { LINE_OA_URL } from '@/features/v2-qi/components/LineOaCard'
import { withFreshPass } from '../fresh-pass'
import { oaClaimFrom } from '../oa-claim'
import { leaveReturnMarker } from '../return'
import { TAISUI_CSS } from './taisui-css'
import { TAISUI_CSS_EXTRA } from './taisui-css-extra'
import { TAISUI_MARKUP } from './taisui-markup'
import { startTaisui, type Birth, type OaClaim, type Sender } from './taisui-motion'

export type TaisuiScreenProps = { refCode: string | null; sender: Sender }

const BIRTH_KEY = 'taisui:birth'

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
}

export function TaisuiScreen({ refCode, sender }: TaisuiScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const { onLine } = useV2Login()
  const loginRef = useRef(onLine)
  loginRef.current = onLine

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const stop = startTaisui(root, {
      hasRef: Boolean(refCode),
      sender,
      loadReading: async (birth?: Birth) => {
        // A birth typed before login is kept for this tab, so the member does not type it twice.
        let b = birth
        if (!b) { try { const s = sessionStorage.getItem(BIRTH_KEY); if (s) b = JSON.parse(s) as Birth } catch { /* none */ } }
        const tryOnce = async (withBirth: Birth | undefined) => {
          const body = { ...(withBirth ? { birth: withBirth } : {}), ...(refCode ? { partnerRef: refCode } : {}) }
          const r = await withFreshPass(() => postJson('/api/taisui/reading', body))
          return r.ok ? { ok: true as const, reading: (await r.json()) as TaisuiReading } : { ok: false as const, status: r.status }
        }
        // A member's saved chart wins over a typed one.
        if (!birth) { const saved = await tryOnce(undefined); if (saved.ok || !b) return saved }
        const res = await tryOnce(b)
        if (res.ok && birth) { try { sessionStorage.setItem(BIRTH_KEY, JSON.stringify(birth)) } catch { /* none */ } }
        return res
      },
      stats: async () => { const r = await fetch('/api/taisui/stats'); return r.ok ? r.json() : null },
      login: (birth) => {
        if (birth) { try { sessionStorage.setItem(BIRTH_KEY, JSON.stringify(birth)) } catch { /* none */ } }
        if (refCode) { try { if (!localStorage.getItem(REFERRAL_KEY)) localStorage.setItem(REFERRAL_KEY, refCode) } catch { /* none */ } }
        leaveReturnMarker(refCode)
        loginRef.current()
      },
      openPacket: async () => { if (!refCode) return null; const r = await postJson('/api/taisui/packet', { code: refCode }); return r.ok ? r.json() : null },
      sendPacket: async () => {
        const r = await fetch('/api/referral', { credentials: 'same-origin' })
        if (!r.ok) return null
        const j = (await r.json()) as { code?: string }
        return j.code ? { url: `${window.location.origin}/taisui-2570?ref=${encodeURIComponent(j.code)}&utm_source=packet&utm_medium=share` } : null
      },
      lantern: async (release) => {
        const r = release ? await postJson('/api/taisui/lantern', {}) : await fetch('/api/taisui/lantern')
        return r.ok ? r.json() : null
      },
      // The existing LINE OA reward (/api/v2/line-oa-claim): pays 100 QI once per member, after LINE confirms
      // the member is the OA's friend right now. Logged in with Google or an expired LINE token → nothing shown.
      claimOa: async (): Promise<OaClaim> => {
        const r = await fetch('/api/v2/line-oa-claim', { method: 'POST', credentials: 'same-origin' })
        return oaClaimFrom(r.status, await r.json().catch(() => null))
      },
      oaUrl: LINE_OA_URL,
      track: (event, params) => { trackEvent(event as AnalyticsEventName, params ?? {}) },
    })
    return stop
  }, [refCode, sender])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TAISUI_CSS + TAISUI_CSS_EXTRA }} />
      <div className="ts2570" ref={rootRef} dangerouslySetInnerHTML={{ __html: TAISUI_MARKUP }} />
    </>
  )
}
