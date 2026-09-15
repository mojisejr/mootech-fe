// features/v2-shop/components/BookOrderSuccess.tsx — "สั่งซื้อสำเร็จ" หนังสือ Your Life Code (tier BOOK).
// #3 (ซินแสนุ้ย 2026-09-15): จ่ายเงินแล้ว → หน้านี้ = ใบเสร็จย่อ + แจ้ง "10-15 วัน" + ปุ่มเข้ากลุ่ม BLM.
// on mount: ผูก charge เข้ากับ book_order (id จาก sessionStorage ตอนกรอกฟอร์ม) → mark PAID (server ยืนยัน).
import { useEffect, useRef, useState } from 'react'

import { KitButton } from '@/features/v2-profile/components/kit'
import { bahtOf, methodWord, type FullPaymentRow } from '@/features/v2-account/components/OrdersScreen'
import { bookLabelOf } from '@/lib/payment/catalog'

// กลุ่มเรียนรู้ดวง Bazi Life Matrix (BLM) — พี่ Kittipon ส่งในกลุ่ม MumateProgramming 2026-09-14
const BLM_GROUP_URL = 'https://www.facebook.com/share/g/197Gt9TPvm/'
export const BOOK_ORDER_ID_KEY = 'mumate_book_order_id'

export function BookOrderSuccess({ packageCode, charge, order }: { packageCode: string; charge: string; order: string }) {
  const [row, setRow] = useState<FullPaymentRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // ใบเสร็จย่อจาก v2_payment
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

  // ผูก charge เข้ากับ book_order (best-effort) — id เก็บไว้ตอนกรอกฟอร์ม
  useEffect(() => {
    if (!charge) return
    let id: string | null = null
    try { id = sessionStorage.getItem(BOOK_ORDER_ID_KEY) } catch { id = null }
    if (!id) return
    void fetch('/api/v2/book-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'attach', id, chargeId: charge }),
    })
      .then((r) => { if (r.ok) { try { sessionStorage.removeItem(BOOK_ORDER_ID_KEY) } catch { /* ignore */ } } })
      .catch(() => {})
  }, [charge])

  const label = bookLabelOf(packageCode) ?? 'หนังสือ Your Life Code'
  const receiptId = row?.chargeId || row?.orderId || charge || order

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
      a.download = `mumate-book-${receiptId || 'receipt'}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setSaveMsg('บันทึกรูปแล้ว')
    } catch {
      setSaveMsg('บันทึกรูปไม่สำเร็จ — แคปหน้าจอนี้ได้เลย')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-testid="book-order-success" className="mx-auto flex w-full max-w-md flex-col items-center gap-3.5 px-6 pb-10 pt-[90px] font-ibm">
      <div className="flex w-full flex-col items-center gap-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/v2/shop/check-circle.svg" alt="" width={64} height={64} className="size-16" aria-hidden />
        <div className="flex w-full flex-col gap-1 text-center">
          <h1 data-testid="book-success-title" role="status" aria-live="polite" className="text-2xl font-bold leading-normal text-v3-sapphire">
            สั่งซื้อสำเร็จ
          </h1>
          <p className="text-xl font-bold leading-[30px] tracking-[0.2px] text-v3-cyan">ขอบคุณที่สั่งซื้อ Your Life Code</p>
        </div>
      </div>

      <section ref={cardRef} data-testid="book-success-card" className="v3-shadow-card flex w-full flex-col gap-[11px] rounded-[22px] bg-white p-4">
        <div className="flex w-full items-center gap-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <p className="text-lg font-bold leading-6 text-v3-navy">Your Life Code</p>
            <p className="text-sm leading-[22px] text-v3-text-body">{label}</p>
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
        <p className="text-center text-[11px] font-bold leading-4 text-v3-text-body">📦 สินค้ารอรับประมาณ 10-15 วัน จัดทำตามลำดับคิวซินแส</p>
      </section>

      {/* หลัก = เข้ากลุ่ม BLM เรียนรู้ดวง */}
      <a
        href={BLM_GROUP_URL}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="book-success-group"
        className="grid h-[52px] w-full place-items-center rounded-pill bg-v3-sapphire text-base font-bold text-v3-lime"
      >
        เข้ากลุ่มเรียนรู้ดวง Bazi Life Matrix
      </a>
      <div className="flex w-full gap-2">
        <button
          type="button"
          onClick={() => void saveImage()}
          disabled={saving}
          data-testid="book-success-save"
          className="grid h-11 flex-1 place-items-center rounded-full border border-v3-sapphire text-sm font-bold text-v3-sapphire disabled:opacity-50"
        >
          {saving ? 'กำลังบันทึก…' : 'บันทึกรูปใบเสร็จ'}
        </button>
        {receiptId ? (
          <KitButton variant="outline" href={`/v2/orders/${encodeURIComponent(receiptId)}`} testId="book-success-receipt" className="flex-1">
            ดูใบเสร็จ
          </KitButton>
        ) : null}
      </div>
      {saveMsg && <p data-testid="book-success-savemsg" className="text-center text-[12px] font-bold text-v3-sapphire">{saveMsg}</p>}

      <KitButton variant="outline" href="/v2" testId="book-success-home" className="mt-1">กลับสู่หน้าหลัก</KitButton>
    </div>
  )
}

export default BookOrderSuccess
