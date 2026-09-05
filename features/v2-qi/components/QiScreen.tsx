// features/v2-qi/components/QiScreen.tsx — จอ "คู่มือพลังชี่" (/v2/qi).
//
// Design: Figma frame `qi-guide — UX v2` (55399:7219) — เป็น "คู่มือ" (read-mostly):
//   hero orb + หัวข้อ/คำอธิบาย · การ์ดยอดคงเหลือ (เรียบ + chevron) · สะสมพลังชี่ฟรี (earn list ข้อมูล + "ทำเลย"→ภารกิจ)
//   · ใช้พลังชี่แลกอะไรได้บ้าง (spend list, −N QI แดง) · ทางไหนคุ้มกับคุณ (เปรียบเทียบ) · ปุ่มท้าย (เช็คอิน/ภารกิจ).
// การ "รับ" QI จริงอยู่ที่จอเช็คอิน/ภารกิจ (ลิงก์ออกไป) — คู่มือนี้ไม่มีปุ่มรับรายบรรทัด.
// แต่ spend list ยัง "แตะเพื่อแลกได้" (เปิดชีตยืนยัน) เพราะเป็นทางเดียวที่ redeem สิทธิ์ catalog (chat/card/course/…)
// นอกจาก birth-edit — ลบออกจะทำให้ฟีเจอร์หาย. Identity = cookie-mumate-id (BFF → anonId).
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { SpendConfirmSheet, InsufficientQiSheet } from "./QiSpendSheets"
import { SectionCard, SkyHeader, SkyScreen } from "@/features/v2-profile/components/kit"
import { checkedInToday, todayBangkok, type QiCatalog, type QiSpendLine, type Referral, type Wallet } from "../qi-model"

// รูปไอคอนจริง (ตาม Figma) แทน emoji — earn 48px / spend 36px
const EARN_THUMB: Record<string, string> = {
  daily_login: "earn-login",
  signup: "earn-login",
  share: "earn-share",
  referral_free: "earn-refer",
  referral_pro: "earn-refer",
  referral_plus: "earn-refer",
  wuxing_matrix: "earn-refer",
}
const SPEND_THUMB: Record<string, string> = {
  chat_question: "burn-aichat",
  card_use: "burn-cards",
  matching_slot: "burn-slot",
  course_destiny: "burn-course",
  book_lifecode: "burn-lifecode",
  plus_month: "burn-plus",
}
const earnThumb = (code: string) => `/images/v2/qi/${EARN_THUMB[code] ?? "earn-login"}.png`
const spendThumb = (code: string) => `/images/v2/qi/${SPEND_THUMB[code] ?? "burn-aichat"}.png`

// มูลค่าจริง (บาท) ของสิทธิ์ที่แลกด้วย QI — โชว์ "มูลค่า ฿N" ตามเฟรมคู่มือ (เฉพาะเส้นที่มีมูลค่าเงิน)
const SPEND_BAHT: Record<string, number> = { course_destiny: 499, book_lifecode: 1890, plus_month: 790 }

const COMPARE = [
  { key: "free", title: "สะสมฟรีอย่างเดียว", price: "0 บาท", desc: "เช็คอิน ทำภารกิจ ชวนเพื่อน — ค่อย ๆ สะสม", highlight: false },
  { key: "once", title: "ซื้อ QI เป็นแพ็ก", price: "เริ่ม ฿35", desc: "เติมเมื่ออยากใช้ทันที ไม่ผูกมัดรายเดือน", highlight: false },
  { key: "pro", title: "Mumate Pro", price: "฿199 / เดือน", desc: "ถ้าถามเซียนมูเกิน 20 ครั้ง/เดือน คุ้มกว่าซื้อ QI", highlight: true },
]

type SheetState = { kind: "confirm" | "insufficient"; line: QiSpendLine } | null

// เหรียญ QI เล็ก ๆ ลอยรอบ orb (ฟีม 2026-09-05: เดิมเป็นวงกลมทอง "$" → เปลี่ยนเป็นเหรียญ 氣 จริง + ลอยขึ้นลง).
// `delay` ทำให้แต่ละเหรียญ bob คนละจังหวะ (ไม่ขยับพร้อมกันจนดูแข็ง). ปิดเมื่อ prefers-reduced-motion.
function CoinBadge({ style, delay = 0 }: { style: React.CSSProperties; delay?: number }) {
  return (
    <img
      src="/images/v2/qi/qi-coin.png"
      alt=""
      aria-hidden
      className="qi-coin-float absolute object-contain drop-shadow-[0px_2px_3px_rgba(0,0,0,0.18)]"
      style={{ ...style, animationDelay: `${delay}s` }}
    />
  )
}

