// features/v2-qi/components/QiBuyScreen.tsx — จอ "ซื้อ QI เพิ่ม" (/v2/qi/buy) — เฟรม `buy-qi — select pack`.
// Design: การ์ดยอดคงเหลือ + เลือกแพ็ก QI แบบ radio 4 ใบ (จำนวน+โบนัส+ถามเซียนได้กี่ครั้ง+ประหยัด%) +
// Mumate Pro upsell + ลิงก์ทำภารกิจฟรี + สรุปยอด (โบนัส/VAT/ยอดชำระ) + ปุ่มไปชำระเงินติดล่าง.
// จำนวน QI จาก QI_PACK_QTY + โบนัส QI_PACK_BONUS (fail-loud) · ราคาจาก /api/payment-package (แถวจริง).
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { CoinStack, KitButton, SkyHeader, SkyScreen } from "@/features/v2-profile/components/kit"
import { QI_PACK_CODES, VAT_RATE, qiBonusOf, qiQtyOf } from "@/lib/payment/catalog"

type PackRow = { package_code?: string; amount?: number | string; is_active?: boolean }
const TAG: Record<string, string> = { QI_500: "ยอดนิยม", QI_1200: "คุ้มที่สุด" }
// ริบบิ้นเต็มกว้างด้านบนการ์ด (เฟรม): ยอดนิยม = เหลืองมะนาว/navy · คุ้มที่สุด = ม่วงอ่อน/ม่วง
const RIBBON: Record<string, string> = { QI_500: "bg-[#CDDC39] text-v3-navy", QI_1200: "bg-[#F1E8FA] text-[#6F1BAF]" }
const CHAT_COST = 30 // chat_question — ใช้คำนวณ "ถามเซียนได้ N ครั้ง"
const thb = (n: number) => `฿${n.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`

