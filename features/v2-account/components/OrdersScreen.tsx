// features/v2-account/components/OrdersScreen.tsx — /v2/orders (เฟรม `order-history`) + ใบเสร็จ /v2/orders/[id].
// สรุปยอด(เดือนนี้/ทั้งหมด) + จัดกลุ่มตามเดือน + วิธีชำระ + สถานะ. อ่านแถวจริงจาก /api/v2/payment/status.
// 🔴 กติกา #365: APPROVED เท่านั้น = "สำเร็จ"; REJECT/PENDING แสดงสถานะจริง ไม่เรียกว่าซื้อแล้ว
import Head from "next/head"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

import { SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { qiBonusOf, qiQtyOf } from "@/lib/payment/catalog"
import { bkkCivilDate } from "../payment-history"

const CARD = "v3-shadow-card flex w-full flex-col rounded-[24px] bg-white p-5"

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
  QI: "แพ็ก QI",
}

export function titleFor(row: FullPaymentRow): string {
  if (row.tierCode === "QI") {
    const qty = qiQtyOf(row.packageCode) ?? Number(row.packageCode.replace(/[^\d]/g, ""))
    return Number.isFinite(qty) && qty > 0 ? `แพ็ก ${qty.toLocaleString("th-TH")} QI` : row.packageCode
  }
  return TIER_WORD[row.tierCode] ?? row.packageCode
}

/** QI ที่ได้รับจากออเดอร์นี้ (แพ็ก + โบนัส) — null ถ้าไม่ใช่แพ็ก QI */
export function qiReceivedOf(row: FullPaymentRow): { qty: number; bonus: number; total: number } | null {
  if (row.tierCode !== "QI") return null
  const qty = qiQtyOf(row.packageCode)
  if (qty === null) return null
  const bonus = qiBonusOf(row.packageCode)
  return { qty, bonus, total: qty + bonus }
}

/** ชื่อรายการ + โบนัส สำหรับลิสต์ประวัติ (เฟรม: "แพ็ก 500 QI + โบนัส 75") — ใบเสร็จยังใช้ titleFor เดิม */
export function titleWithBonus(row: FullPaymentRow): string {
  const base = titleFor(row)
  const q = qiReceivedOf(row)
  return q && q.bonus > 0 ? `${base} + โบนัส ${q.bonus.toLocaleString("th-TH")}` : base
}

export function statusWord(status: string): { text: string; paid: boolean; refunded: boolean } {
  const s = status.toUpperCase()
  if (s === "APPROVED") return { text: "สำเร็จ", paid: true, refunded: false }
  if (s === "REJECT") return { text: "ไม่สำเร็จ", paid: false, refunded: false }
  if (s.includes("REFUND") || s.includes("REVERS")) return { text: "คืนเงินแล้ว", paid: false, refunded: true }
  return { text: "รอตรวจสอบ", paid: false, refunded: false }
}

export function bahtOf(amountSatang: number): string {
  return `฿${(amountSatang / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`
}

export function methodWord(method: string): string {
  return method === "promptpay" ? "พร้อมเพย์ QR" : "บัตรเครดิต/เดบิต"
}

const bkkMonthKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).format(new Date(iso))
const bkkMonthLabel = (iso: string) => new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", year: "numeric", month: "long" }).format(new Date(iso))

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
      .then((j) => { if (alive) setRows(Array.isArray(j?.payments) ? j.payments : []) })
      .catch(() => { if (alive) { setErrored(true); setRows(null) } })
      .finally(() => { if (alive) setDone(true) })
    return () => { alive = false }
  }, [attempt])
  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { rows, done, errored, retry }
}

function receiptHref(row: FullPaymentRow): string {
  return `/v2/orders/${encodeURIComponent(row.chargeId || row.orderId || "")}`
}

