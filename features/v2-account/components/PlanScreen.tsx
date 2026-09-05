// features/v2-account/components/PlanScreen.tsx — /v2/account/plan (เฟรม `my-plan`)
// แผนปัจจุบัน + สิทธิ์ + แบนเนอร์ upsell + เปลี่ยนแพ็กเกจ (Plus/Pro รายปี ราคาจริงจาก /api/payment-package).
// ข้อมูลแผนจาก useV2User (planFor — กติกาเดียวกับ AccountScreen).
import Head from "next/head"
import Link from "next/link"
import { useEffect, useState } from "react"

import { SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { useV2User } from "@/features/auth/hooks/useV2User"
import { SHOP_HREF } from "@/features/v2-shop/upgrade-cta"
import { PLANS } from "@/features/v2-shop/packages"
import type { Entitlements } from "@/features/v2-qi/qi-model"
import { planFor, type Plan } from "../plan"

const CARD = "v3-shadow-card flex w-full flex-col gap-3 rounded-[24px] bg-white p-5"

// การ์ดเปลี่ยนแพ็กเกจ (รายปี) — code สำหรับดึงราคาจริง + checkout
const UPGRADE = [
  { id: "plus", name: "Mumate +", tagline: "สำหรับคนใช้ประจำและสายมูระดับเริ่มต้น", code: "V2_PLUS_YEARLY", badge: "คุ้มค่าที่สุด", badgeTone: "bg-v3-pumpkin" },
  { id: "pro", name: "Mumate Pro", tagline: "สำหรับสายมูตัวจริง ปลดล็อกทุกฟีเจอร์", code: "V2_PRO_YEARLY", badge: "แนะนำ 🔥", badgeTone: "bg-v3-error" },
] as const

const PRO_MONTHLY = 199 // ราคาอ้างอิง Pro/เดือน (เฟรม my-plan upsell "฿318 · ประหยัด ฿119")
const bkkMonthKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).format(new Date(iso))

