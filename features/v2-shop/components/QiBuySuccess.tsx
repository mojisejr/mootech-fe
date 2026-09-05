// features/v2-shop/components/QiBuySuccess.tsx — จอ "เติม QI สำเร็จ" เฉพาะแพ็ก QI (เฟรม buy-qi — success 55399:5425)
// แสดงเฉพาะเมื่อชำระสำเร็จจริง (paid) — ยอดคงเหลือใหม่ + delta (ก่อน→หลัง) + ใช้ได้กี่ครั้ง + ใบเสร็จย่อ.
// ยอดใหม่อ่านจาก /api/qi-wallet (ความจริงเดียว), delta = qty+bonus ของแพ็ก, ก่อน = ใหม่−delta.
import Link from "next/link"
import { useEffect, useState } from "react"

import { KitButton } from "@/features/v2-profile/components/kit"
import { qiBonusOf, qiQtyOf } from "@/lib/payment/catalog"
import { bahtOf, methodWord, type FullPaymentRow } from "@/features/v2-account/components/OrdersScreen"

const CHAT_COST = 30
const CARD_COST = 10

export function QiBuySuccess({ packageCode, charge, order }: { packageCode: string; charge: string; order: string }) {
  const qty = qiQtyOf(packageCode) ?? 0
  const bonus = qiBonusOf(packageCode)
  const delta = qty + bonus

  const [balance, setBalance] = useState<number | null>(null)
  const [row, setRow] = useState<FullPaymentRow | null>(null)

  useEffect(() => {
    let alive = true
    fetch("/api/qi-wallet")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && typeof j?.qi === "number") setBalance(j.qi) })
      .catch(() => {})
    fetch("/api/v2/payment/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return
        const rows: FullPaymentRow[] = Array.isArray(j?.payments) ? j.payments : []
        setRow(rows.find((r) => (charge && r.chargeId === charge) || (order && r.orderId === order)) ?? null)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [charge, order])

  const before = balance !== null ? Math.max(0, balance - delta) : null
  const asks = balance !== null ? Math.floor(balance / CHAT_COST) : Math.floor(delta / CHAT_COST)
  const cards = balance !== null ? Math.floor(balance / CARD_COST) : Math.floor(delta / CARD_COST)

  return (
    <div data-testid="qi-buy-success" className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-8 font-ibm">
      <span aria-hidden className="grid size-16 place-items-center rounded-full bg-v3-success-bg text-3xl text-v3-success-text">✓</span>
      <div className="text-center">
        <h1 className="text-2xl font-bold leading-8 text-v3-navy" data-testid="qi-success-title">เติม QI สำเร็จ</h1>
        <p className="mt-1 text-sm leading-[22px] text-v3-text-body">พลังชี่ของคุณพร้อมใช้งานแล้ว</p>
      </div>

      {/* การ์ดยอดคงเหลือใหม่ + delta */}
      <section className="w-full rounded-[24px] bg-v3-sapphire p-5 text-white" data-testid="qi-success-balance">
        <p className="text-[13px] text-white/85">ยอดคงเหลือใหม่</p>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="text-[34px] font-black leading-none text-v3-lime">{(balance ?? delta).toLocaleString("th-TH")}</span>
          <span className="text-[16px] font-black text-v3-lime">QI</span>
        </p>
        {before !== null ? (
          <span className="mt-3 inline-block rounded-full bg-white/15 px-3 py-1 text-[12px] font-bold text-white">
            {before.toLocaleString("th-TH")} → {balance!.toLocaleString("th-TH")} QI · เพิ่มขึ้น {delta.toLocaleString("th-TH")}
          </span>
        ) : (
          <span className="mt-3 inline-block rounded-full bg-white/15 px-3 py-1 text-[12px] font-bold text-white">เพิ่มขึ้น {delta.toLocaleString("th-TH")} QI</span>
        )}
        <p className="mt-3 text-[13px] leading-[18px] text-white/90">พอถามเซียนมู AI ได้อีก {asks} ครั้ง หรือเปิดไพ่ได้ {cards} ครั้ง</p>
      </section>

      {/* ใบเสร็จย่อ */}
      {row ? (
        <section className="v3-shadow-card flex w-full flex-col gap-2 rounded-[24px] bg-white p-5 text-[13px]" data-testid="qi-success-receipt">
          <div className="flex items-center justify-between"><span className="text-v3-text-body">แพ็กที่ซื้อ</span><b className="text-v3-navy">{qty.toLocaleString("th-TH")} QI{bonus > 0 ? ` + แถม ${bonus.toLocaleString("th-TH")}` : ""}</b></div>
          <div className="flex items-center justify-between"><span className="text-v3-text-body">ยอดชำระ</span><b className="text-v3-navy">{bahtOf(row.amountSatang)}</b></div>
          <div className="flex items-center justify-between"><span className="text-v3-text-body">วิธีชำระ</span><b className="text-v3-navy">{methodWord(row.method)}</b></div>
          {row.orderId ? <div className="flex items-center justify-between gap-3"><span className="text-v3-text-body">เลขที่ใบเสร็จ</span><b className="break-all text-right text-v3-navy">{row.orderId}</b></div> : null}
          <p className="mt-1 text-[11px] leading-4 text-v3-text-muted">ส่งใบเสร็จไปที่อีเมลของคุณแล้ว · ออกโดย Omise</p>
        </section>
      ) : null}

      <div className="flex w-full flex-col gap-2">
        <KitButton href="/v2/chat" testId="qi-success-chat">ถามเซียนมูเลย</KitButton>
        <Link href="/v2/qi" data-testid="qi-success-wallet" className="grid h-12 w-full place-items-center rounded-full border border-v3-sapphire bg-white text-[15px] font-bold text-v3-sapphire">
          ดูพลังชี่ของฉัน
        </Link>
      </div>
    </div>
  )
}

export default QiBuySuccess
