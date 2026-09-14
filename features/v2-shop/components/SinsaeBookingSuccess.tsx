// features/v2-shop/components/SinsaeBookingSuccess.tsx — "จองสำเร็จ" สำหรับการจองซินแส (tier SINSAE).
// #3 (ซินแสนุ้ย 2026-09-14): จ่ายเงินแล้ว → หน้านี้ = "ใบเสร็จย่อ + ทักไลน์ยืนยันคิว" (ตามที่เจ้าของขอ:
// "ไปชำระเงิน แล้ว save ใบเสร็จทักไลน์ได้"). เว็บส่งรูปเข้าไลน์อัตโนมัติไม่ได้ → ให้ "บันทึกรูปใบเสร็จ"
// (html2canvas) แล้วผู้ใช้แนบในไลน์เอง + ปุ่มเปิด LINE OA. ใบเสร็จเต็มอยู่ที่ /v2/orders/[id] (อ่าน v2_payment).
import { useEffect, useRef, useState } from 'react'

import { KitButton } from '@/features/v2-profile/components/kit'
import { bahtOf, methodWord, type FullPaymentRow } from '@/features/v2-account/components/OrdersScreen'
import { sinsaeLabelOf } from '@/lib/payment/catalog'
import { LINE_ORDER_URL } from '@/features/v2-service/line-order'

export function SinsaeBookingSuccess({ packageCode, charge, order }: { packageCode: string; charge: string; order: string }) {
  const [row, setRow] = useState<FullPaymentRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/v2/payment/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return
        const rows: FullPaymentRow[] = Array.isArray(j?.payments) ? j.payments : []
        setRow(rows.find((r) => (charge && r.chargeId === charge) || (order && r.orderId === order)) ?? null)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [charge, order])

  const label = sinsaeLabelOf(packageCode) ?? 'จองปรึกษาซินแส'
  const receiptId = row?.chargeId || row?.orderId || charge || order

  // บันทึกรูปใบเสร็จ — html2canvas (มีเป็น dep แล้ว, precedent pages/share/image). robust: import แบบ dynamic +
  // try/catch; ถ้าเบราว์เซอร์บล็อกดาวน์โหลดก็บอกให้แคปหน้าจอแทน.
  const saveImage = async () => {
    if (!cardRef.current || saving) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(cardRef.current, { backgroundColor: '#ffffff', scale: 2 })
      const dataUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `mumate-booking-${receiptId || 'receipt'}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setSaveMsg('บันทึกรูปแล้ว — แนบในไลน์เพื่อยืนยันคิวได้เลย')
    } catch {
      setSaveMsg('บันทึกรูปไม่สำเร็จ — แคปหน้าจอนี้แล้วแนบในไลน์ได้เลย')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-testid="sinsae-booking-success" className="mx-auto flex w-full max-w-md flex-col items-center gap-3.5 px-6 pb-10 pt-[90px] font-ibm">
      <div className="flex w-full flex-col items-center gap-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/v2/shop/check-circle.svg" alt="" width={64} height={64} className="size-16" aria-hidden />
        <div className="flex w-full flex-col gap-1 text-center">
          <h1 data-testid="sinsae-success-title" role="status" aria-live="polite" className="text-2xl font-bold leading-normal text-v3-sapphire">
            จองสำเร็จ
          </h1>
          <p className="text-xl font-bold leading-[30px] tracking-[0.2px] text-v3-cyan">อีกขั้นเดียว — ทักไลน์ยืนยันวันเวลา</p>
        </div>
      </div>

      {/* การ์ดใบเสร็จย่อ (แคปเป็นรูปได้) */}
      <section ref={cardRef} data-testid="sinsae-success-card" className="v3-shadow-card flex w-full flex-col gap-[11px] rounded-[22px] bg-white p-4">
        <div className="flex w-full items-center gap-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <p className="text-lg font-bold leading-6 text-v3-navy">จองซินแส · {label}</p>
            <p className="text-sm leading-[22px] text-v3-text-body">ปรึกษาตัวต่อตัวกับซินแส (คนจริง ไม่ใช้ AI)</p>
          </div>
          <span className="shrink-0 rounded-pill bg-[#E7F6F8] px-2 py-1 text-[9px] font-bold leading-none text-v3-cyan">ชำระแล้ว</span>
        </div>
        <hr className="w-full border-t border-v3-border-card" />
        {row ? (
          <>
            <div className="flex items-center justify-between text-sm"><span className="leading-[22px] text-v3-text-body">ยอดชำระ</span><b className="leading-5 text-v3-text-price">{bahtOf(row.amountSatang)}</b></div>
            <div className="flex items-center justify-between text-sm"><span className="leading-[22px] text-v3-text-body">วิธีชำระ</span><b className="leading-5 text-v3-text-price">{methodWord(row.method)}</b></div>
            {row.orderId ? (
              <div className="flex items-center justify-between gap-3 text-sm"><span className="leading-[22px] text-v3-text-body">เลขที่ใบเสร็จ</span><b className="break-all text-right leading-5 text-v3-text-price">{row.orderId}</b></div>
            ) : null}
          </>
        ) : (
          <div aria-hidden className="h-[66px] w-full animate-pulse rounded-lg bg-v3-border-card/60" />
        )}
        <hr className="w-full border-t border-v3-border-card" />
        <p className="text-center text-[10px] leading-4 text-v3-text-muted">ใบกำกับภาษีฉบับเต็มส่งไปที่อีเมล · ออกโดย Omise</p>
      </section>

      {/* actions: หลัก = ทักไลน์ยืนยันคิว · รอง = บันทึกรูป / ดูใบเสร็จ */}
      <a
        href={LINE_ORDER_URL}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="sinsae-success-line"
        className="grid h-[52px] w-full place-items-center rounded-pill bg-v3-sapphire text-base font-bold text-v3-lime"
      >
        ทักไลน์ยืนยันวันเวลา
      </a>
      <div className="flex w-full gap-2">
        <button
          type="button"
          onClick={() => void saveImage()}
          disabled={saving}
          data-testid="sinsae-success-save"
          className="grid h-11 flex-1 place-items-center rounded-full border border-v3-sapphire text-sm font-bold text-v3-sapphire disabled:opacity-50"
        >
          {saving ? 'กำลังบันทึก…' : 'บันทึกรูปใบเสร็จ'}
        </button>
        {receiptId ? (
          <KitButton variant="outline" href={`/v2/orders/${encodeURIComponent(receiptId)}`} testId="sinsae-success-receipt" className="flex-1">
            ดูใบเสร็จ
          </KitButton>
        ) : null}
      </div>
      {saveMsg && <p data-testid="sinsae-success-savemsg" className="text-center text-[12px] font-bold text-v3-sapphire">{saveMsg}</p>}

      <KitButton variant="outline" href="/v2" testId="sinsae-success-home" className="mt-1">กลับสู่หน้าหลัก</KitButton>
    </div>
  )
}

export default SinsaeBookingSuccess
