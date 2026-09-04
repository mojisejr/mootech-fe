// features/v2-settings/components/DataExportScreen.tsx — /v2/privacy/data-export (เฟรม privacy-data-export)
// กดส่งออก → GET /api/account-export (engine รวมข้อมูลทั้งหมด) → ดาวน์โหลดเป็นไฟล์ JSON
// สถานะ: กำลังรวมข้อมูล / เสร็จ (ขนาดไฟล์) / ล้ม — ❌ ล้มต้องไม่โชว์ว่า "ส่งออกแล้ว"
import Head from 'next/head'
import { useState } from 'react'

import { SkyBackdrop, SkyHeader } from '@/features/v2-profile/components/kit'

const CARD = 'flex w-full flex-col gap-2 rounded-[20px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]'

export function DataExportScreen() {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'failed'>('idle')
  const [sizeText, setSizeText] = useState<string | null>(null)

  const exportData = async () => {
    setState('working')
    try {
      const res = await fetch('/api/account-export')
      if (!res.ok) {
        setState('failed')
        return
      }
      const text = await res.text()
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mumate-data-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setSizeText(`${(blob.size / 1024).toFixed(1)} KB`)
      setState('done')
    } catch {
      setState('failed')
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <SkyBackdrop />
      <Head><title>ส่งออกข้อมูลของฉัน · MuMate</title></Head>
      <SkyHeader title="ส่งออกข้อมูลของฉัน" backHref="/v2/privacy/consent" testId="export" />

      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-36 pt-2">
        <section className={CARD} data-testid="export-info">
          <p className="text-[13px] font-bold text-v3-navy">ข้อมูลที่จะได้รับ (ไฟล์ JSON)</p>
          <ul className="list-disc space-y-1 pl-5 text-[13px] leading-5 text-v3-text-body">
            <li>โปรไฟล์และวันเกิดที่บันทึกไว้</li>
            <li>ชี่ เหรียญ และประวัติธุรกรรมทั้งหมด</li>
            <li>ภารกิจ สิทธิ์ที่แลกไว้ โค้ดแนะนำ และความยินยอม</li>
          </ul>
        </section>

        <button
          onClick={() => void exportData()}
          disabled={state === 'working'}
          data-testid="export-run"
          className="grid h-12 w-full place-items-center rounded-full bg-v3-cyan text-base font-bold text-white disabled:opacity-40"
        >
          {state === 'working' ? 'กำลังรวมข้อมูล…' : 'ส่งออกข้อมูลของฉัน'}
        </button>

        {state === 'done' && (
          <p data-testid="export-done" className="rounded-[14px] bg-white p-4 text-[13px] leading-5 text-v3-text-body drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]">
            ดาวน์โหลดเรียบร้อย ({sizeText}) — ไฟล์อยู่ในโฟลเดอร์ดาวน์โหลดของอุปกรณ์คุณ
          </p>
        )}
        {state === 'failed' && (
          <p data-testid="export-failed" className="rounded-[14px] bg-white p-4 text-[13px] leading-5 text-v3-text-body drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]">
            ส่งออกไม่สำเร็จ กรุณาลองอีกครั้ง
          </p>
        )}
      </div>
    </div>
  )
}

export default DataExportScreen
