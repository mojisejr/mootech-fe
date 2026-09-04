// features/v2-account/components/AccountScreen.tsx — จอ "โปรไฟล์" (/v2/account) = แดชบอร์ดรวม
// เฟรม `profile-and-qi-wallet — UX v2` (55399:4904). โครงตาม Figma เป๊ะ:
// หัวจอ(ย้อน+avatar+ชื่อ+ธาตุ·tier+ตั้งค่า›) · การ์ดธาตุ(ขาว+badge ในสุด+มาสคอต) · การ์ด QI(orb 氣+?) ·
// เช็คอิน(ช่องสี่เหลี่ยม+footer โบนัส) · ภารกิจ(ไอคอนจริง) · การ์ดรวม เพื่อน+แผน · ความเคลื่อนไหว(มีวันที่).
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Menubar } from "@/features/v2-shell/components/Menubar"
import { useV2User } from "@/features/auth/hooks/useV2User"
import { SHOP_HREF } from "@/features/v2-shop/upgrade-cta"
import { BackButton, IconTile, KitButton, SectionCard, SkyBackdrop } from "@/features/v2-profile/components/kit"
import { iconFor } from "@/features/v2-qi/components/MissionsScreen"
import { resolveMascot, toNakkasat } from "@/lib/personalization"
import { checkedInToday, checkinStreak, reasonLabel, todayBangkok, type MissionBoard, type Wallet } from "@/features/v2-qi/qi-model"
import { bkkCivilDate } from "../payment-history"
import { planFor, type Plan } from "../plan"

type Profile = { firstName?: string | null; displayName?: string | null; birthDate?: string | null; birthTime?: string | null }
type ElementSummary = { elementTh?: string | null; tagline?: string | null; traits?: string[] } | null
type Referral = { invitedCount?: number }

const CHAT_COST = 30
const TIER_LABEL: Record<string, string> = { free: "Free Tier", plus: "PLUS", pro: "PRO" }
const ELEMENT_TH: Record<string, string> = { wood: "ไม้", metal: "ทอง", fire: "ไฟ", earth: "ดิน", water: "น้ำ" }

/** นักษัตร (ปีเกิด) จากปี ค.ศ. ของ birthDate — สำหรับเลือกมาสคอต */
function nakkasatFromBirth(birthDate?: string | null): string | null {
  if (!birthDate) return null
  const year = Number(birthDate.slice(0, 4))
  if (!Number.isFinite(year) || year < 1) return null
  const branchId = (((year - 4) % 12) + 12) % 12 + 1
  return toNakkasat(branchId)
}

function last7(today: string): string[] {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" })
  const out: string[] = []
  let cur = today
  for (let i = 0; i < 7; i += 1) {
    out.unshift(cur)
    const [y, m, d] = cur.split("-").map(Number)
    cur = fmt.format(new Date(Date.UTC(y, m - 1, d - 1, 12)))
  }
  return out
}

const CHEVRON = <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-v3-text-muted"><path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
const CHECK_SM = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>

