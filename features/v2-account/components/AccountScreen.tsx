// features/v2-account/components/AccountScreen.tsx — จอ "โปรไฟล์" (/v2/account) = แดชบอร์ดรวม
// เฟรม `profile-and-qi-wallet — UX v2` (55399:4904). โครงตาม Figma เป๊ะ:
// หัวจอ(ย้อน+avatar+ชื่อ+ธาตุ·tier+ตั้งค่า›) · การ์ดธาตุ(ขาว+badge ในสุด+มาสคอต) · การ์ด QI(orb 氣+?) ·
// เช็คอิน(ช่องสี่เหลี่ยม+footer โบนัส) · ภารกิจ(ไอคอนจริง) · การ์ดรวม เพื่อน+แผน · ความเคลื่อนไหว(มีวันที่).
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useCookies } from "react-cookie"

import { Menubar } from "@/features/v2-shell/components/Menubar"
import { Spinner } from "@/features/v2-shell/components/Spinner"
import { useV2User } from "@/features/auth/hooks/useV2User"
import { CookieKey } from "@/constants/cookie-key"
import { SHOP_HREF } from "@/features/v2-shop/upgrade-cta"
import { BackButton, IconTile, KitButton, SectionCard, SkyBackdrop } from "@/features/v2-profile/components/kit"
import { iconFor } from "@/features/v2-qi/components/MissionsScreen"
import { resolveMascot, toNakkasat } from "@/lib/personalization"
import { bangkokDay, checkedInToday, checkinStreak, reasonLabel, todayBangkok, type MissionBoard, type Wallet } from "@/features/v2-qi/qi-model"
import { qiBonusOf, qiQtyOf } from "@/lib/payment/catalog"
import { bkkCivilDate } from "../payment-history"
import { planFor, type Plan } from "../plan"

type Profile = { firstName?: string | null; displayName?: string | null; birthDate?: string | null; birthTime?: string | null; hasAvatar?: boolean | null; avatarUpdatedAt?: string | null }
// สรุปสิทธิ์จาก /api/qi-entitlements — ใช้คิด "ยังถาม/เปิดไพ่ได้อีกกี่ครั้ง" ให้ตรง (ฟรี + credit + QI)
type Entitlements = {
  tier?: "free" | "plus" | "pro"
  credits?: { card_use?: number; chat_question?: number }
  quota?: { card?: { used: number; limit: number }; chat?: { used: number; limit: number } }
}
type ElementSummary = { elementTh?: string | null; tagline?: string | null; traits?: string[] } | null
type Referral = { invitedCount?: number }

