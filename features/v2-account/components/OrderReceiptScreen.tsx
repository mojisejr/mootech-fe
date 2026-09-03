// features/v2-account/components/OrderReceiptScreen.tsx — /v2/orders/[id] (เฟรม `order-receipt`)
// ใบเสร็จแยกอ่านจาก /api/v2/payment/status ด้วย chargeId (หรือ orderId เมื่อ charge ยังว่าง) —
// ยอด/VAT จากแถวจริง; REJECT = "ไม่สำเร็จ" ไม่มีทางอ่านเป็นซื้อสำเร็จ (กติกา #365)
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"

import { AppHeader } from "@/features/v2-shell/components/AppHeader"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { useV2Tier } from "@/features/auth/hooks/useV2Tier"
import { bkkCivilDate } from "../payment-history"
import { bahtOf, statusWord, titleFor, usePaymentRows } from "./OrdersScreen"

const CARD = "flex w-full flex-col gap-2 rounded-[20px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]"

function Row({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex w-full items-start justify-between gap-3 text-sm">
      <p className="leading-[22px] text-v3-text-body">{label}</p>
      <p data-testid={testId} className="break-all text-right font-bold leading-[22px] text-v3-navy">{value}</p>
    </div>
  )
}

export function OrderReceiptScreen({ id }: { id: string }) {
  const tier = useV2Tier(false)
  const router = useRouter()
  const { rows, done, errored, retry } = usePaymentRows()
  const row = rows?.find((r) => r.chargeId === id || (r.orderId && r.orderId === id)) ?? null

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <Head><title>ใบเสร็จ · MuMate</title></Head>
      <AppHeader testId="receipt-header" title="ใบเสร็จ" backHref="/v2/orders" membership={tier} upgradeCta={false} className="items-center py-4" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-36 pt-2">
        {!done && <div aria-hidden className="h-[180px] w-full animate-pulse rounded-[20px] bg-white" data-testid="receipt-loading" />}

        {done && errored && (
          <section className={CARD} data-testid="receipt-error">
            <p className="text-sm font-bold text-v3-navy">โหลดใบเสร็จไม่สำเร็จ</p>
            <button onClick={retry} className="mt-2 grid h-11 w-full place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
              ลองใหม่
            </button>
          </section>
        )}

        {done && !errored && !row && (
          <section className={CARD} data-testid="receipt-not-found">
            <p className="text-[13px] leading-5 text-v3-text-body">ไม่พบรายการนี้ในบัญชีของคุณ</p>
            <Link href="/v2/orders" data-testid="receipt-back-orders" className="mt-2 grid h-11 w-full place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
              กลับประวัติคำสั่งซื้อ
            </Link>
          </section>
        )}

        {row && (
          <section className={CARD} data-testid="receipt-card">
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-v3-navy" data-testid="receipt-title">{titleFor(row)}</p>
              <span
                className={
                  "rounded-full px-2 py-[2px] text-[11px] font-black " +
                  (statusWord(row.status).paid ? "bg-v3-success-bg text-v3-success-text" : "bg-v3-ghost-white text-v3-text-muted")
                }
                data-testid="receipt-status"
              >
                {statusWord(row.status).text}
              </span>
            </div>
            <hr className="w-full border-t border-v3-border-card" />
            <Row testId="receipt-date" label="วันที่" value={bkkCivilDate(row.createdAt)} />
            <Row testId="receipt-amount" label="ยอดชำระ" value={bahtOf(row.amountSatang)} />
            <Row testId="receipt-method" label="วิธีชำระ" value={row.method === "promptpay" ? "พร้อมเพย์ QR" : "บัตรเครดิต/เดบิต"} />
            {row.orderId ? <Row testId="receipt-order" label="เลขที่คำสั่งซื้อ" value={row.orderId} /> : null}
            {row.chargeId ? <Row testId="receipt-charge" label="รหัสชำระเงิน" value={row.chargeId} /> : null}
            {row.status === "REJECT" && row.failureCode ? (
              <p className="text-[12px] leading-4 text-v3-error" data-testid="receipt-failure">
                รายการนี้ไม่สำเร็จ ({row.failureCode}) — ยอดไม่ถูกตัด หรือถูกคืนแล้วตามธนาคาร
              </p>
            ) : null}
            <p className="text-[11px] leading-4 text-v3-text-muted">
              ใบกำกับภาษีฉบับเต็มส่งไปที่อีเมลของคุณหลังชำระเงินสำเร็จ
            </p>
            <Link href="/v2/orders" data-testid="receipt-back" className="grid h-11 w-full place-items-center rounded-full border border-v3-border-card text-sm font-bold text-v3-navy">
              กลับประวัติคำสั่งซื้อ
            </Link>
          </section>
        )}
      </div>

      <Menubar />
    </div>
  )
}

export default OrderReceiptScreen