function CoinFloatStyle() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
    @keyframes qi-coin-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
    .qi-coin-float{animation:qi-coin-float 2.6s ease-in-out infinite;will-change:transform}
    @media(prefers-reduced-motion:reduce){.qi-coin-float{animation:none!important}}
  ` }} />
  )
}

export function QiScreen() {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [referral, setReferral] = useState<Referral | null>(null)
  const [catalog, setCatalog] = useState<QiCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [guard, setGuard] = useState<"not_authenticated" | null>(null)
  const [busyCheckin, setBusyCheckin] = useState(false)
  const [sheet, setSheet] = useState<SheetState>(null)

  const load = useCallback(async () => {
    try {
      const [w, r, c] = await Promise.all([
        fetch("/api/qi-wallet"),
        fetch("/api/referral"),
        fetch("/api/qi-catalog"),
      ])
      if (w.status === 401) {
        setGuard("not_authenticated")
        return
      }
      if (w.ok) setWallet(await w.json())
      if (r.ok) setReferral(await r.json())
      if (c.ok) setCatalog(await c.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const checkin = async () => {
    setBusyCheckin(true)
    try {
      const res = await fetch("/api/qi-earn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "daily_login" }),
      })
      if (res.ok) await load()
    } finally {
      setBusyCheckin(false)
    }
  }

  const checkedIn = checkedInToday(wallet?.history, todayBangkok())
  const balance = wallet?.qi ?? 0
  const openSpend = (line: QiSpendLine) =>
    setSheet(balance >= line.qi ? { kind: "confirm", line } : { kind: "insufficient", line })

  return (
    <SkyScreen>
      <Head>
        <title>คู่มือพลังชี่ — Mumate</title>
      </Head>
      <SkyHeader title="คู่มือพลังชี่" testId="qi" />

      {loading && (
        <div className="mt-3" data-testid="qi-loading">
          <div className="mx-auto size-[160px] animate-pulse rounded-full bg-v3-sapphire/15" />
          <div className="mt-4 h-[150px] w-full animate-pulse rounded-[24px] bg-white" />
        </div>
      )}

      {!loading && guard === "not_authenticated" && (
        <div className="v3-shadow-card mt-4 rounded-[24px] bg-white p-5 text-center" data-testid="qi-guard-auth">
          <p className="text-sm font-bold text-v3-navy">ไม่พบข้อมูลผู้ใช้</p>
          <Link href="/v2/login" className="mt-3 grid h-11 place-items-center rounded-full bg-v3-navy text-sm font-bold text-white">
            เข้าสู่ระบบ
          </Link>
        </div>
      )}

      {!loading && !guard && (
        <div className="mt-2 flex flex-col gap-5">
          {/* hero: orb 氣 + เหรียญลอย + หัวข้อ/คำอธิบาย (เฟรม qi-guide v2) */}
          <section className="flex flex-col items-center gap-3 pt-1 text-center">
            <h2 className="text-[26px] font-black leading-9 text-v3-navy">คู่มือสะสมและใช้พลังชี่</h2>
            <p className="max-w-xs text-[13px] leading-5 text-v3-text-body">
              QI คือแต้มสะสมจากกิจกรรมดี ๆ ใช้ปลดล็อกฟีเจอร์ดูดวงและของรางวัลต่าง ๆ ในแอป
            </p>
            <div className="relative size-[160px]">
              <CoinFloatStyle />
              <CoinBadge delay={0} style={{ left: 8, top: 20, width: 24, height: 24 }} />
              <CoinBadge delay={0.5} style={{ right: 4, top: 44, width: 28, height: 28 }} />
              <CoinBadge delay={1} style={{ left: 2, top: 112, width: 20, height: 20 }} />
              <CoinBadge delay={1.4} style={{ right: 18, top: 128, width: 26, height: 26 }} />
              <div className="absolute left-1/2 top-1/2 grid size-[120px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[rgba(245,165,42,0.28)]" style={{ boxShadow: "0px 0px 15px rgba(245,165,42,0.4)" }}>
                <div className="size-[96px] overflow-hidden rounded-full border-[3px] border-[#6F1BAF]" style={{ boxShadow: "0px 0px 32px rgba(111,27,175,0.3)" }}>
                  <Image src="/images/v2/qi/qi-orb.png" alt="" width={96} height={96} className="size-full object-cover" />
                </div>
              </div>
            </div>
          </section>

          {/* การ์ดยอดคงเหลือ — เรียบ + chevron (แตะดูประวัติ) */}
          <Link href="/v2/qi/history" data-testid="qi-wallet" className="flex items-center gap-3 rounded-[24px] bg-v3-sapphire p-5 text-white">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] leading-4 text-white/75">ยอดคงเหลือปัจจุบัน</p>
              <p className="mt-1 flex items-end gap-1">
                <span className="text-[36px] font-black leading-[40px]" data-testid="qi-balance">{balance.toLocaleString("th-TH")}</span>
                <span className="pb-1 text-[18px] font-black text-v3-lime">QI</span>
              </p>
            </div>
            <span aria-hidden className="relative size-12 flex-none overflow-hidden rounded-full bg-white/10">
              <Image src="/images/v2/qi/qi-coin.png" alt="" width={40} height={40} unoptimized className="mx-auto mt-1 size-10 object-contain" />
            </span>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-white/70"><path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <Link href="/v2/qi/buy" data-testid="qi-topup-link" className="-mt-2 grid h-11 w-full place-items-center rounded-full bg-v3-lime text-[14px] font-black uppercase text-v3-navy">
            เติม QI
          </Link>

          {/* สะสมพลังชี่ฟรี — earn list (ข้อมูล; รับจริงที่ภารกิจ/เช็คอิน) */}
          <SectionCard className="!rounded-[24px]" testId="qi-tasks">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-v3-navy">สะสมพลังชี่ฟรี</h2>
              <Link href="/v2/qi/missions" data-testid="qi-missions-link" className="text-[13px] font-bold text-v3-cyan">
                ทำเลย →
              </Link>
            </div>
            <div className="mt-3 flex flex-col divide-y divide-v3-border-card">
              {(catalog?.earn ?? []).map((line) => (
                <div key={line.code} data-testid={`qi-earn-${line.code}`} className="flex items-center gap-3 py-3">
                  <span className="relative size-11 flex-none overflow-hidden rounded-[12px]">
                    <Image src={earnThumb(line.code)} alt="" fill sizes="44px" className="object-cover" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-v3-text-body">{line.title}</p>
                    <p className="truncate text-[11px] leading-4 text-v3-text-muted">{line.note}</p>
                  </div>
                  <span className="flex-none text-[14px] font-black text-[#63B05F]">+{line.qi.toLocaleString("th-TH")} QI</span>
                </div>
              ))}
              {!catalog && <div className="h-[64px] w-full animate-pulse rounded-[16px] bg-v3-ghost-white" />}
            </div>
          </SectionCard>

          {/* ใช้พลังชี่แลกอะไรได้บ้าง — spend list (แตะเพื่อแลกได้; −N QI แดง) */}
          <SectionCard className="!rounded-[24px]" testId="qi-redeem">
            <h2 className="text-[18px] font-bold text-v3-navy">ใช้พลังชี่แลกอะไรได้บ้าง</h2>
            <div className="mt-3 flex flex-col divide-y divide-v3-border-card">
              {(catalog?.spend ?? []).map((line) => (
                <button
                  key={line.code}
                  type="button"
                  onClick={() => openSpend(line)}
                  data-testid={`qi-redeem-${line.code}`}
                  className="flex w-full items-center gap-3 py-3 text-left"
                >
                  <span className="relative size-9 flex-none overflow-hidden rounded-[10px]">
                    <Image src={spendThumb(line.code)} alt="" fill sizes="36px" className="object-cover" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-v3-text-body">{line.title}</p>
                    {SPEND_BAHT[line.code] ? (
                      <p className="truncate text-[12px] font-semibold text-v3-cyan">(มูลค่า {SPEND_BAHT[line.code].toLocaleString("th-TH")}฿)</p>
                    ) : line.note ? (
                      <p className="truncate text-[11px] leading-4 text-v3-text-muted">{line.note}</p>
                    ) : null}
                  </div>
                  <span className="flex-none text-[14px] font-black text-v3-error">−{line.qi.toLocaleString("th-TH")} QI</span>
                </button>
              ))}
              {!catalog && <div className="h-[64px] w-full animate-pulse rounded-[16px] bg-v3-ghost-white" />}
            </div>
          </SectionCard>

          {/* ทางไหนคุ้มกับคุณ — ลิสต์แนวตั้ง + badge "คุ้มสุด" ที่ Pro (เฟรม compare) */}
          <SectionCard className="!rounded-[24px]" testId="qi-compare">
            <h2 className="text-[18px] font-bold text-v3-navy">ทางไหนคุ้มกับคุณ</h2>
            <div className="mt-3 flex flex-col gap-2">
              {COMPARE.map((c) => (
                <div
                  key={c.key}
                  className={
                    "relative flex items-center gap-3 rounded-[16px] px-4 py-3 " +
                    (c.highlight ? "bg-v3-navy text-white" : "border border-v3-border-card bg-white")
                  }
                >
                  <div className="min-w-0 flex-1">
                    <p className={"flex items-center gap-2 text-[14px] font-black " + (c.highlight ? "text-white" : "text-v3-navy")}>
                      {c.title}
                      {c.highlight ? <span className="rounded-full bg-v3-lime px-2 py-[1px] text-[10px] font-black text-v3-navy">คุ้มสุด</span> : null}
                    </p>
                    <p className={"mt-0.5 text-[11px] leading-4 " + (c.highlight ? "text-white/80" : "text-v3-text-muted")}>{c.desc}</p>
                  </div>
                  <p className={"flex-none text-[15px] font-black " + (c.highlight ? "text-v3-lime" : "text-v3-navy")}>{c.price}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ชวนเพื่อน — ลิงก์ไปหน้าชวนเพื่อน (เต็มรูปที่ /v2/qi/referral) */}
          <Link href="/v2/qi/referral" data-testid="qi-referral-link" className="flex items-center gap-3 rounded-[24px] border border-v3-border-card bg-white px-4 py-4">
            <span aria-hidden className="relative size-10 flex-none overflow-hidden rounded-[12px]">
              <Image src="/images/v2/qi/earn-refer.png" alt="" fill sizes="40px" className="object-cover" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-v3-navy">ชวนเพื่อน รับคนละ 50 QI</p>
              <p className="text-[12px] leading-4 text-v3-text-body">เพื่อนสมัครผ่านโค้ด — เพื่อนได้ +30 QI คุณได้ +50 QI</p>
            </div>
            <span className="flex-none text-[16px] font-bold text-v3-text-muted">›</span>
          </Link>

          {/* ปุ่มท้าย (Figma footer-cta) */}
          {!checkedIn ? (
            <button
              onClick={() => void checkin()}
              disabled={busyCheckin}
              data-testid="qi-cta-checkin"
              className="grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-[15px] font-bold uppercase text-v3-lime disabled:opacity-40"
            >
              {busyCheckin ? "กำลังบันทึก..." : "เริ่มสะสมพลังชี่วันนี้ รับ +5 QI"}
            </button>
          ) : (
            <Link href="/v2/qi/missions" data-testid="qi-cta-checkin" className="grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-[15px] font-bold uppercase text-v3-lime">
              ทำภารกิจรับ QI เพิ่ม
            </Link>
          )}
          <Link href="/v2/qi/history" data-testid="qi-history-link" className="-mt-2 text-center text-[13px] font-bold text-v3-cyan">
            ดูประวัติการได้รับและใช้ QI →
          </Link>
        </div>
      )}

      {sheet?.kind === "confirm" && (
        <SpendConfirmSheet
          line={sheet.line}
          balance={balance}
          onClose={() => setSheet(null)}
          onSpent={(qiLeft) => {
            setWallet((w) => (w ? { ...w, qi: qiLeft } : w))
            setSheet(null)
            void load()
          }}
          onInsufficient={() => {
            setSheet({ kind: "insufficient", line: sheet.line })
            void load()
          }}
        />
      )}
      {sheet?.kind === "insufficient" && (
        <InsufficientQiSheet
          line={sheet.line}
          balance={balance}
          onClose={() => setSheet(null)}
          hints={{
            checkinQi: catalog?.earn.find((e) => e.code === "daily_login")?.qi,
            shareQi: catalog?.earn.find((e) => e.code === "share")?.qi,
          }}
        />
      )}
    </SkyScreen>
  )
}

export default QiScreen