const CHAT_COST = 30
// ราคา Mumate Pro รายเดือนที่ใช้เทียบในแถว "ประหยัด ฿" (เฟรม row-mumate-pro) — ตัวเลขเดียวกับ QiScreen/QiBuyScreen
const PRO_MONTHLY_THB = 199
const thb = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`
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

// preview: เฉพาะหน้า dev (/dev-access/account-preview) — ป้อน wallet/board/ent ตรง ๆ ไม่ยิง API
type AccountPreview = { wallet?: Wallet | null; board?: MissionBoard | null; ent?: Entitlements | null }
export function AccountScreen({ preview }: { preview?: AccountPreview } = {}) {
  const { user } = useV2User()
  // ตัวตน LINE (ชื่อ+รูปจริง) จาก cookie ที่ตั้งตอน login — เหมือนที่หน้าหลักใช้ ให้ /account ตรงกัน
  const [cookies] = useCookies([CookieKey.MEMBER_NAME, CookieKey.MEMBER_IMAGE])
  const lineName = typeof cookies[CookieKey.MEMBER_NAME] === "string" ? cookies[CookieKey.MEMBER_NAME] : null
  const linePhoto = typeof cookies[CookieKey.MEMBER_IMAGE] === "string" ? cookies[CookieKey.MEMBER_IMAGE] : null
  const [wallet, setWallet] = useState<Wallet | null>(preview?.wallet ?? null)
  const [ent, setEnt] = useState<Entitlements | null>(preview?.ent ?? null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [element, setElement] = useState<ElementSummary>(null)
  const [board, setBoard] = useState<MissionBoard | null>(preview?.board ?? null)
  const [referral, setReferral] = useState<Referral | null>(null)
  const [deletePending, setDeletePending] = useState<string | null>(null)
  const [busyCheckin, setBusyCheckin] = useState(false)
  const [loaded, setLoaded] = useState(!!preview) // wallet/profile โหลดเสร็จ — กันปุ่มเช็คอิน flash ก่อนรู้สถานะจริง
  const [attempt, setAttempt] = useState(0)
  // ฿ ต่อ 1 QI จากแพ็กเริ่มต้น (QI_60) — แหล่งเดียวกับจอซื้อ QI; null = ยังไม่รู้ราคา → ไม่แต่งตัวเลขเอง
  const [qiRate, setQiRate] = useState<number | null>(null)
  // ธาตุ (bazi compute หนัก) โหลดหลังจอวาด — flag ให้โชว์ skeleton ระหว่างรอ (ไม่งั้นการ์ดโผล่มาเฉย ๆ ดูเหมือนบั๊ก)
  const [elementLoading, setElementLoading] = useState(false)

  const load = useCallback(async () => {
    const getJson = (url: string) => fetch(url).then((x) => (x.ok ? x.json() : null)).catch(() => null)
    // ครึ่งที่จำเป็นต่อการวาดจอ (ยอด/โปรไฟล์/สิทธิ์) — วาดทันทีที่ 3 ตัวนี้มา ไม่รอที่เหลือ
    // history=10 พอ (จอโชว์ 3 แถวล่าสุด) — เดิม 100 ทำ payload/คิวรีบวมโดยเปล่าประโยชน์
    const [w, p, e] = await Promise.all([
      getJson("/api/qi-wallet?history=10"),
      getJson("/api/profile"),
      getJson("/api/qi-entitlements"),
    ])
    setWallet(w)
    setEnt(e)
    const prof: Profile | null = p?.profile ?? null
    setProfile(prof)
    setLoaded(true)
    // ธาตุของคุณ (bazi compute หนัก ~timeout 12s) — ยิงหลังได้ profile ไม่บล็อกจอ; โชว์ skeleton ระหว่างรอ
    if (prof?.birthDate) {
      setElementLoading(true)
      fetch("/api/bazi/element-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: { birthDate: prof.birthDate, birthTime: prof.birthTime ?? undefined } }),
      })
        .then((x) => (x.ok ? x.json() : null))
        .then((j) => setElement(j?.summary ?? null))
        .catch(() => setElement(null))
        .finally(() => setElementLoading(false))
    } else {
      setElement(null)
    }
    // ครึ่งที่ไม่บล็อกการวาดจอ (ภารกิจ/ชวนเพื่อน/สถานะลบบัญชี/เรตราคา) — เติมทีหลัง section null-guard เอง
    void Promise.all([
      getJson("/api/missions"),
      getJson("/api/referral"),
      getJson("/api/v2/account/delete"),
      getJson("/api/payment-package?code=QI_60"),
    ]).then(([m, r, del, pack]) => {
      setBoard(m)
      setReferral(r)
      setDeletePending(del?.deletion?.purgeAt ?? null)
      const a = pack?.amount
      const amount = typeof a === "number" ? a : typeof a === "string" ? Number(a) : NaN
      const total = (qiQtyOf("QI_60") ?? 0) + qiBonusOf("QI_60")
      setQiRate(Number.isFinite(amount) && amount > 0 && total > 0 ? amount / total : null)
    })
  }, [])

  useEffect(() => { if (preview) return; void load() }, [load, attempt, preview])

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
  // ยังทำได้อีกกี่ครั้ง = โควตาฟรีที่เหลือวันนี้ + credit ที่ซื้อไว้ + (QI ÷ ราคา).
  // สมาชิกจ่ายเงิน (plus/pro) แชทไม่จำกัด → โชว์ "ไม่จำกัด".
  const freeLeft = (f: "card" | "chat") => Math.max(0, (ent?.quota?.[f]?.limit ?? 0) - (ent?.quota?.[f]?.used ?? 0))
  const chatUnlimited = ent?.tier === "plus" || ent?.tier === "pro"
  const asksNum = freeLeft("chat") + (ent?.credits?.chat_question ?? 0) + Math.floor(balance / CHAT_COST)
  const cards = freeLeft("card") + (ent?.credits?.card_use ?? 0) + Math.floor(balance / 10) // เปิดไพ่ = 10 QI (card_use)
  const asks = chatUnlimited ? "ไม่จำกัด" : asksNum

  const mascot = useMemo(() => {
    if (!profile?.birthDate) return null
    const el = element?.elementTh
    if (!el) return null
    return resolveMascot(nakkasatFromBirth(profile.birthDate), el)
  }, [profile, element])

  const daily = (board?.missions ?? []).filter((m) => m.category === "daily").slice(0, 2)
  // mission:<id> → ชื่อภารกิจจริง (ไม่งั้นฟีดโชว์ "ภารกิจ first_reading" ดิบ ๆ — บั๊กที่เห็นบน prod 2026-09-07)
  const missionTitles = useMemo(() => new Map((board?.missions ?? []).map((m) => [m.id, m.title])), [board])
  const goals = board?.goals
  const friends = referral?.invitedCount ?? goals?.referral.invited ?? 0
  const days = last7(today)
  const claimedSet = new Set(history.filter((h) => h.reason === "qi:earn:daily_login").map((h) => h.createdAt.slice(0, 10)))
  // แถว Pro (เฟรม row-mumate-pro): "เดือนนี้จ่ายค่า QI ไป ฿X · Pro ฿199 ใช้ไม่จำกัด ประหยัด ฿Y" — คิดจาก ledger
  // qi:spend:* ของเดือนนี้ (เวลาไทย) × ราคาต่อ QI ของแพ็กเริ่มต้น; ไม่มีรายจ่าย/ไม่รู้ราคา → ไม่โชว์ตัวเลขที่ไม่มีที่มา
  const spentQiThisMonth = history.reduce((sum, h) => ((h.reason ?? "").startsWith("qi:spend:") && bangkokDay(h.createdAt).slice(0, 7) === today.slice(0, 7) ? sum - h.qiDelta : sum), 0)
  const spentThb = qiRate !== null && spentQiThisMonth > 0 ? spentQiThisMonth * qiRate : null
  const proSaving = spentThb !== null && spentThb > PRO_MONTHLY_THB ? spentThb - PRO_MONTHLY_THB : null
  const missingElements = goals ? goals.element.elements.filter((e) => !e.collected).map((e) => ELEMENT_TH[e.key] ?? e.key) : []

  // ชื่อ: ชื่อจริงที่ตั้งเอง (engine) → @name (displayName) → ชื่อ LINE → generic
  // Slide 7 — เพิ่ม displayName: ผู้ใช้ที่ตั้ง @name แต่ไม่ได้กรอกชื่อจริง จะได้เห็นชื่อที่ตั้ง ไม่ค้างชื่อ LINE เดิม
  const name = profile?.firstName || profile?.displayName || lineName || "ผู้ใช้ MuMate"
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
          <span aria-hidden className="relative grid size-11 flex-none place-items-center overflow-hidden rounded-full bg-v3-sapphire text-[18px] font-black text-white shadow-[0_2px_8px_rgba(26,38,77,.15)]">
            {profile?.hasAvatar ? (
              // รูปที่ผู้ใช้อัปโหลดเอง (engine) มาก่อน
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/v2/avatar?t=${encodeURIComponent(profile.avatarUpdatedAt ?? "")}`} alt="" className="absolute inset-0 size-full object-cover" />
            ) : linePhoto ? (
              // ไม่มีรูปอัปโหลด → ใช้รูป LINE (เหมือนหน้าหลัก)
              // eslint-disable-next-line @next/next/no-img-element
              <img src={linePhoto} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />
            ) : (
              name.slice(0, 1)
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[24px] font-bold leading-8 text-v3-navy" data-testid="account-greeting">{name}</p>
            <p className="text-[13px] leading-[18px] text-v3-text-body">
              {mascot ? `${mascot.elementLabelTh} · ` : ""}{TIER_LABEL[tierKey] ?? tierKey}
            </p>
          </div>
          <Link href="/v2/settings" data-testid="account-settings-link" className="flex flex-none items-center gap-1 rounded-full border border-v3-border-card bg-white px-3 py-1.5 text-[13px] font-medium text-v3-text-body">
            ตั้งค่า <span className="text-v3-text-muted">›</span>
          </Link>
        </header>

        {deletePending && (
          <Link href="/v2/settings/delete-account" data-testid="account-delete-pending" className="v3-shadow-card mt-4 flex w-full flex-col rounded-[24px] border-2 border-v3-pumpkin bg-white p-4">
            <p className="text-[14px] font-bold text-v3-pumpkin">บัญชีอยู่ระหว่างพักลบ — ยกเลิกได้</p>
            <p className="text-[12px] leading-4 text-v3-text-body">กดเพื่อดูสถานะหรือยกเลิกการลบ</p>
          </Link>
        )}

        <div className="mt-3 flex flex-col gap-3">
          {/* การ์ดธาตุของคุณ — ขาว + badge ในสุด + มาสคอต (เฟรม user-profile-card) */}
          {mascot ? (
            <section className="v3-shadow-card flex flex-col gap-3 rounded-[20px] bg-white p-4" data-testid="account-element">
              <p className="text-[16px] font-bold text-v3-navy">ธาตุของคุณ</p>
              <div className="flex items-center gap-3 rounded-[16px] bg-v3-rose-tint p-3">
                <div className="min-w-0 flex-1">
                  <span className="inline-block rounded-full bg-[#FFF8F0] px-2.5 py-1 text-[12px] font-bold text-[#E5A93B]">{mascot.elementLabelTh} ({mascot.elementLabelEn})</span>
                  {element?.tagline ? <p className="mt-2 line-clamp-3 text-[12px] leading-[18px] text-v3-dropdown-label">{element.tagline}</p> : null}
                </div>
                {/* ใช้ card asset เดิม (ฉาก illustrated ต่อธาตุ) — ไฟล์ที่ฉากผิดธาตุ (เช่น 09_วอก-ไม้) ให้ทีมออกแบบแก้ทีหลัง */}
                <span aria-hidden className="relative h-[110px] w-[80px] flex-none overflow-hidden rounded-[12px] motion-safe:animate-mascot-float">
                  <Image src={mascot.card} alt="" fill sizes="80px" style={{ objectFit: "cover" }} />
                </span>
              </div>
              <Link href="/v2/destiny" className="flex items-center gap-1 pb-1 pt-3 text-[13px] leading-[18px] text-v3-sapphire">
                <span className="flex-1">ดูคำทำนายธาตุและแก้ไขข้อมูลเกิด</span>
                <span>›</span>
              </Link>
            </section>
          ) : profile && !profile.birthDate ? (
            <Link href="/v2/settings/edit-birth" data-testid="account-element-empty" className="v3-shadow-card flex items-center gap-3 rounded-[24px] bg-white p-4">
              <IconTile tone="purple">🔮</IconTile>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-v3-navy">กรอกวันเกิดเพื่อดูธาตุประจำตัว</p>
                <p className="text-[11px] leading-4 text-v3-text-muted">รู้ธาตุ มาสคอต และคำทำนายเฉพาะคุณ</p>
              </div>
              {CHEVRON}
            </Link>
          ) : (!loaded || elementLoading) ? (
            /* สปินเนอร์หมุน การ์ดธาตุ ระหว่าง bazi compute (ช้าได้) — บอกชัดว่ากำลังโหลด ไม่ใช่การ์ดหาย */
            <section className="v3-shadow-card grid h-[150px] place-items-center gap-2 rounded-[20px] bg-white" data-testid="account-element-skeleton" aria-busy="true">
              <Spinner className="size-7 text-v3-sapphire" />
              <span className="text-[12px] text-v3-text-muted">กำลังคำนวณธาตุ…</span>
            </section>
          ) : null}

          {/* การ์ด QI (ฟ้า) — ยอดคงเหลือ + orb 氣 + ปุ่ม (เฟรม balance-hero-card) */}
          {wallet ? (
            <section className="rounded-[20px] bg-v3-sapphire p-5 text-white" data-testid="account-qi-wallet">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] text-white/90">ยอดคงเหลือ</p>
                    <Link href="/v2/qi" aria-label="คู่มือพลังชี่" data-testid="account-qi-guide" className="grid size-4 flex-none place-items-center rounded-full bg-v3-rose-tint text-[10px] font-bold leading-none text-v3-text-body">
                      <span className="translate-y-[0.5px]">?</span>
                    </Link>
                  </div>
                  <p className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-[30px] font-black leading-none text-v3-lime" data-testid="account-qi-balance">{balance.toLocaleString("th-TH")}</span>
                    <span className="text-[16px] font-black text-v3-lime">QI</span>
                  </p>
                </div>
                {/* เหรียญ QI จริง (qi-coin) ในวง glow-aura — ขยายเหรียญให้เด่นขึ้น (ผู้ใช้ 2026-09-12) */}
                <span aria-hidden className="grid size-[72px] flex-none place-items-center rounded-full bg-[rgba(216,143,169,0.2)]">
                  <Image src="/images/v2/qi/qi-coin.png" alt="" width={64} height={64} sizes="64px" unoptimized className="size-16 object-contain" />
                </span>
              </div>
              <p className="mt-3 text-[13px] leading-[18px] text-white/90">{chatUnlimited ? <>ถามเซียนมู่ AI ได้ไม่จำกัด · เปิดไพ่ได้อีก {cards} ครั้ง</> : <>พอถามเซียนมู่ AI ได้อีก {asks} ครั้ง หรือเปิดไพ่ได้ {cards} ครั้ง</>}</p>
              <div className="mt-3 flex gap-2">
                <Link href="/v2/qi/buy" data-testid="qi-topup-link" className="grid h-11 flex-1 place-items-center rounded-full bg-v3-lime text-[14px] font-semibold uppercase text-v3-sapphire">ซื้อ QI เพิ่ม</Link>
                <Link href="/v2/qi/history" data-testid="account-qi-history" className="grid h-11 flex-1 place-items-center rounded-full border border-v3-placeholder text-[14px] font-semibold uppercase text-white">ประวัติการใช้</Link>
              </div>
            </section>
          ) : !loaded ? (
            /* สปินเนอร์หมุน การ์ด QI ระหว่างโหลด — บอกชัดว่ากำลังโหลด (ผู้ใช้ 2026-09-12: ชอบแบบหมุน ๆ) */
            <section className="grid h-[168px] place-items-center rounded-[20px] bg-v3-sapphire" data-testid="account-qi-skeleton" aria-busy="true">
              <Spinner className="size-7 text-white" />
            </section>
          ) : null}

          {/* เช็คอินต่อเนื่อง — ช่องสี่เหลี่ยม + footer โบนัส (เฟรม daily-checkin-card) */}
          <SectionCard testId="account-checkin" className="!rounded-[20px] gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[16px] font-bold text-v3-navy">เช็คอินต่อเนื่อง</p>
              <p className="text-[13px] text-v3-text-body">{streak === 0 ? "เริ่มสัปดาห์แรก" : `${((streak - 1) % 7) + 1} / 7 วัน`}</p>
            </div>
            <div className="flex items-stretch gap-1.5">
              {days.map((d) => {
                const isDone = claimedSet.has(d) || (done && d === today)
                const isToday = d === today
                const bg = isDone ? "bg-v3-ghost-white text-v3-sapphire" : isToday ? "bg-v3-cyan text-white" : "bg-v3-grade-b-bg text-v3-cyan"
                return (
                  <span key={d} className={`grid flex-1 place-items-center rounded-[11px] py-3 text-[13px] font-bold ${bg}`}>
                    {isDone ? CHECK_SM : Number(d.slice(8, 10))}
                  </span>
                )
              })}
            </div>
            <KitButton onClick={() => void checkin()} disabled={!loaded || done || busyCheckin} testId="account-checkin-btn">
              {!loaded ? "กำลังโหลด..." : done ? "เช็คอินแล้ว · กลับมาพรุ่งนี้" : busyCheckin ? "กำลังบันทึก..." : "เช็คอินวันนี้ รับ +5 QI"}
            </KitButton>
            <p className="text-center text-[11px] text-v3-text-muted">ครบ 7 วันรับโบนัส +30 QI</p>
          </SectionCard>

          {/* ภารกิจ — ไอคอนจริงต่อภารกิจ + จัดกลาง (เฟรม quick-earn-section) */}
          {daily.length > 0 && (
            <div data-testid="account-missions">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[16px] font-bold leading-6 text-v3-navy">ทำภารกิจรับพลังชี่เพิ่ม</p>
                <Link href="/v2/qi/missions" data-testid="account-missions-link" className="text-[13px] leading-[18px] text-v3-sapphire">ดูทั้งหมด ›</Link>
              </div>
              <div className="flex gap-2">
                {daily.map((mn) => {
                  const ic = iconFor(mn.id)
                  return (
                    <Link key={mn.id} href={mn.actionHref ?? "/v2/qi/missions"} className="v3-shadow-line flex flex-1 flex-col items-center gap-2.5 rounded-[16px] bg-white p-3 text-center">
                      <span aria-hidden className="grid size-9 flex-none place-items-center rounded-[12px] bg-v3-qi-earn-bg text-v3-qi-earn-icon">
                        {mn.completed ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        ) : ic.icon}
                      </span>
                      <p className="text-[16px] font-bold leading-6 text-v3-navy">{mn.title}</p>
                      <p className="text-[14px] font-bold leading-5 text-v3-qi-earn">+{mn.rewardCoins} QI</p>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* การ์ดรวม: เพื่อน + แผน (เฟรม nav-list-card) */}
          <section className="v3-shadow-card flex w-full flex-col overflow-hidden rounded-[24px] bg-white">
            {/* แถวเพื่อน / 5 ธาตุ (เฟรม row 55399:5007): avatar stack 34px ขอบขาว 2 ซ้อน -12 + วง "+N" + badge 3/5 */}
            <Link href="/v2/qi/referral" data-testid="account-friends" className="flex items-center gap-3 px-4 py-3.5">
              {friends > 0 ? (
                // ยังไม่มีรูป/ชื่อเพื่อนจาก /api/referral (ให้แค่ invitedCount) → วงสีธาตุ+ตัวย่อ "ธ" แทนรูปจริง ไม่ปั้นรูปปลอม
                <span aria-hidden data-testid="account-friends-stack" className="flex flex-none items-center">
                  {["#63B05F", "#E5A93B", "#D75A3A"].slice(0, Math.min(friends, 3)).map((c, i) => (
                    <span key={c} className="grid size-[34px] place-items-center rounded-full border-2 border-white text-[12px] font-black text-white" style={{ backgroundColor: c, marginLeft: i === 0 ? 0 : -12 }}>ธ</span>
                  ))}
                  {friends > 3 ? (
                    <span className="grid size-[34px] place-items-center rounded-full border-2 border-white text-[13px] font-bold text-v3-lime" style={{ marginLeft: -12, backgroundColor: "rgba(11,48,91,0.6)" }}>+{friends - 3}</span>
                  ) : null}
                </span>
              ) : (
                <span aria-hidden className="grid size-[38px] flex-none place-items-center rounded-full bg-v3-sky-tint text-v3-sapphire">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg>
                </span>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                {friends > 0 ? (
                  <>
                    <p className="text-[14px] font-medium leading-5 text-v3-navy">เพื่อนของคุณ {friends} คน</p>
                    <p className="text-[12px] leading-[18px] text-v3-text-body">เก็บครบ 5 ธาตุรับ 1,000 QI{missingElements.length ? ` · ยังขาด${missingElements.join("และ")}` : ""}</p>
                  </>
                ) : (
                  <>
                    <p className="text-[14px] font-medium leading-5 text-v3-navy">สะสมเพื่อนให้ครบ 5 ธาตุ</p>
                    <p className="text-[12px] leading-[18px] text-v3-text-body">ชวนเพื่อนคนแรก รับ 50 QI</p>
                  </>
                )}
              </div>
              {goals && friends > 0 ? <span data-testid="account-friends-badge" className="flex-none rounded-full bg-v3-sky-tint px-2.5 py-[5px] text-[9px] font-bold leading-none text-v3-sapphire">{goals.element.collected}/5</span> : null}
              <span className="flex-none text-[16px] font-bold leading-6 text-v3-text-note">›</span>
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
              <Link href={SHOP_HREF} data-testid="account-plan" className="flex items-center gap-3 border-t border-v3-border-card bg-[#F7F0FC] px-4 py-3.5 text-v3-purple">
                <span aria-hidden className="grid size-[38px] flex-none place-items-center rounded-[12px] bg-[#EADCF7] text-[18px]">👑</span>
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  {/* เฟรม: "เดือนนี้จ่ายค่า QI ไป ฿318 / Pro ฿199 ใช้ไม่จำกัด ประหยัด ฿119" — ตัวเลขจาก ledger จริง ไม่มี → ชื่อแผน */}
                  <p className="text-[14px] font-medium leading-5" data-testid="account-plan-name">{spentThb !== null ? `เดือนนี้จ่ายค่า QI ไป ${thb(spentThb)}` : plan?.heading ?? "แผนของคุณ"}</p>
                  <p className="text-[12px] leading-[18px] opacity-85" data-testid="account-plan-sub">{`Mumate Pro ${thb(PRO_MONTHLY_THB)}/เดือน หรือ Mumate+ ฿790/ปี ใช้ไม่จำกัด`}{proSaving !== null ? ` ประหยัด ${thb(proSaving)}` : ""}</p>
                </div>
                <span data-testid="account-shop-cta" className="flex-none rounded-full bg-v3-purple px-[9px] py-1 text-[9px] font-bold leading-none text-white">แนะนำ</span>
                <span className="flex-none text-[16px] font-bold leading-6">›</span>
              </Link>
            )}
          </section>

          {/* ความเคลื่อนไหวล่าสุด — มีวันที่กำกับ (เฟรม recent-activity-card) + empty state วันแรก */}
          {wallet && (
            <div data-testid="account-activity">
              <SectionCard className="!rounded-[20px] !p-0">
              <div className="flex items-center justify-between px-4 pb-2 pt-4">
                <p className="text-[16px] font-bold leading-6 text-v3-navy">ความเคลื่อนไหวล่าสุด</p>
                {history.length > 0 && (
                  <Link href="/v2/qi/history" data-testid="account-activity-link" className="text-[13px] leading-[18px] text-v3-sapphire">ดูทั้งหมด ›</Link>
                )}
              </div>
                {history.length > 0 ? (
                  <ul className="flex flex-col divide-y divide-v3-border-card pb-2">
                    {history.slice(0, 3).map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] leading-[22px] text-v3-navy">{reasonLabel(h.reason, missionTitles)}</p>
                          <p className="text-[12px] leading-[18px] text-v3-text-muted">{bkkCivilDate(h.createdAt)}</p>
                        </div>
                        <span className={"flex-none text-[14px] font-semibold leading-5 " + (h.qiDelta > 0 ? "text-v3-qi-earn" : "text-v3-qi-spend")}>{h.qiDelta > 0 ? "+" : ""}{h.qiDelta} QI</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div data-testid="account-activity-empty" className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
                    <span aria-hidden className="mb-1 grid size-11 place-items-center rounded-full bg-v3-ghost-white text-v3-sapphire">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 2" /><circle cx="12" cy="12" r="9" /></svg>
                    </span>
                    <p className="text-[14px] font-bold text-v3-navy">ยังไม่มีความเคลื่อนไหว</p>
                    <p className="text-[12px] leading-[18px] text-v3-text-muted">ทุกครั้งที่ได้รับหรือใช้ QI รายการจะขึ้นที่นี่</p>
                  </div>
                )}
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