export function AccountScreen() {
  const { user } = useV2User()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [element, setElement] = useState<ElementSummary>(null)
  const [board, setBoard] = useState<MissionBoard | null>(null)
  const [referral, setReferral] = useState<Referral | null>(null)
  const [deletePending, setDeletePending] = useState<string | null>(null)
  const [busyCheckin, setBusyCheckin] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const load = useCallback(async () => {
    const [w, p, m, r, del] = await Promise.all([
      fetch("/api/qi-wallet?history=100").then((x) => (x.ok ? x.json() : null)).catch(() => null),
      fetch("/api/profile").then((x) => (x.ok ? x.json() : null)).catch(() => null),
      fetch("/api/missions").then((x) => (x.ok ? x.json() : null)).catch(() => null),
      fetch("/api/referral").then((x) => (x.ok ? x.json() : null)).catch(() => null),
      fetch("/api/v2/account/delete").then((x) => (x.ok ? x.json() : null)).catch(() => null),
    ])
    setWallet(w)
    const prof: Profile | null = p?.profile ?? null
    setProfile(prof)
    setBoard(m)
    setReferral(r)
    setDeletePending(del?.deletion?.purgeAt ?? null)
    if (prof?.birthDate) {
      fetch("/api/bazi/element-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: { birthDate: prof.birthDate, birthTime: prof.birthTime ?? undefined } }),
      })
        .then((x) => (x.ok ? x.json() : null))
        .then((j) => setElement(j?.summary ?? null))
        .catch(() => setElement(null))
    } else {
      setElement(null)
    }
  }, [])

  useEffect(() => { void load() }, [load, attempt])

  const checkin = async () => {
    setBusyCheckin(true)
    try {
      const res = await fetch("/api/qi-earn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "daily_login" }) })
      if (res.ok) setAttempt((a) => a + 1)
    } finally {
      setBusyCheckin(false)
    }
  }

  const membership = user?.membership ?? null
  const plan: Plan | null = membership ? planFor(membership) : null
  const balance = wallet?.qi ?? 0
  const history = wallet?.history ?? []
  const today = todayBangkok()
  const done = checkedInToday(history, today)
  const streak = checkinStreak(history, today)
  const asks = Math.floor(balance / CHAT_COST)
  const cards = Math.floor(balance / 10) // เปิดไพ่/เสี่ยงทาย = 10 QI (card_use)

  const mascot = useMemo(() => {
    if (!profile?.birthDate) return null
    const el = element?.elementTh
    if (!el) return null
    return resolveMascot(nakkasatFromBirth(profile.birthDate), el)
  }, [profile, element])

  const daily = (board?.missions ?? []).filter((m) => m.category === "daily").slice(0, 2)
  const goals = board?.goals
  const friends = referral?.invitedCount ?? goals?.referral.invited ?? 0
  const days = last7(today)
  const claimedSet = new Set(history.filter((h) => h.reason === "qi:earn:daily_login").map((h) => h.createdAt.slice(0, 10)))
  const missingElements = goals ? goals.element.elements.filter((e) => !e.collected).map((e) => ELEMENT_TH[e.key] ?? e.key) : []

  const name = profile?.firstName || "ผู้ใช้ MuMate"
  const tierKey = membership?.tier ?? "free"
  const isPaid = plan?.isFree === false

  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-white font-ibm">
      <SkyBackdrop />
      <Head><title>โปรไฟล์ · MuMate</title></Head>
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-40">
        {/* หัวจอ: ย้อน + avatar + ชื่อ + ธาตุ · tier + ปุ่มตั้งค่า› */}
        <header className="flex items-center gap-2 pt-[max(0.9rem,env(safe-area-inset-top))]" data-testid="account-header">
          <BackButton fallbackHref="/v2" testId="account-back" />
          <span aria-hidden className="relative size-11 flex-none overflow-hidden rounded-full bg-white shadow-[0_2px_8px_rgba(26,38,77,.15)]">
            <Image src={mascot?.character ?? "/images/v2/mascot/01-nav.png"} alt="" fill sizes="44px" style={{ objectFit: "cover" }} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[22px] font-black leading-7 text-v3-navy" data-testid="account-greeting">{name}</p>
            <p className="text-[13px] leading-[18px] text-v3-text-body">
              {mascot ? `${mascot.elementLabelTh} · ` : ""}{TIER_LABEL[tierKey] ?? tierKey}
            </p>
          </div>
          <Link href="/v2/settings" data-testid="account-settings-link" className="flex flex-none items-center gap-1 rounded-full border border-v3-border-card bg-white px-3 py-1.5 text-[13px] font-medium text-v3-text-body">
            ตั้งค่า <span className="text-v3-text-muted">›</span>
          </Link>
        </header>

        {deletePending && (
          <Link href="/v2/settings/delete-account" data-testid="account-delete-pending" className="v3-shadow-card mt-4 flex w-full flex-col rounded-[20px] border-2 border-v3-pumpkin bg-white p-4">
            <p className="text-[14px] font-bold text-v3-pumpkin">บัญชีอยู่ระหว่างพักลบ — ยกเลิกได้</p>
            <p className="text-[12px] leading-4 text-v3-text-body">กดเพื่อดูสถานะหรือยกเลิกการลบ</p>
          </Link>
        )}

        <div className="mt-3 flex flex-col gap-3">
          {/* การ์ดธาตุของคุณ — ขาว + badge ในสุด + มาสคอต (เฟรม user-profile-card) */}
          {mascot ? (
            <section className="v3-shadow-card flex flex-col gap-3 rounded-[20px] bg-white p-4" data-testid="account-element">
              <p className="text-[16px] font-bold text-v3-navy">ธาตุของคุณ</p>
              <div className="flex items-center gap-3 rounded-[16px] bg-[#F6ECF0] p-3">
                <div className="min-w-0 flex-1">
                  <span className="inline-block rounded-full bg-[#FFF8F0] px-2.5 py-1 text-[12px] font-bold text-[#E5A93B]">{mascot.elementLabelTh} ({mascot.elementLabelEn})</span>
                  {element?.tagline ? <p className="mt-2 line-clamp-3 text-[12px] leading-[18px] text-[#717171]">{element.tagline}</p> : null}
                </div>
                <span aria-hidden className="relative h-[110px] w-[80px] flex-none overflow-hidden rounded-[12px]">
                  <Image src={mascot.character} alt="" fill sizes="80px" style={{ objectFit: "contain" }} />
                </span>
              </div>
              <Link href="/v2/destiny" className="flex items-center gap-1 pt-1 text-[13px] font-medium text-v3-sapphire">
                <span className="flex-1">ดูคำทำนายธาตุและแก้ไขข้อมูลเกิด</span>
                <span>›</span>
              </Link>
            </section>
          ) : profile && !profile.birthDate ? (
            <Link href="/v2/settings/edit-birth" data-testid="account-element-empty" className="v3-shadow-card flex items-center gap-3 rounded-[20px] bg-white p-4">
              <IconTile tone="purple">🔮</IconTile>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-v3-navy">กรอกวันเกิดเพื่อดูธาตุประจำตัว</p>
                <p className="text-[11px] leading-4 text-v3-text-muted">รู้ธาตุ มาสคอต และคำทำนายเฉพาะคุณ</p>
              </div>
              {CHEVRON}
            </Link>
          ) : null}

          {/* การ์ด QI (ฟ้า) — ยอดคงเหลือ + orb 氣 + ปุ่ม (เฟรม balance-hero-card) */}
          {wallet ? (
            <section className="rounded-[20px] bg-v3-sapphire p-5 text-white" data-testid="account-qi-wallet">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] text-white/90">ยอดคงเหลือ</p>
                    <Link href="/v2/qi" aria-label="คู่มือพลังชี่" className="grid size-[18px] flex-none place-items-center rounded-[9px] bg-white/90 text-[11px] font-black leading-none text-v3-navy">?</Link>
                  </div>
                  <p className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-[30px] font-black leading-none text-v3-lime" data-testid="account-qi-balance">{balance.toLocaleString("th-TH")}</span>
                    <span className="text-[16px] font-black text-v3-lime">QI</span>
                  </p>
                </div>
                <span aria-hidden className="grid size-16 flex-none place-items-center rounded-full bg-[rgba(216,143,169,0.22)]">
                  <span className="size-12 overflow-hidden rounded-full border-2 border-v3-sapphire">
                    <Image src="/images/v2/qi/qi-orb.png" alt="" width={48} height={48} className="size-full object-cover" />
                  </span>
                </span>
              </div>
              <p className="mt-3 text-[13px] leading-[18px] text-white/90">พอถามเซียนมู AI ได้อีก {asks} ครั้ง หรือเปิดไพ่ได้ {cards} ครั้ง</p>
              <div className="mt-3 flex gap-2">
                <Link href="/v2/qi/buy" data-testid="qi-topup-link" className="grid h-11 flex-1 place-items-center rounded-full bg-v3-lime text-[14px] font-black uppercase text-v3-navy">ซื้อ QI เพิ่ม</Link>
                <Link href="/v2/qi/history" data-testid="account-qi-history" className="grid h-11 flex-1 place-items-center rounded-full border border-white/60 text-[14px] font-bold uppercase text-white">ประวัติการใช้</Link>
              </div>
            </section>
          ) : null}

          {/* เช็คอินต่อเนื่อง — ช่องสี่เหลี่ยม + footer โบนัส (เฟรม daily-checkin-card) */}
          <SectionCard testId="account-checkin" className="!rounded-[20px] gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[16px] font-bold text-v3-navy">เช็คอินต่อเนื่อง</p>
              <p className="text-[13px] text-v3-text-body">{streak === 0 ? 0 : ((streak - 1) % 7) + 1} / 7 วัน</p>
            </div>
            <div className="flex items-stretch gap-1.5">
              {days.map((d) => {
                const isDone = claimedSet.has(d) || (done && d === today)
                const isToday = d === today
                const bg = isDone ? "bg-[#ECF0FD] text-v3-sapphire" : isToday ? "bg-v3-cyan text-white" : "bg-[#F0F8F0] text-v3-cyan"
                return (
                  <span key={d} className={`grid flex-1 place-items-center rounded-[11px] py-3 text-[13px] font-bold ${bg}`}>
                    {isDone ? CHECK_SM : Number(d.slice(8, 10))}
                  </span>
                )
              })}
            </div>
            <KitButton onClick={() => void checkin()} disabled={done || busyCheckin} testId="account-checkin-btn">
              {done ? "เช็คอินแล้ว · กลับมาพรุ่งนี้" : busyCheckin ? "กำลังบันทึก..." : "เช็คอินวันนี้ รับ +5 QI"}
            </KitButton>
            <p className="text-center text-[11px] text-v3-text-muted">ครบ 7 วันรับโบนัส +30 QI</p>
          </SectionCard>

          {/* ภารกิจ — ไอคอนจริงต่อภารกิจ + จัดกลาง (เฟรม quick-earn-section) */}
          {daily.length > 0 && (
            <div data-testid="account-missions">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[16px] font-black text-v3-navy">ทำภารกิจรับพลังชี่เพิ่ม</p>
                <Link href="/v2/qi/missions" data-testid="account-missions-link" className="text-[13px] font-bold text-v3-sapphire">ดูทั้งหมด ›</Link>
              </div>
              <div className="flex gap-2">
                {daily.map((mn) => {
                  const ic = iconFor(mn.id)
                  return (
                    <Link key={mn.id} href={mn.actionHref ?? "/v2/qi/missions"} className="v3-shadow-line flex flex-1 flex-col items-center gap-2.5 rounded-[16px] bg-white p-3 text-center">
                      <span aria-hidden className="grid size-9 flex-none place-items-center rounded-[12px] bg-[#E3F8D1] text-[#3F8F52]">
                        {mn.completed ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        ) : ic.icon}
                      </span>
                      <p className="text-[14px] font-bold leading-5 text-v3-navy">{mn.title}</p>
                      <p className="text-[14px] font-bold text-[#63B05F]">+{mn.rewardCoins} QI</p>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* การ์ดรวม: เพื่อน + แผน (เฟรม nav-list-card) */}
          <section className="v3-shadow-card flex w-full flex-col overflow-hidden rounded-[20px] bg-white">
            {/* แถวเพื่อน / 5 ธาตุ */}
            <Link href="/v2/qi/referral" data-testid="account-friends" className="flex items-center gap-3 px-4 py-3.5">
              <span aria-hidden className="flex flex-none items-center">
                {["#63B05F", "#E5A93B", "#D75A3A"].map((c, i) => (
                  <span key={c} className="grid size-[30px] place-items-center rounded-full border-2 border-white text-[11px] font-black text-white" style={{ backgroundColor: c, marginLeft: i === 0 ? 0 : -10 }}>ธ</span>
                ))}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-v3-navy">เพื่อนของคุณ {friends} คน</p>
                <p className="text-[12px] leading-[18px] text-v3-text-body">เก็บครบ 5 ธาตุรับ 1,000 QI{missingElements.length ? ` · ยังขาด${missingElements.join(" ")}` : ""}</p>
              </div>
              {goals ? <span className="flex-none rounded-full bg-[#EAF3FF] px-2.5 py-1 text-[11px] font-black text-v3-sapphire">{goals.element.collected}/5</span> : null}
              <span className="flex-none text-[16px] font-bold text-v3-text-muted">›</span>
            </Link>
            {/* แถวแผน / upsell */}
            {isPaid ? (
              <Link href="/v2/account/plan" data-testid="account-plan" className="flex items-center gap-3 border-t border-v3-border-card px-4 py-3.5">
                <IconTile tone="orange" className="!size-[38px] !rounded-[12px]">👑</IconTile>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-v3-navy" data-testid="account-plan-name">{plan?.heading ?? "แผนของคุณ"}</p>
                  <p className="text-[12px] leading-[18px] text-v3-text-body" data-testid="account-plan-sub">{plan?.sub ?? "กำลังโหลด…"}</p>
                </div>
                <span data-testid="account-plan-link" className="flex-none text-[13px] font-bold text-v3-cyan">จัดการ ›</span>
              </Link>
            ) : (
              <div data-testid="account-plan" className="flex items-center gap-3 border-t border-v3-border-card bg-[#F7F0FC] px-4 py-3.5 text-[#6F1BAF]">
                <span aria-hidden className="grid size-[38px] flex-none place-items-center rounded-[12px] bg-[#EADCF7] text-[18px]">👑</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium" data-testid="account-plan-name">{plan?.heading ?? "แผนของคุณ"}</p>
                  <p className="text-[12px] leading-[18px] opacity-85" data-testid="account-plan-sub">{plan?.sub ?? "กำลังโหลด…"}</p>
                </div>
                <Link href={SHOP_HREF} data-testid="account-shop-cta" className="grid h-9 flex-none place-items-center rounded-full bg-[#6F1BAF] px-4 text-[12px] font-bold text-white">อัปเกรด</Link>
              </div>
            )}
          </section>

          {/* ความเคลื่อนไหวล่าสุด — มีวันที่กำกับ (เฟรม recent-activity-card) */}
          {history.length > 0 && (
            <div data-testid="account-activity">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[16px] font-black text-v3-navy">ความเคลื่อนไหวล่าสุด</p>
                <Link href="/v2/qi/history" data-testid="account-activity-link" className="text-[13px] font-bold text-v3-sapphire">ดูทั้งหมด ›</Link>
              </div>
              <SectionCard className="!rounded-[20px] !p-0">
                <ul className="flex flex-col divide-y divide-v3-border-card">
                  {history.slice(0, 3).map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] leading-[22px] text-v3-navy">{reasonLabel(h.reason)}</p>
                        <p className="text-[12px] leading-[18px] text-v3-text-muted">{bkkCivilDate(h.createdAt)}</p>
                      </div>
                      <span className={"flex-none text-[14px] font-bold " + (h.qiDelta > 0 ? "text-[#63B05F]" : "text-[#E08586]")}>{h.qiDelta > 0 ? "+" : ""}{h.qiDelta} QI</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            </div>
          )}
        </div>
      </div>
      <Menubar />
    </div>
  )
}

export default AccountScreen