export function QiBuyScreen() {
  const [rows, setRows] = useState<Record<string, PackRow | null>>({})
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<string>("QI_500")

  useEffect(() => {
    let alive = true
    setLoading(true)
    setFailed(false)
    Promise.all([
      Promise.all(
        QI_PACK_CODES.map(async (code) => {
          const res = await fetch(`/api/payment-package?code=${encodeURIComponent(code)}`)
          return [code, res.ok ? ((await res.json()) as PackRow) : null] as const
        }),
      ),
      fetch("/api/qi-wallet").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([pairs, wallet]) => {
        if (!alive) return
        const map: Record<string, PackRow | null> = {}
        let anyOk = false
        for (const [code, row] of pairs) {
          map[code] = row
          if (row) anyOk = true
        }
        setRows(map)
        setFailed(!anyOk)
        if (wallet && typeof wallet.qi === "number") setBalance(wallet.qi)
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const info = useMemo(() => {
    const amountOf = (code: string) => {
      const a = rows[code]?.amount
      return typeof a === "number" ? a : typeof a === "string" ? Number(a) : null
    }
    const base = (() => {
      const a = amountOf("QI_60")
      const t = (qiQtyOf("QI_60") ?? 0) + qiBonusOf("QI_60")
      return a && t ? a / t : null
    })()
    return QI_PACK_CODES.map((code) => {
      const qty = qiQtyOf(code) ?? 0
      const bonus = qiBonusOf(code)
      const total = qty + bonus
      const amount = amountOf(code)
      const active = Boolean(rows[code]?.is_active) && amount !== null && amount > 0
      const asks = Math.floor(total / CHAT_COST)
      const savings = base && amount ? Math.max(0, Math.round((1 - amount / total / base) * 100)) : 0
      const perAsk = amount && asks > 0 ? amount / asks : null
      return { code, qty, bonus, total, amount, active, asks, savings, perAsk }
    })
  }, [rows])

  const sel = info.find((p) => p.code === selected) ?? null
  const canPay = Boolean(sel?.active && sel?.amount)
  const vat = sel?.amount ? Math.round((sel.amount * VAT_RATE) / (1 + VAT_RATE)) : 0

  return (
    <SkyScreen>
      <Head><title>ซื้อ QI เพิ่ม · MuMate</title></Head>
      <SkyHeader title="ซื้อ QI เพิ่ม" testId="qi-buy" />

      {loading && (
        <div className="mt-3 flex flex-col gap-3" data-testid="qi-buy-loading">
          <div className="h-[92px] w-full animate-pulse rounded-[24px] bg-v3-sapphire/20" />
          <div className="h-[128px] w-full animate-pulse rounded-[24px] bg-v3-ghost-white" />
        </div>
      )}

      {!loading && failed && (
        <div className="v3-shadow-card mt-4 rounded-[24px] bg-white p-5 text-center" data-testid="qi-buy-error">
          <p className="text-sm font-bold text-v3-navy">โหลดแพ็ก QI ไม่สำเร็จ</p>
          <Link href="/v2/qi" className="mt-3 grid h-11 place-items-center rounded-full bg-v3-navy text-sm font-bold text-white">
            กลับหน้า QI
          </Link>
        </div>
      )}

      {!loading && !failed && (
        <div className="mt-3 flex flex-col gap-4 pb-24">
          {/* ยอดคงเหลือ — เหรียญ 氣 + ยอด (เฟรม current-balance) — แตะดูประวัติได้ */}
          <Link href="/v2/qi/history" className="flex items-center gap-3 rounded-[24px] bg-v3-sapphire px-4 py-4 text-white" data-testid="qi-buy-balance">
            <Image src="/images/v2/qi/qi-coin.png" alt="" width={48} height={48} className="size-12 flex-none rounded-full" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-white/85">ยอดคงเหลือปัจจุบัน</p>
              <p className="text-[18px] font-black text-v3-lime">{(balance ?? 0).toLocaleString("th-TH")} QI</p>
            </div>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-white/70"><path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>

          <div>
            <p className="mb-2 px-1 text-[15px] font-black text-v3-navy">เลือกแพ็ก QI</p>
            <div className="flex flex-col gap-2" data-testid="qi-buy-packs">
              {info.map((p, i) => {
                const on = selected === p.code
                return (
                  <button
                    key={p.code}
                    type="button"
                    disabled={!p.active}
                    onClick={() => setSelected(p.code)}
                    data-testid={`qi-pack-${p.code}`}
                    className={
                      "relative flex w-full flex-col overflow-hidden rounded-[24px] text-left transition " +
                      (on ? "bg-v3-navy text-white ring-2 ring-v3-lime" : "border border-v3-border-card bg-white") +
                      (p.active ? "" : " opacity-50")
                    }
                  >
                    {TAG[p.code] && p.active ? (
                      <span className={`w-full py-1 text-center text-[10px] font-black uppercase ${RIBBON[p.code]}`}>{TAG[p.code]}</span>
                    ) : null}
                    <div className="flex w-full items-center gap-3 px-4 py-3">
                      <span className={"grid size-5 flex-none place-items-center rounded-full border-2 " + (on ? "border-v3-lime" : "border-v3-border-card")}>
                        {on ? <span className="size-2.5 rounded-full bg-v3-lime" /> : null}
                      </span>
                      <CoinStack size={26} count={Math.min(i + 1, 4)} />
                      <div className="min-w-0 flex-1">
                        <p className={"flex flex-wrap items-center gap-1.5 text-[16px] font-black " + (on ? "text-white" : "text-v3-navy")}>
                          {p.qty.toLocaleString("th-TH")} QI
                          {p.bonus > 0 ? <span className="rounded-full bg-[#E3F8D1] px-2 py-[1px] text-[10px] font-black text-[#63B05F]">แถม +{p.bonus}</span> : null}
                        </p>
                        <p className={"text-[11px] " + (on ? "text-white/80" : "text-v3-text-muted")}>
                          {p.active ? `ถามเซียนมูได้ ${p.asks} ครั้ง` : "ปิดขายชั่วคราว"}
                        </p>
                      </div>
                      <div className="flex-none text-right">
                        <p className={"text-[17px] font-black " + (on ? "text-v3-lime" : "text-v3-navy")}>{p.amount !== null ? thb(p.amount) : "—"}</p>
                        {p.active && p.total > 0 && p.amount ? <p className={"text-[10px] " + (on ? "text-white/70" : "text-v3-text-muted")}>{thb(Math.round((p.amount / p.total) * 100) / 100)}/QI</p> : null}
                        {p.savings > 0 ? <p className="text-[10px] font-bold text-[#63B05F]">ประหยัด {p.savings}%</p> : null}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* หมายเหตุ QI ไม่หมดอายุ (เฟรม) */}
          <p className="px-1 text-[11px] leading-4 text-v3-text-muted">QI ที่ซื้อไม่มีวันหมดอายุ และใช้ร่วมกับ QI ที่ได้จากภารกิจได้</p>

          {/* Mumate Pro upsell (เฟรม: พื้นฟ้าอมเขียว + ตัวม่วง) */}
          <Link href="/v2/shop" className="flex items-center gap-3 rounded-[16px] bg-[#E3F4F7] px-4 py-3" data-testid="qi-buy-pro">
            <span aria-hidden className="grid size-10 flex-none place-items-center rounded-[12px] bg-[#FCE9F0] text-[18px]">💬</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-[#6F1BAF]">ใช้บ่อยกว่านี้? Mumate Pro ฿199 / เดือน</p>
              <p className="text-[11px] leading-4 text-[#6F1BAF]/80">ถ้าถามเซียนมูเกิน 20 ครั้งต่อเดือน สมัครคุ้มกว่าซื้อ QI</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-[#6F1BAF]"><path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>

          <Link href="/v2/qi/missions" data-testid="qi-buy-free" className="px-1 text-center text-[12px] font-bold text-v3-cyan">
            ไม่อยากจ่าย? ทำภารกิจรับ QI ฟรี ›
          </Link>

          {/* สรุปยอด */}
          {sel && sel.amount !== null && (
            <section className="flex flex-col gap-2 rounded-[16px] bg-[#FBF1F2] px-4 py-4 text-[13px]" data-testid="qi-buy-summary">
              <div className="flex items-center justify-between">
                <span className="text-v3-text-body">{sel.qty.toLocaleString("th-TH")} QI{sel.bonus > 0 ? ` + โบนัส ${sel.bonus} QI` : ""}</span>
                <span className="font-black text-v3-navy" data-testid="qi-buy-total">{sel.total.toLocaleString("th-TH")} QI</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-v3-text-body">VAT 7% (รวมแล้ว)</span>
                <span className="text-v3-text-muted" data-testid="qi-buy-vat">{thb(vat)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-black/5 pt-2">
                <span className="text-v3-text-body">ยอดชำระวันนี้</span>
                <span className="font-black text-v3-navy">{thb(sel.amount)}</span>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ปุ่มไปชำระเงินติดล่าง */}
      {!loading && !failed && sel && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-v3-border-card bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          {canPay ? (
            <KitButton href={`/v2/shop/checkout?package_code=${encodeURIComponent(sel.code)}`} testId="qi-buy-cta">
              ไปชำระเงิน {sel.amount !== null ? thb(sel.amount) : ""}
            </KitButton>
          ) : (
            <KitButton variant="outline" disabled testId="qi-buy-cta">แพ็กนี้ปิดขายชั่วคราว</KitButton>
          )}
          <p className="mt-2 text-center text-[10px] leading-4 text-v3-text-muted">ชำระผ่าน Omise · บัตรเครดิต, พร้อมเพย์, โอนธนาคาร</p>
        </div>
      )}
    </SkyScreen>
  )
}

export default QiBuyScreen