export function OrdersScreen() {
  const { rows, done, errored, retry } = usePaymentRows()

  const { thisMonth, allTotal, groups } = useMemo(() => {
    const list = rows ?? []
    const approved = list.filter((r) => r.status === "APPROVED")
    const nowKey = bkkMonthKey(new Date().toISOString())
    const thisMonthSat = approved.filter((r) => bkkMonthKey(r.createdAt) === nowKey).reduce((s, r) => s + r.amountSatang, 0)
    const allSat = approved.reduce((s, r) => s + r.amountSatang, 0)
    const g: Array<{ key: string; label: string; rows: FullPaymentRow[] }> = []
    for (const r of list) {
      const key = bkkMonthKey(r.createdAt)
      const grp = g.find((x) => x.key === key)
      if (grp) grp.rows.push(r)
      else g.push({ key, label: bkkMonthLabel(r.createdAt), rows: [r] })
    }
    return { thisMonth: thisMonthSat, allTotal: allSat, groups: g }
  }, [rows])

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <SkyBackdrop />
      <Head><title>ประวัติคำสั่งซื้อ · MuMate</title></Head>
      <SkyHeader title="ประวัติการสั่งซื้อ" backHref="/v2/account" testId="orders" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-36 pt-2">
        {!done && <div aria-hidden className="h-[72px] w-full animate-pulse rounded-[24px] bg-white" data-testid="orders-loading" />}

        {done && errored && (
          <section className={CARD} data-testid="orders-error">
            <p className="text-sm font-bold text-v3-navy">โหลดประวัติไม่สำเร็จ</p>
            <button onClick={retry} className="mt-2 grid h-11 w-full place-items-center rounded-full bg-v3-navy text-sm font-bold text-white">ลองใหม่</button>
          </section>
        )}

        {done && !errored && rows && rows.length === 0 && (
          <section className={CARD} data-testid="orders-empty">
            <p className="text-[13px] leading-5 text-v3-text-body">ยังไม่มีคำสั่งซื้อ — ดูแพ็กเกจและแพ็ก QI ได้ที่ร้านค้า</p>
            <Link href="/v2/shop" data-testid="orders-empty-shop" className="mt-2 grid h-11 w-full place-items-center rounded-full bg-v3-navy text-sm font-bold text-white">ไปร้านค้า</Link>
          </section>
        )}

        {done && !errored && rows && rows.length > 0 && (
          <>
            {/* สรุปยอด — การ์ดขาว 2 ค่า (เฟรม spend-summary) */}
            <section className="v3-shadow-card flex items-stretch rounded-[24px] border border-v3-border-card bg-white px-5 py-4 text-center">
              <div className="flex-1 border-r border-v3-border-card">
                <p className="text-[11px] text-v3-text-muted">เดือนนี้</p>
                <p className="text-[20px] font-black text-[#8A5A0C]">{bahtOf(thisMonth)}</p>
              </div>
              <div className="flex-1">
                <p className="text-[11px] text-v3-text-muted">ทั้งหมด</p>
                <p className="text-[20px] font-black text-v3-navy">{bahtOf(allTotal)}</p>
              </div>
            </section>

            {groups.map((grp) => (
              <div key={grp.key}>
                <p className="mb-1 mt-1 px-1 text-[12px] font-bold text-v3-text-muted">{grp.label}</p>
                <ul className="flex flex-col divide-y divide-v3-border-card overflow-hidden rounded-[18px] border border-v3-border-card bg-white" data-testid="orders-list">
                  {grp.rows.map((row) => {
                    const st = statusWord(row.status)
                    return (
                      <li key={row.chargeId || row.orderId || row.createdAt}>
                        <Link href={receiptHref(row)} data-testid="orders-row" className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-medium text-v3-navy">{titleWithBonus(row)}</p>
                            <p className="text-[11px] text-v3-text-muted">{bkkCivilDate(row.createdAt)} · {methodWord(row.method)}</p>
                          </div>
                          <div className="flex flex-none flex-col items-end gap-1">
                            <span className="text-[14px] font-black text-v3-navy">{bahtOf(row.amountSatang)}</span>
                            <span className={"rounded-full px-2 py-[1px] text-[10px] font-black " + (st.refunded ? "bg-[#FDECEC] text-[#A83238]" : st.paid ? "bg-[#E3F4F7] text-[#14707E]" : "bg-v3-ghost-white text-v3-text-muted")}>{st.text}</span>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}

            <p className="px-1 pt-1 text-center text-[11px] leading-4 text-v3-text-muted">ใบเสร็จทุกใบส่งไปที่อีเมลของคุณ · เก็บย้อนหลัง 24 เดือน</p>
          </>
        )}
      </div>

      <Menubar />
    </div>
  )
}

export default OrdersScreen
