// features/v2-account/components/OrderReceiptScreen.tsx — /v2/orders/[id] (เฟรม `order-receipt`)
// ฿ hero + สถานะ + breakdown (สินค้า/โบนัส QI/ได้รับรวม/ก่อน VAT/VAT 7%/ยอดชำระ/วิธีชำระ/เลขที่/ผู้ให้บริการ) + actions.
// อ่านแถวด้วย chargeId (หรือ orderId). REJECT = "ไม่สำเร็จ" ไม่มีทางอ่านเป็นซื้อสำเร็จ (กติกา #365).
import Head from "next/head"
import Link from "next/link"
import { useState } from "react"

import { KitButton, SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { VAT_RATE } from "@/lib/payment/catalog"
import { bkkCivilDate } from "../payment-history"
import { bahtOf, methodWord, qiReceivedOf, statusWord, titleFor, usePaymentRows } from "./OrdersScreen"

const CARD = "v3-shadow-card flex w-full flex-col gap-3 rounded-[24px] bg-white p-5"

function Row({ label, value, testId, strong, green }: { label: string; value: string; testId?: string; strong?: boolean; green?: boolean }) {
  return (
    <div className="flex w-full items-start justify-between gap-3 text-[13px]">
      <p className="leading-[22px] text-v3-text-body">{label}</p>
      <p data-testid={testId} className={"break-all text-right leading-[22px] " + (green ? "font-black text-[#63B05F]" : strong ? "font-black text-v3-navy" : "font-bold text-v3-navy")}>{value}</p>
    </div>
  )
}

export function OrderReceiptScreen({ id }: { id: string }) {
  const { rows, done, errored, retry } = usePaymentRows()
  const row = rows?.find((r) => r.chargeId === id || (r.orderId && r.orderId === id)) ?? null

  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState<string | null>(null)
  // ส่งใบเสร็จซ้ำ — ยิง endpoint จริง ถ้ายังไม่มี BE (404/ไม่ ok) แจ้งตรง ๆ ว่าใบเสร็จส่งอัตโนมัติทางอีเมลแล้ว
  const resend = async () => {
    if (!row) return
    setResending(true)
    setResendMsg(null)
    try {
      const res = await fetch("/api/v2/payment/resend-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargeId: row.chargeId, orderId: row.orderId }),
      })
      setResendMsg(res.ok ? "ส่งใบเสร็จไปที่อีเมลของคุณแล้ว" : "ใบเสร็จส่งอัตโนมัติทางอีเมลหลังชำระเงินแล้ว — ตรวจกล่องจดหมายได้เลย")
    } catch {
      setResendMsg("ใบเสร็จส่งอัตโนมัติทางอีเมลหลังชำระเงินแล้ว — ตรวจกล่องจดหมายได้เลย")
    } finally {
      setResending(false)
    }
  }

  const st = row ? statusWord(row.status) : null
  const qi = row ? qiReceivedOf(row) : null
  const vatSatang = row ? Math.round((row.amountSatang * VAT_RATE) / (1 + VAT_RATE)) : 0

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <SkyBackdrop />
      <Head><title>ใบเสร็จ · MuMate</title></Head>
      <SkyHeader title="ใบเสร็จ" backHref="/v2/orders" testId="receipt" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-36 pt-2">
        {!done && <div aria-hidden className="h-[180px] w-full animate-pulse rounded-[24px] bg-white" data-testid="receipt-loading" />}

        {done && errored && (
          <section className={CARD} data-testid="receipt-error">
            <p className="text-sm font-bold text-v3-navy">โหลดใบเสร็จไม่สำเร็จ</p>
            <button onClick={retry} className="mt-2 grid h-11 w-full place-items-center rounded-full bg-v3-navy text-sm font-bold text-white">ลองใหม่</button>
          </section>
        )}

        {done && !errored && !row && (
          <section className={CARD} data-testid="receipt-not-found">
            <p className="text-[13px] leading-5 text-v3-text-body">ไม่พบรายการนี้ในบัญชีของคุณ</p>
            <Link href="/v2/orders" data-testid="receipt-back-orders" className="mt-2 grid h-11 w-full place-items-center rounded-full bg-v3-navy text-sm font-bold text-white">กลับประวัติคำสั่งซื้อ</Link>
          </section>
        )}

        {row && st && (
          <>
            {/* ฿ hero + สถานะ */}
            <div className="flex flex-col items-center gap-2 pt-2 text-center">
              <p className="text-[40px] font-black leading-[46px] text-v3-navy" data-testid="receipt-amount">{bahtOf(row.amountSatang)}</p>
              <div className="flex items-center gap-2">
                <span className={"rounded-full px-3 py-1 text-[12px] font-black " + (st.refunded ? "bg-[#FDECEC] text-[#A83238]" : st.paid ? "bg-[#E3F4F7] text-[#14707E]" : "bg-v3-ghost-white text-v3-text-muted")} data-testid="receipt-status">{st.text}</span>
                <span className="text-[12px] text-v3-text-muted" data-testid="receipt-date">{bkkCivilDate(row.createdAt)}</span>
              </div>
              <p className="text-[13px] font-bold text-v3-navy" data-testid="receipt-title">{titleFor(row)}</p>
            </div>

            {/* breakdown */}
            <section className={CARD} data-testid="receipt-card">
              {qi ? (
                <>
                  <Row label="สินค้า" value={`แพ็ก ${qi.qty.toLocaleString("th-TH")} QI`} />
                  {qi.bonus > 0 ? <Row label="โบนัส" value={`+${qi.bonus.toLocaleString("th-TH")} QI`} green /> : null}
                  <Row label="ได้รับรวม" value={`${qi.total.toLocaleString("th-TH")} QI`} strong />
                  <hr className="w-full border-t border-v3-border-card" />
                </>
              ) : null}
              <Row label="ราคาก่อน VAT" value={bahtOf(row.amountSatang - vatSatang)} />
              <Row label="VAT 7%" value={bahtOf(vatSatang)} />
              <Row label="ยอดชำระ" value={bahtOf(row.amountSatang)} strong />
              <hr className="w-full border-t border-v3-border-card" />
              <Row label="วิธีชำระ" value={methodWord(row.method)} testId="receipt-method" />
              {row.orderId ? <Row label="เลขที่ใบเสร็จ" value={row.orderId} testId="receipt-order" /> : null}
              {row.chargeId ? <Row label="รหัสชำระเงิน" value={row.chargeId} testId="receipt-charge" /> : null}
              <Row label="ผู้ให้บริการชำระเงิน" value="Omise" />
              {row.status === "REJECT" && row.failureCode ? (
                <p className="text-[12px] leading-4 text-v3-error" data-testid="receipt-failure">
                  รายการนี้ไม่สำเร็จ ({row.failureCode}) — ยอดไม่ถูกตัด หรือถูกคืนแล้วตามธนาคาร
                </p>
              ) : null}
              <p className="text-[11px] leading-4 text-v3-text-muted">ใบกำกับภาษีฉบับเต็มส่งไปที่อีเมลของคุณหลังชำระเงินสำเร็จ · QI ที่ซื้อแล้วขอคืนเป็นเงินสดไม่ได้ ยกเว้นกรณีระบบขัดข้อง</p>
            </section>

            {/* actions (เฟรม actions): หลัก = ส่งใบเสร็จอีกครั้ง · รอง = ขอความช่วยเหลือ */}
            {st.paid ? (
              <div className="flex flex-col gap-2">
                <KitButton onClick={() => void resend()} disabled={resending} testId="receipt-resend">
                  {resending ? "กำลังส่ง..." : "ส่งใบเสร็จอีกครั้ง"}
                </KitButton>
                {resendMsg && <p data-testid="receipt-resend-msg" className="text-center text-[12px] font-bold text-v3-sapphire">{resendMsg}</p>}
                <KitButton variant="outline" href="/v2/help/faq" testId="receipt-help">ขอความช่วยเหลือ</KitButton>
              </div>
            ) : (
              <div className="flex gap-2">
                <KitButton href="/v2/help/faq" testId="receipt-help" className="flex-1">ขอความช่วยเหลือ</KitButton>
                <KitButton variant="outline" href="/v2/orders" testId="receipt-back" className="flex-1">กลับประวัติคำสั่งซื้อ</KitButton>
              </div>
            )}
          </>
        )}
      </div>

      <Menubar />
    </div>
  )
}

export default OrderReceiptScreen
