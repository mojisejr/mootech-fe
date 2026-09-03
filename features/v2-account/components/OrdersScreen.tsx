// features/v2-account/components/OrdersScreen.tsx — /v2/orders (เฟรม `order-history`) และ
// ใบเสร็จ /v2/orders/[id] (เฟรม `order-receipt`) — อ่านแถวจริงจาก /api/v2/payment/status
// (มี chargeId/orderId/method/vat ครบ — PaymentRow ใน payment-history.ts เห็นบางส่วนเท่านั้น).
// 🔴 ยึดกติกา #365: APPROVED เท่านั้นที่ "สำเร็จ"; REJECT/PENDING แสดงสถานะจริง ไม่เรียกว่าซื้อแล้ว
import Head from "next/head"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { AppHeader } from "@/features/v2-shell/components/AppHeader"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { useV2Tier } from "@/features/auth/hooks/useV2Tier"
import { bkkCivilDate } from "../payment-history"

const CARD = "flex w-full flex-col rounded-[20px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]"

/** แถวเต็มจาก /api/v2/payment/status (pages/api/v2/payment/status.ts:17-56) */
export type FullPaymentRow = {
  chargeId: string
  orderId: string | null
  packageCode: string
  tierCode: string
  amountSatang: number
  method: string
  status: string
  failureCode: string | null
  createdAt: string
}

const TIER_WORD: Record<string, string> = {
  PLUS: "Mumate + (สมาชิกรายปี)",
  PRO: "Mumate Pro (สมาชิกรายปี)",
  FREE: "Mumate Free",
  QI: "แพ็กชี่",
}

export function titleFor(row: FullPaymentRow): string {
  if (row.tierCode === "QI") {
    // QI_200 → 200 (จำนวนชี่ฝังในโค้ดแพ็ก — fail-loud ฝั่ง catalog แล้วว่าโค้ดต้องรู้จัก)
    const qty = Number(row.packageCode.replace("QI_", "").replace(/[^\d]/g, ""))
    return Number.isFinite(qty) && qty > 0 ? `แพ็กชี่ ${qty.toLocaleString("th-TH")} ชี่` : row.packageCode
  }
  return TIER_WORD[row.tierCode] ?? row.packageCode
}

export function statusWord(status: string): { text: string; paid: boolean } {
  if (status === "APPROVED") return { text: "สำเร็จ", paid: true }
  if (status === "REJECT") return { text: "ไม่สำเร็จ", paid: false }
  return { text: "รอตรวจสอบ", paid: false }
}

export function bahtOf(amountSatang: number): string {
  return `฿${(amountSatang / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`
}

export function usePaymentRows() {
  const [rows, setRows] = useState<FullPaymentRow[] | null>(null)
  const [done, setDone] = useState(false)
  const [errored, setErrored] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    setDone(false)
    setErrored(false)
    fetch("/api/v2/payment/status")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        if (alive) setRows(Array.isArray(j?.payments) ? j.payments : [])
      })
      .catch(() => {
        if (alive) {
          setErrored(true)
          setRows(null)
        }
      })
      .finally(() => {
        if (alive) setDone(true)
      })
    return () => {
      alive = false
    }
  }, [attempt])
  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { rows, done, errored, retry }
}

function receiptHref(row: FullPaymentRow): string {
  return `/v2/orders/${encodeURIComponent(row.chargeId || row.orderId || "")}`
}

export function OrdersScreen() {
  const tier = useV2Tier(false)
  const { rows, done, errored, retry } = usePaymentRows()

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <Head><title>ประวัติคำสั่งซื้อ · MuMate</title></Head>
      <AppHeader testId="orders-header" title="ประวัติคำสั่งซื้อ" backHref="/v2/account" membership={tier} upgradeCta={false} className="items-center py-4" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-36 pt-2">
        {!done && (
          <div aria-hidden className="h-[72px] w-full animate-pulse rounded-[20px] bg-white" data-testid="orders-loading" />
        )}

        {done && errored && (
          <section className={CARD} data-testid="orders-error">
            <p className="text-sm font-bold text-v3-navy">โหลดประวัติไม่สำเร็จ</p>
            <button onClick={retry} className="mt-2 grid h-11 w-full place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
              ลองใหม่
            </button>
          </section>
        )}

        {done && !errored && rows && rows.length === 0 && (
          <section className={CARD} data-testid="orders-empty">
            <p className="text-[13px] leading-5 text-v3-text-body">ยังไม่มีคำสั่งซื้อ — ดูแพ็กเกจและแพ็กชี่ได้ที่ร้านค้า</p>
            <Link href="/v2/shop" data-testid="orders-empty-shop" className="mt-2 grid h-11 w-full place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
              ไปร้านค้า
            </Link>
          </section>
        )}

        {done && !errored && rows && rows.length > 0 && (
          <ul className="flex flex-col gap-3" data-testid="orders-list">
            {rows.map((row) => {
              const st = statusWord(row.status)
              return (
                <li key={row.chargeId || row.orderId || row.createdAt}>
                  <Link href={receiptHref(row)} data-testid="orders-row" className={`${CARD} gap-1`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-[14px] font-bold text-v3-navy">{titleFor(row)}</p>
                      <span
                        className={
                          "flex-none rounded-full px-2 py-[2px] text-[11px] font-black " +
                          (st.paid ? "bg-v3-success-bg text-v3-success-text" : "bg-v3-ghost-white text-v3-text-muted")
                        }
                      >
                        {st.text}
                      </span>
                    </div>
                    <p className="text-[12px] text-v3-text-muted">
                      {bkkCivilDate(row.createdAt)} · {bahtOf(row.amountSatang)}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Menubar />
    </div>
  )
}

export default OrdersScreen
