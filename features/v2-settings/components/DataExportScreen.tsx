// features/v2-settings/components/DataExportScreen.tsx — /v2/privacy/data-export (เฟรม privacy-data-export)
// PDPA async-email: กด "ขอไฟล์ข้อมูลของฉัน" → POST /api/account-export (engine บันทึกคำขอ) → รวบรวมแล้วส่งไฟล์
// JSON+CSV ไปที่อีเมลภายใน 30 วัน. สถานะคงอยู่จริง (อ่านจาก ?status=1).
// 🔴 การส่งอีเมลจริงยังไม่ทำงาน (รอ email provider ฝั่ง engine) — จอนี้ "ไม่" บอกว่าส่งแล้ว บอกแค่ "กำลังรวบรวม".
import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { KitButton, SkyBackdrop, SkyHeader } from '@/features/v2-profile/components/kit'

const CARD = 'flex w-full flex-col gap-2 rounded-[24px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]'

type ExportRequest = { status?: string; requestedAt?: string; email?: string | null }

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="text-v3-text-body">{label}</span>
      <b className="text-right text-v3-navy">{value}</b>
    </div>
  )
}

export function DataExportScreen() {
  const [email, setEmail] = useState<string | null>(null)
  const [pending, setPending] = useState<ExportRequest | null>(null)
  const [state, setState] = useState<'idle' | 'working' | 'requested' | 'failed'>('idle')

  const loadStatus = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        fetch('/api/profile').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/account-export?status=1').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ])
      setEmail(p?.profile?.email ?? null)
      const req: ExportRequest | null = s?.request ?? null
      if (req && (req.status === 'collecting' || req.status === 'ready')) {
        setPending(req)
        setState('requested')
      }
    } catch {
      /* ไม่บล็อกหน้า */
    }
  }, [])

  useEffect(() => { void loadStatus() }, [loadStatus])

  const requestExport = async () => {
    setState('working')
    try {
      const res = await fetch('/api/account-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        setState('failed')
        return
      }
      const j = (await res.json().catch(() => ({}))) as { request?: ExportRequest }
      setPending(j.request ?? { status: 'collecting', requestedAt: new Date().toISOString() })
      setState('requested')
    } catch {
      setState('failed')
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <SkyBackdrop />
      <Head><title>ขอไฟล์ข้อมูลของฉัน · MuMate</title></Head>
      <SkyHeader title="ขอไฟล์ข้อมูลของฉัน" backHref="/v2/privacy/consent" testId="export" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-36 pt-2">
        <p className="px-1 text-[13px] leading-5 text-v3-text-body">
          เราจะรวบรวมข้อมูลทั้งหมดของคุณเป็นไฟล์แล้วส่งไปที่อีเมลของคุณ — ปลอดภัยกว่าการดาวน์โหลดตรงในเบราว์เซอร์
        </p>

        {/* ไฟล์จะมีอะไรบ้าง */}
        <section className={CARD} data-testid="export-info">
          <p className="text-[13px] font-bold text-v3-navy">ไฟล์จะมีอะไรบ้าง</p>
          <ul className="list-disc space-y-1 pl-5 text-[13px] leading-5 text-v3-text-body">
            <li>โปรไฟล์ วันเกิด และผลดวงที่บันทึกไว้</li>
            <li>ยอด QI และประวัติธุรกรรมทั้งหมด</li>
            <li>ภารกิจ สิทธิ์ที่แลกไว้ และโค้ดแนะนำ</li>
            <li>ความยินยอม (PDPA) และการตั้งค่าแจ้งเตือน</li>
          </ul>
        </section>

        {/* meta: ส่งไปที่ / รูปแบบ / เวลา */}
        <section className={CARD} data-testid="export-meta">
          <Meta label="ส่งไปที่" value={email || 'ยังไม่ได้ตั้งอีเมล'} />
          <Meta label="รูปแบบไฟล์" value="JSON และ CSV" />
          <Meta label="ใช้เวลา" value="ภายใน 30 วัน" />
        </section>

        {!email ? (
          <section className="rounded-[16px] bg-[#FDF3E0] p-4" data-testid="export-no-email">
            <p className="text-[13px] leading-5 text-[#8A5A0C]">ยังไม่มีอีเมลในบัญชี — เพิ่มอีเมลก่อนเพื่อรับไฟล์ข้อมูล</p>
            <Link href="/v2/settings/edit-profile" data-testid="export-add-email" className="mt-1 inline-block text-[13px] font-bold text-v3-sapphire">เพิ่มอีเมล →</Link>
          </section>
        ) : null}

        {state === 'requested' ? (
          <section className="rounded-[16px] bg-[#ECF0FD] p-4" data-testid="export-requested">
            <p className="text-[13px] font-bold text-v3-navy">สถานะ: กำลังรวบรวมข้อมูล</p>
            <p className="text-[12px] leading-[18px] text-v3-text-body">
              เมื่อไฟล์พร้อมเราจะส่งไปที่ {email || 'อีเมลของคุณ'} ภายใน 30 วัน — ไม่ต้องเปิดหน้านี้ค้างไว้
            </p>
          </section>
        ) : (
          <KitButton onClick={() => void requestExport()} disabled={!email || state === 'working'} testId="export-run">
            {state === 'working' ? 'กำลังส่งคำขอ...' : 'ขอไฟล์ข้อมูลของฉัน'}
          </KitButton>
        )}

        {state === 'failed' && (
          <p data-testid="export-failed" className="rounded-[14px] bg-white p-4 text-[13px] leading-5 text-v3-text-body drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]">
            ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง
          </p>
        )}
      </div>
    </div>
  )
}

export default DataExportScreen