export function PlanScreen() {
  const { user, done, errored } = useV2User()
  const [prices, setPrices] = useState<Record<string, number | null>>({})
  const [selected, setSelected] = useState<string>("pro")
  const [spentQiBaht, setSpentQiBaht] = useState(0) // ยอดจ่ายค่าแพ็ก QI เดือนนี้ (บาท) — สำหรับ upsell ตัวเลขจริง
  const [ent, setEnt] = useState<Entitlements | null>(null) // สิทธิ์ + โควตาวันนี้ (badge เหลือ N/limit)

  useEffect(() => {
    let alive = true
    fetch("/api/qi-entitlements").then((x) => (x.ok ? x.json() : null)).then((j) => { if (alive) setEnt(j) }).catch(() => {})
    Promise.all(
      UPGRADE.map(async (u) => {
        const r = await fetch(`/api/payment-package?code=${u.code}`).then((x) => (x.ok ? x.json() : null)).catch(() => null)
        const amount = typeof r?.amount === "number" ? r.amount : typeof r?.amount === "string" ? Number(r.amount) : null
        return [u.id, r?.is_active && amount ? amount : null] as const
      }),
    ).then((pairs) => { if (alive) setPrices(Object.fromEntries(pairs)) })
    // ยอดซื้อแพ็ก QI (สำเร็จ) เดือนนี้ → upsell "เดือนนี้จ่ายค่า QI ไป ฿N"
    fetch("/api/v2/payment/status")
      .then((x) => (x.ok ? x.json() : null))
      .then((j) => {
        if (!alive) return
        const rows: Array<{ tierCode?: string; status?: string; amountSatang?: number; createdAt?: string }> = Array.isArray(j?.payments) ? j.payments : []
        const nowKey = bkkMonthKey(new Date().toISOString())
        const sat = rows
          .filter((r) => r.tierCode === "QI" && r.status === "APPROVED" && r.createdAt && bkkMonthKey(r.createdAt) === nowKey)
          .reduce((s, r) => s + (r.amountSatang ?? 0), 0)
        setSpentQiBaht(Math.round(sat / 100))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const membership = user?.membership ?? null
  const undetermined = !done || errored || membership == null || membership.isPaid == null
  const plan: Plan | null = undetermined ? null : planFor(membership)
  const features = plan ? PLANS.find((p) => p.id === (plan.level ?? "").toLowerCase())?.features ?? [] : []
  const isPaid = plan ? !plan.isFree : false

  const sel = UPGRADE.find((u) => u.id === selected)
  const selPrice = sel ? prices[sel.id] ?? null : null

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <SkyBackdrop />
      <Head><title>แพ็กเกจของฉัน · MuMate</title></Head>
      <SkyHeader title="แพ็กเกจของฉัน" backHref="/v2/account" testId="plan" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-36 pt-2">
        {undetermined ? (
          <section data-testid="plan-undetermined" className={CARD}>
            <div aria-hidden className="h-6 w-1/2 animate-pulse rounded bg-v3-border-card" />
            <div aria-hidden className="h-4 w-2/3 animate-pulse rounded bg-v3-border-card" />
          </section>
        ) : plan ? (
          <section className={CARD} data-testid="plan-card">
            <p data-testid="plan-heading" className="text-[20px] font-black leading-7 text-v3-navy">{plan.heading}</p>
            <p data-testid="plan-sub" className="text-sm leading-[22px] text-v3-text-body">{plan.sub}</p>
            {features.length > 0 && (
              <ul className="flex flex-col gap-2 border-t border-v3-border-card pt-3" data-testid="plan-features">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] leading-5 text-v3-text-body">
                    <span aria-hidden className="mt-[2px] grid size-4 flex-none place-items-center rounded-[6px] bg-v3-cyan text-[10px] font-black text-white">✓</span>
                    <span className="flex-1">{f}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] leading-4 text-v3-text-muted">โควตารายวัน/รายเดือนรีเซ็ตตามรอบ · ดวงสมพงษ์และปฏิทินนับตามรอบสมัคร</p>
            {plan.isFree ? (
              <Link href={SHOP_HREF} data-testid="plan-shop-cta" className="grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-base font-bold uppercase text-v3-lime">ดูแพ็คเกจ</Link>
            ) : null}
          </section>
        ) : null}

        {/* โควตาวันนี้ — badge เหลือ N/limit ต่อฟีเจอร์ (data จริงจาก entitlements/quota) */}
        {ent?.quota && (
          <section className={CARD} data-testid="plan-quota">
            <p className="text-[15px] font-bold text-v3-navy">โควตาวันนี้</p>
            {([
              { key: "card", label: "เปิดไพ่ / เสี่ยงทาย", q: ent.quota.card, credit: ent.credits?.card_use ?? 0 },
              { key: "chat", label: "ถามเซียนมู AI", q: ent.quota.chat, credit: ent.credits?.chat_question ?? 0 },
            ] as const).map(({ key, label, q, credit }) => {
              if (!q) return null
              const remaining = Math.max(0, q.limit - q.used)
              const out = remaining === 0
              return (
                <div key={key} className="flex items-center justify-between gap-3" data-testid={`plan-quota-${key}`}>
                  <span className="text-[13px] text-v3-text-body">{label}</span>
                  <span className={`flex-none rounded-full px-2.5 py-[2px] text-[11px] font-black ${out && credit === 0 ? "bg-[#FDECEC] text-[#A83238]" : "bg-[#E3F8D1] text-[#3F8F52]"}`}>
                    {out && credit === 0 ? "ใช้ครบแล้ววันนี้" : out ? `เหลือ ${credit} ครั้ง (ที่แลกไว้)` : `เหลือ ${remaining}/${q.limit} วันนี้`}
                  </span>
                </div>
              )
            })}
          </section>
        )}

        {/* แบนเนอร์ upsell (โชว์เมื่อยังไม่ Pro) — ตัวเลขจริงจากยอดซื้อ QI เดือนนี้ถ้ามี */}
        {!isPaid && (
          <div className="rounded-[20px] bg-[#EAF3FF] px-4 py-4 text-v3-sapphire" data-testid="plan-upsell">
            {spentQiBaht > PRO_MONTHLY ? (
              <>
                <p className="text-[14px] font-black">เดือนนี้คุณจ่ายค่า QI ไปแล้ว ฿{spentQiBaht.toLocaleString("th-TH")}</p>
                <p className="mt-1 text-[12px] leading-4">Mumate Pro ฿{PRO_MONTHLY}/เดือน ใช้ดวง/แชท/ปฏิทินได้ไม่จำกัด — ประหยัดกว่าเดือนละ ฿{(spentQiBaht - PRO_MONTHLY).toLocaleString("th-TH")}</p>
              </>
            ) : (
              <>
                <p className="text-[14px] font-black">อยากใช้ไม่จำกัด?</p>
                <p className="mt-1 text-[12px] leading-4">Mumate Pro ฿{PRO_MONTHLY}/เดือน ใช้ดวง/แชท/ปฏิทินได้ไม่จำกัด ประหยัดกว่าเติม QI ทีละแพ็กเมื่อใช้บ่อย</p>
              </>
            )}
          </div>
        )}

        {/* เปลี่ยนแพ็กเกจ */}
        <div>
          <p className="mb-2 px-1 text-[15px] font-black text-v3-navy">เปลี่ยนแพ็กเกจ</p>
          <div className="flex flex-col gap-2" data-testid="plan-selector">
            {UPGRADE.map((u) => {
              const on = selected === u.id
              const price = prices[u.id] ?? null
              const perDay = price ? Math.round((price / 365) * 10) / 10 : null
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelected(u.id)}
                  data-testid={`plan-select-${u.id}`}
                  className={"relative flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left " + (on ? "bg-white ring-2 ring-[#6F1BAF] v3-shadow-card" : "border border-v3-border-card bg-white")}
                >
                  <span className={"grid size-5 flex-none place-items-center rounded-full border-2 " + (on ? "border-[#6F1BAF]" : "border-v3-border-card")}>
                    {on ? <span className="size-2.5 rounded-full bg-[#6F1BAF]" /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[15px] font-black text-v3-navy">{u.name}</p>
                      <span className={`rounded-full px-2 py-[2px] text-[10px] font-black text-white ${u.badgeTone}`}>{u.badge}</span>
                    </div>
                    <p className="text-[11px] leading-4 text-v3-text-muted">{u.tagline}</p>
                  </div>
                  <div className="flex-none text-right">
                    <p className="text-[15px] font-black text-v3-navy">{price !== null ? `฿${price.toLocaleString("th-TH")}` : "—"} <span className="text-[11px] font-bold text-v3-text-muted">/ ปี</span></p>
                    {perDay !== null ? <p className="text-[10px] text-v3-text-muted">ตกวันละ {perDay} บาท</p> : null}
                  </div>
                </button>
              )
            })}
          </div>
          {sel && selPrice !== null && (
            <Link href={`/v2/shop/checkout?package_code=${sel.code}`} data-testid="plan-upgrade-cta" className="mt-3 grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-[15px] font-bold uppercase text-v3-lime">
              สมัคร {sel.name} · ฿{selPrice.toLocaleString("th-TH")}/ปี
            </Link>
          )}
          <p className="mt-2 px-1 text-center text-[11px] leading-4 text-v3-text-muted">ยกเลิกได้ทุกเมื่อ ใช้ได้จนหมดรอบที่จ่ายไป · QI ที่มีอยู่ไม่หายไปไหน</p>
        </div>

        <Link href="/v2/orders" data-testid="plan-orders-link" className="flex items-center justify-between rounded-[20px] border border-v3-border-card bg-white px-5 py-4">
          <span className="text-sm font-bold text-v3-navy">ประวัติคำสั่งซื้อและใบเสร็จ</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-v3-text-muted"><path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
      </div>

      <Menubar />
    </div>
  )
}

export default PlanScreen
