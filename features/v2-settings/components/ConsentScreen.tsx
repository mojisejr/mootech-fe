// features/v2-settings/components/ConsentScreen.tsx — /v2/privacy/consent (เฟรม privacy-consent 55399:6275)
// 5 สวิตช์รายวัตถุประสงค์ (pdpa จำเป็น·ล็อก / history / analytics / marketing / ads) + กล่องผลกระทบ + ประวัติ.
// เก็บผ่าน engine `bazi_consent` (insert-only, คีย์ (anon_id, kind)) — ยิง POST { kind, version, accepted } ต่อสวิตช์.
import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { SkyBackdrop, SkyHeader, Toggle } from '@/features/v2-profile/components/kit'
import { ProfileGate } from '@/features/v2-account/components/ProfileGate'

type Consent = { kind: string; version: string; accepted: boolean; createdAt: string }
const CONSENT_VERSION = '2026-09'

type Impact = { tone: 'subtle' | 'red'; text: string; always?: boolean }
const PURPOSES: Array<{ kind: string; title: string; sub: string; locked?: boolean; def: boolean; impact?: Impact }> = [
  { kind: 'pdpa', title: 'ใช้วันเกิดเพื่อคำนวณดวงให้คุณ', sub: 'ข้อมูลพื้นฐานที่ทำให้บริการทำงานได้', locked: true, def: true, impact: { tone: 'subtle', always: true, text: 'จำเป็นต่อการให้บริการ ถ้าไม่ยินยอมข้อนี้ กรุณาลบบัญชีแทน' } },
  { kind: 'history', title: 'เก็บประวัติการดูดวง', sub: 'ทำให้กลับมาดูผลเก่าและให้คำทำนายต่อเนื่องได้', def: true, impact: { tone: 'red', text: 'ปิดแล้ว: ประวัติที่บันทึกไว้จะถูกลบ และดูผลย้อนหลังไม่ได้' } },
  { kind: 'analytics', title: 'ใช้ข้อมูลเพื่อพัฒนาคำทำนาย', sub: 'วิเคราะห์แบบไม่ระบุตัวตนเพื่อปรับความแม่นยำ', def: true, impact: { tone: 'red', text: 'ปิดแล้ว: ใช้งานได้ตามปกติทุกอย่าง' } },
  { kind: 'marketing', title: 'ส่งข่าวสารและโปรโมชัน', sub: 'อีเมลและ LINE เกี่ยวกับส่วนลดและฟีเจอร์ใหม่', def: false },
  { kind: 'ads', title: 'แชร์ข้อมูลกับพันธมิตรโฆษณา', sub: 'ใช้เพื่อแสดงโฆษณาที่ตรงกับคุณนอกแอป', def: false },
]

function bkkDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}

export function ConsentScreen() {
  const [consents, setConsents] = useState<Consent[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<'ok' | 'not_authenticated' | 'failed'>('ok')
  const [busyKind, setBusyKind] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setKind('ok')
    try {
      const res = await fetch('/api/consent')
      if (res.status === 401) { setKind('not_authenticated'); return }
      if (!res.ok) { setKind('failed'); return }
      const j = (await res.json()) as { consents?: Consent[] }
      setConsents(j.consents ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // สถานะปัจจุบันต่อ kind = แถวล่าสุดของ kind นั้น (ไม่มี = ค่าเริ่มต้น)
  const stateOf = (p: (typeof PURPOSES)[number]) => {
    const latest = consents?.find((c) => c.kind === p.kind)
    return latest ? latest.accepted : p.def
  }
  const lastEdited = consents && consents.length > 0 ? bkkDate(consents[0].createdAt) : null

  const setConsent = async (p: (typeof PURPOSES)[number], accepted: boolean) => {
    if (p.locked) return
    setBusyKind(p.kind)
    setMsg(null)
    try {
      const res = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: p.kind, version: CONSENT_VERSION, accepted }),
      })
      setMsg(res.ok ? (accepted ? 'บันทึกความยินยอมแล้ว' : 'ปิดความยินยอมแล้ว — บริการบางส่วนอาจได้รับผลกระทบ') : 'บันทึกไม่สำเร็จ ลองใหม่')
      if (res.ok) await load()
    } finally {
      setBusyKind(null)
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <SkyBackdrop />
      <Head><title>จัดการความยินยอม · MuMate</title></Head>
      <SkyHeader title="จัดการความยินยอม" backHref="/v2/settings" testId="consent" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-36 pt-2">
        <ProfileGate loading={loading} kind={kind} onRetry={() => void load()} />

        {!loading && kind === 'ok' && (
          <>
            <p className="px-1 text-[13px] leading-5 text-v3-text-body" data-testid="consent-intro">
              คุณเลือกได้ว่าจะให้ Mumate ใช้ข้อมูลอะไรบ้าง การปิดบางข้อจะทำให้ฟีเจอร์บางอย่างใช้ไม่ได้ เราจะบอกไว้ให้เห็นก่อน
            </p>

            {PURPOSES.map((p) => {
              const on = stateOf(p)
              const showImpact = p.impact && (p.impact.always || !on)
              return (
                <section key={p.kind} className="v3-shadow-card flex w-full flex-col gap-2 rounded-[18px] bg-white p-4" data-testid={`consent-card-${p.kind}`}>
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold leading-5 text-v3-navy">{p.title}</p>
                      <p className="text-[12px] leading-[18px] text-v3-text-muted">{p.sub}</p>
                    </div>
                    <Toggle on={on} locked={p.locked} disabled={busyKind === p.kind} onChange={(v) => void setConsent(p, v)} testId={`consent-${p.kind}`} />
                  </div>
                  {showImpact && p.impact ? (
                    <p
                      data-testid={`consent-impact-${p.kind}`}
                      className={'rounded-[12px] px-3 py-2 text-[12px] leading-[18px] ' + (p.impact.tone === 'red' ? 'bg-[#FBECEC] text-[#A83238]' : 'bg-[#F6ECF0] text-[#464646]')}
                    >
                      {p.impact.text}
                    </p>
                  ) : null}
                </section>
              )
            })}

            {msg && <p data-testid="consent-msg" className="px-1 text-[12px] font-bold text-v3-sapphire">{msg}</p>}

            {/* ประวัติการให้ความยินยอม (แถวนำทาง) */}
            <Link href="/privacy/policy" data-testid="consent-log" className="mt-1 flex items-center gap-3 rounded-[18px] border border-v3-border-card bg-white px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-v3-navy">ประวัติการให้ความยินยอม</p>
                <p className="text-[12px] leading-[18px] text-v3-text-muted">{lastEdited ? `แก้ไขล่าสุด ${lastEdited}` : 'อ่านนโยบายความเป็นส่วนตัวฉบับเต็ม'}</p>
              </div>
              <span className="flex-none text-[16px] font-bold text-v3-text-muted">›</span>
            </Link>

            <Link href="/v2/privacy/data-export" data-testid="consent-export-link" className="grid h-11 w-full place-items-center rounded-full border border-v3-border-card text-sm font-bold text-v3-navy">
              ส่งออกข้อมูลของฉัน
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

export default ConsentScreen
