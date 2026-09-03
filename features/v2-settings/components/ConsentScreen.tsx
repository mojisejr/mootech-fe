// features/v2-settings/components/ConsentScreen.tsx — /v2/privacy/consent (เฟรม privacy-consent)
// โชว์ประวัติความยินยอมจริงจาก engine + ยืนยัน/ถอนความยินยอม PDPA (บันทึก insert-only — มีประวัติเสมอ)
import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { AppHeader } from '@/features/v2-shell/components/AppHeader'
import { useV2Tier } from '@/features/auth/hooks/useV2Tier'
import { ProfileGate } from '@/features/v2-account/components/ProfileGate'

const CARD = 'flex w-full flex-col rounded-[20px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]'

type Consent = { kind: string; version: string; accepted: boolean; createdAt: string }
const PDPA_VERSION = '2026-09'

export function ConsentScreen() {
  const tier = useV2Tier(false)
  const [consents, setConsents] = useState<Consent[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<'ok' | 'not_authenticated' | 'failed'>('ok')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setKind('ok')
    try {
      const res = await fetch('/api/consent')
      if (res.status === 401) {
        setKind('not_authenticated')
        return
      }
      if (!res.ok) {
        setKind('failed')
        return
      }
      const j = (await res.json()) as { consents?: Consent[] }
      setConsents(j.consents ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const latestPdpa = consents?.find((c) => c.kind === 'pdpa') ?? null
  const pdpaActive = latestPdpa?.accepted === true && latestPdpa.version === PDPA_VERSION

  const setConsent = async (accepted: boolean) => {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'pdpa', version: PDPA_VERSION, accepted }),
      })
      setMsg(res.ok ? (accepted ? 'บันทึกความยินยอมแล้ว' : 'ถอนความยินยอมแล้ว — บริการบางส่วนอาจได้รับผลกระทบ') : 'บันทึกไม่สำเร็จ')
      if (res.ok) await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <Head><title>ความยินยอม (PDPA) · MuMate</title></Head>
      <AppHeader testId="consent-header" title="ความยินยอม (PDPA)" backHref="/v2/settings" membership={tier} upgradeCta={false} className="items-center py-4" />

      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-36 pt-2">
        <ProfileGate loading={loading} kind={kind} onRetry={() => void load()} />

        {!loading && kind === 'ok' && (
          <>
            <section className={CARD} data-testid="consent-current">
              <p className="text-[13px] font-bold text-v3-navy">นโยบายความเป็นส่วนตัว เวอร์ชัน {PDPA_VERSION}</p>
              <p className="text-[13px] leading-5 text-v3-text-body" data-testid="consent-state">
                {pdpaActive ? 'คุณให้ความยินยอมอยู่ ✓' : latestPdpa ? 'คุณถอนความยินยอมอยู่' : 'ยังไม่มีการบันทึกความยินยอม'}
              </p>
              <Link href="/privacy/policy" data-testid="consent-policy-link" className="text-[13px] font-bold text-v3-cyan">
                อ่านนโยบายฉบับเต็ม →
              </Link>
              <div className="flex gap-2">
                {!pdpaActive ? (
                  <button
                    onClick={() => void setConsent(true)}
                    disabled={busy}
                    data-testid="consent-accept"
                    className="h-11 flex-1 rounded-full bg-v3-cyan text-sm font-bold text-white disabled:opacity-40"
                  >
                    ให้ความยินยอม
                  </button>
                ) : (
                  <button
                    onClick={() => void setConsent(false)}
                    disabled={busy}
                    data-testid="consent-withdraw"
                    className="h-11 flex-1 rounded-full border border-v3-border-card text-sm font-bold text-v3-navy disabled:opacity-40"
                  >
                    ถอนความยินยอม
                  </button>
                )}
                <Link href="/v2/privacy/data-export" data-testid="consent-export-link" className="grid h-11 flex-1 place-items-center rounded-full border border-v3-border-card text-sm font-bold text-v3-navy">
                  ส่งออกข้อมูลของฉัน
                </Link>
              </div>
              {msg && <p data-testid="consent-msg" className="text-[12px] font-bold text-v3-sapphire">{msg}</p>}
            </section>

            {consents && consents.length > 0 && (
              <section className={CARD} data-testid="consent-history">
                <p className="text-[13px] font-bold text-v3-navy">ประวัติความยินยอม</p>
                <ul className="flex flex-col divide-y divide-v3-border-card">
                  {consents.map((c, i) => (
                    <li key={`${c.kind}-${c.createdAt}-${i}`} className="flex items-center justify-between py-2 text-[13px]">
                      <span className="min-w-0 flex-1 truncate text-v3-text-body">
                        {c.kind === 'pdpa' ? 'นโยบายความเป็นส่วนตัว' : c.kind} · v{c.version}
                      </span>
                      <span className={'flex-none font-bold ' + (c.accepted ? 'text-v3-sapphire' : 'text-v3-error')}>
                        {c.accepted ? 'ยอมรับ' : 'ถอน'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default ConsentScreen
