// features/v2-qi/components/QiScreen.tsx — จอ "คู่มือพลังชี่" (/v2/qi).
//
// Design: Figma frame `qi-token-guide-v2-brand-ci` (55271:8613) — hero orb (氣) + เหรียญลอย + หัวข้อแบรนด์,
// การ์ด "Qi Token คืออะไร?", วิธีสะสมพลังชี่ (earn list ไอคอนจริง), วิธีใช้ชี่ไขดวงชะตา (spend list ไอคอนจริง
// + ป้าย QI น้ำเงิน), วงจรความมั่งคั่ง (Growth Loop), ปุ่มท้าย. คงส่วน interactive เดิมไว้ครบ (ยอด/เช็คอิน/
// แลกสิทธิ์จริง + ชีต) — ดีไซน์คู่มือแต่ปุ่มทำงานจริง. Identity = cookie-mumate-id (BFF → anonId).
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

import { SpendConfirmSheet, InsufficientQiSheet } from "./QiSpendSheets"
import { AmountPill, SectionCard, SkyHeader, SkyScreen } from "@/features/v2-profile/components/kit"
import { resolveMascot, toNakkasat } from "@/lib/personalization"
import {
  checkedInToday,
  reasonLabel,
  todayBangkok,
  type Entitlements,
  type QiCatalog,
  type QiSpendLine,
  type Referral,
  type Wallet,
} from "../qi-model"

const TIER_LABEL: Record<string, string> = { free: "ฟรี", plus: "PLUS", pro: "PRO" }

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
  { key: "free", title: "ฟรี", price: "0 บาท", desc: "สะสม QI จากกิจกรรม", highlight: false },
  { key: "once", title: "ซื้อเป็นครั้ง", price: "เริ่ม ฿35", desc: "เติม QI ตามต้องการ", highlight: false },
  { key: "pro", title: "Mumate Pro", price: "฿199/เดือน", desc: "ปลดล็อกไม่จำกัด", highlight: true },
]

// วงจรความมั่งคั่ง (Growth Loop) — 6 ขั้นวางรอบมังกรกลาง (ตาม Figma 55271:8716)
const LOOP: { t: string; pos: string }[] = [
  { t: "1. ใช้ Qi", pos: "left-1/2 -translate-x-1/2 top-0" },
  { t: "2. อยากมูต่อ", pos: "right-0 top-[24%]" },
  { t: "3. แต้มหมด", pos: "right-0 top-[64%]" },
  { t: "4. ชวนเพื่อน", pos: "left-1/2 -translate-x-1/2 bottom-0" },
  { t: "5. ได้ Qi เพิ่ม", pos: "left-0 top-[64%]" },
  { t: "6. มูเตลู", pos: "left-0 top-[24%]" },
]

type SheetState = { kind: "confirm" | "insufficient"; line: QiSpendLine } | null

/** นักษัตร (ปีเกิด) จาก birthDate — เลือกมาสคอตตามธาตุเจ้าของ (ตาม engine element) */
function nakkasatFromBirth(birthDate?: string | null): string | null {
  if (!birthDate) return null
  const year = Number(birthDate.slice(0, 4))
  if (!Number.isFinite(year) || year < 1) return null
  const branchId = (((year - 4) % 12) + 12) % 12 + 1
  return toNakkasat(branchId)
}

function CoinBadge({ style }: { style: React.CSSProperties }) {
  return (
    <span
      aria-hidden
      className="absolute grid place-items-center rounded-full border-[1.5px] border-white bg-[#E5A93B] font-black text-white shadow-[0px_2px_2px_rgba(0,0,0,0.13)]"
      style={style}
    >
      $
    </span>
  )
}

export function QiScreen() {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [referral, setReferral] = useState<Referral | null>(null)
  const [catalog, setCatalog] = useState<QiCatalog | null>(null)
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  const [loading, setLoading] = useState(true)
  const [guard, setGuard] = useState<"not_authenticated" | null>(null)
  const [claimed, setClaimed] = useState<Record<string, "ok" | "capped" | "error">>({})
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [birthDate, setBirthDate] = useState<string | null>(null)
  const [elementTh, setElementTh] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [w, r, c, e, dn, p] = await Promise.all([
        fetch("/api/qi-wallet"),
        fetch("/api/referral"),
        fetch("/api/qi-catalog"),
        fetch("/api/qi-entitlements"),
        fetch("/api/v2/display-name"),
        fetch("/api/profile"),
      ])
      if (w.status === 401) {
        setGuard("not_authenticated")
        return
      }
      if (w.ok) setWallet(await w.json())
      if (r.ok) setReferral(await r.json())
      if (c.ok) setCatalog(await c.json())
      if (e.ok) setEntitlements(await e.json())
      if (dn.ok) {
        const j = (await dn.json().catch(() => ({}))) as { displayName?: string | null }
        setDisplayName(typeof j.displayName === "string" && j.displayName ? j.displayName : null)
      }
      // ธาตุเจ้าของ → มาสคอตในหน้า (Growth Loop) เปลี่ยนตามธาตุ (engine element-summary)
      const prof = p.ok ? (((await p.json().catch(() => ({}))) as { profile?: { birthDate?: string | null; birthTime?: string | null } }).profile ?? null) : null
      setBirthDate(prof?.birthDate ?? null)
      if (prof?.birthDate) {
        fetch("/api/bazi/element-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ person: { birthDate: prof.birthDate, birthTime: prof.birthTime ?? undefined } }),
        })
          .then((x) => (x.ok ? x.json() : null))
          .then((j) => setElementTh(j?.summary?.elementTh ?? null))
          .catch(() => setElementTh(null))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const earn = async (code: string) => {
    setBusyCode(code)
    try {
      const res = await fetch("/api/qi-earn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok) {
        setClaimed((m) => ({ ...m, [code]: j.capped ? "capped" : "ok" }))
        await load()
      } else if (res.status === 409 || String(j.error ?? "").includes("capped")) {
        setClaimed((m) => ({ ...m, [code]: "capped" }))
      } else {
        setClaimed((m) => ({ ...m, [code]: "error" }))
      }
    } finally {
      setBusyCode(null)
    }
  }

  const checkedIn = checkedInToday(wallet?.history, todayBangkok())
  const balance = wallet?.qi ?? 0
  const xpNext = typeof wallet?.nextLevelXp === "number" ? wallet.nextLevelXp : 1000
  const xpStart = typeof wallet?.levelStartXp === "number" ? wallet.levelStartXp : 0
  const xpNow = typeof wallet?.xp === "number" ? wallet.xp : 0
  const xpPct = Math.max(0, Math.min(100, Math.round(((xpNow - xpStart) / Math.max(1, xpNext - xpStart)) * 100)))
  const openSpend = (line: QiSpendLine) =>
    setSheet(balance >= line.qi ? { kind: "confirm", line } : { kind: "insufficient", line })

  // มาสคอตกลางวงจร Growth Loop = มาสคอตตามธาตุของเจ้าของ (มีวันเกิด+ธาตุ) — ไม่มีข้อมูล = ใช้มังกรกลาง
  const loopMascot = useMemo(() => {
    if (!birthDate || !elementTh) return null
    return resolveMascot(nakkasatFromBirth(birthDate), elementTh)?.character ?? null
  }, [birthDate, elementTh])

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
          {/* hero: orb 氣 + เหรียญลอย + หัวข้อแบรนด์ */}
          <section className="flex flex-col items-center gap-3 pt-1 text-center">
            <h2 className="text-[26px] font-black leading-9 text-v3-navy">
              คู่มือสะสม &amp; ใช้<br />พลังชี่เปลี่ยนชีวิต
            </h2>
            <div className="relative size-[180px]">
              <CoinBadge style={{ left: 8, top: 20, width: 24, height: 24, fontSize: 12, borderRadius: 12 }} />
              <CoinBadge style={{ right: 4, top: 44, width: 28, height: 28, fontSize: 14, borderRadius: 14 }} />
              <CoinBadge style={{ left: 2, top: 122, width: 20, height: 20, fontSize: 10, borderRadius: 10 }} />
              <CoinBadge style={{ right: 18, top: 138, width: 26, height: 26, fontSize: 13, borderRadius: 13 }} />
              <div className="absolute left-1/2 top-1/2 grid size-[132px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[rgba(245,165,42,0.28)]" style={{ boxShadow: "0px 0px 15px rgba(245,165,42,0.4)" }}>
                <div className="size-[104px] overflow-hidden rounded-full border-[3px] border-[#6F1BAF]" style={{ boxShadow: "0px 0px 32px rgba(111,27,175,0.3)" }}>
                  <Image src="/images/v2/qi/qi-orb.png" alt="" width={104} height={104} className="size-full object-cover" />
                </div>
              </div>
            </div>
            <p className="text-[14px] font-medium text-v3-cyan">สะสมพลังงานดีๆ ยกระดับชะตาชีวิตของคุณทุกวัน</p>
          </section>

          {/* ยอดคงเหลือ (interactive) */}
          <section className="relative overflow-hidden rounded-[24px] bg-v3-sapphire p-5 text-white" data-testid="qi-wallet">
            <p className="text-[12px] leading-4 text-white/75">ยอดคงเหลือปัจจุบัน</p>
            <p className="mt-1 flex items-end gap-1">
              <span className="text-[40px] font-black leading-[46px]" data-testid="qi-balance">{balance.toLocaleString("th-TH")}</span>
              <span className="pb-1 text-[18px] font-black text-v3-lime">QI</span>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/85">
              <span>Level {wallet?.level ?? 1}</span>
              {entitlements?.tier && entitlements.tier !== "free" ? (
                <>
                  <span>·</span>
                  <span data-testid="qi-tier">{TIER_LABEL[entitlements.tier] ?? entitlements.tier}</span>
                </>
              ) : null}
              {displayName ? <span data-testid="qi-display-name" className="text-white/55">@{displayName}</span> : null}
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-white/75">
                <span>XP {xpNow}</span>
                <span>ถึง Level ถัดไป {xpNext}</span>
              </div>
              <div className="mt-1 h-[8px] w-full overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-v3-lime" style={{ width: `${xpPct}%` }} data-testid="qi-xp-bar" />
              </div>
            </div>
            <Link href="/v2/qi/buy" data-testid="qi-topup-link" className="mt-4 grid h-11 w-full place-items-center rounded-full bg-v3-lime text-[14px] font-black text-v3-navy">
              เติม QI
            </Link>
          </section>

          {/* Qi Token คืออะไร? */}
          <SectionCard className="!flex-row !items-center gap-4 !rounded-[20px] !p-5" testId="qi-about">
            <span className="relative size-[104px] flex-none overflow-hidden rounded-full">
              <Image src="/images/v2/qi/qi-token.png" alt="" fill sizes="104px" className="object-cover" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[18px] font-bold text-v3-navy">Qi Token คืออะไร?</p>
              <p className="mt-1 text-[13px] leading-[20px] text-v3-text-body">
                โทเค็นพลังงานชีวิตดิจิทัลของคุณ ยิ่งสะสมกิจกรรมคิดบวกและทำภารกิจมูเตลูมากเท่าไหร่ ยิ่งเสริมกำลังพลังชี่ในการไขดวงลิขิตชีวิตได้ดียิ่งขึ้น!
              </p>
            </div>
          </SectionCard>

          {/* เช็คอินรายวัน (interactive) */}
          <SectionCard className="!flex-row !items-center gap-3 !rounded-[20px] !p-4">
            <span className="relative size-11 flex-none overflow-hidden rounded-[12px]" data-testid="qi-checkin">
              <Image src="/images/v2/qi/earn-login.png" alt="" fill sizes="44px" className="object-cover" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-v3-navy">
                เช็คอินรายวัน{" "}
                <Link href="/v2/qi/checkin" data-testid="qi-checkin-link" className="text-[12px] font-bold text-v3-cyan">
                  ดูสถานะ →
                </Link>
              </p>
              <p className="text-[11px] leading-4 text-v3-text-muted">กลับมาทุกวัน รับ +5 QI</p>
            </div>
            <button
              onClick={() => void earn("daily_login")}
              disabled={checkedIn || busyCode === "daily_login"}
              data-testid="qi-checkin-btn"
              className={
                (checkedIn ? "bg-v3-disabled-bg text-v3-text-muted" : "bg-v3-navy text-white") +
                " grid h-10 flex-none place-items-center rounded-full px-4 text-[12px] font-bold transition disabled:cursor-default"
              }
            >
              {checkedIn ? "เช็คอินแล้ว ✓" : busyCode === "daily_login" ? "..." : "เช็คอิน"}
            </button>
          </SectionCard>

          {/* วิธีสะสมพลังชี่ — earn list (interactive) */}
          <SectionCard className="!rounded-[20px]" testId="qi-tasks">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-v3-navy">วิธีสะสมพลังชี่</h2>
              <Link href="/v2/qi/missions" data-testid="qi-missions-link" className="text-[13px] font-medium text-v3-cyan underline">
                เริ่มต้นสะสม →
              </Link>
            </div>
            <div className="mt-3 flex flex-col divide-y divide-v3-border-card">
              {(catalog?.earn ?? []).map((line) => {
                const isPerReferral = line.limit === "per_referral"
                const state = claimed[line.code]
                return (
                  <div key={line.code} className="flex items-center gap-3 py-3">
                    <span className="relative size-12 flex-none overflow-hidden rounded-[12px]">
                      <Image src={earnThumb(line.code)} alt="" fill sizes="48px" className="object-cover" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] text-v3-text-body">{line.title}</p>
                      <p className="truncate text-[11px] leading-4 text-v3-text-muted">{line.note}</p>
                    </div>
                    <AmountPill qi={line.qi} sign="+" />
                    {isPerReferral ? (
                      <Link href="/v2/qi/referral" data-testid={`qi-task-${line.code}`} className="flex-none text-[12px] font-bold text-v3-cyan underline">
                        ไปชวน
                      </Link>
                    ) : (
                      <button
                        onClick={() => void earn(line.code)}
                        disabled={busyCode === line.code || state === "capped"}
                        data-testid={`qi-task-${line.code}`}
                        className={
                          (state === "capped" ? "bg-v3-disabled-bg text-v3-text-muted" : "bg-v3-navy text-white") +
                          " grid h-9 flex-none place-items-center rounded-full px-3 text-[12px] font-bold transition disabled:cursor-default"
                        }
                      >
                        {state === "capped" ? "รับแล้ว" : busyCode === line.code ? "..." : "รับ"}
                      </button>
                    )}
                  </div>
                )
              })}
              {!catalog && <div className="h-[64px] w-full animate-pulse rounded-[16px] bg-v3-ghost-white" />}
            </div>
          </SectionCard>

          {/* วิธีใช้ชี่ไขดวงชะตา (วิธีใช้ QI) — spend list (interactive) */}
          <SectionCard className="!rounded-[20px]" testId="qi-redeem">
            <h2 className="text-[18px] font-bold text-v3-navy">วิธีใช้ชี่ไขดวงชะตา (วิธีใช้ QI)</h2>
            <div className="mt-3 flex flex-col divide-y divide-v3-border-card">
              {(catalog?.spend ?? []).map((line) => (
                <div key={line.code} className="flex items-center gap-3 py-3">
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
                  <button
                    onClick={() => openSpend(line)}
                    data-testid={`qi-redeem-${line.code}`}
                    className="flex-none rounded-full bg-v3-navy px-3 py-1.5 text-[12px] font-black text-white"
                  >
                    {line.qi.toLocaleString("th-TH")} QI
                  </button>
                </div>
              ))}
              {!catalog && <div className="h-[64px] w-full animate-pulse rounded-[16px] bg-v3-ghost-white" />}
            </div>
            {entitlements?.credits && (
              <p className="mt-2 text-[11px] leading-4 text-v3-text-muted" data-testid="qi-credits">
                สิทธิ์คงเหลือ: เปิดการ์ด {entitlements.credits.card_use ?? 0} · ถาม AI {entitlements.credits.chat_question ?? 0} ·
                ช่องจับคู่ {entitlements.credits.matching_slot ?? 0}
              </p>
            )}
          </SectionCard>

          {/* วงจรความมั่งคั่ง (Growth Loop) */}
          <SectionCard className="!items-center !rounded-[20px]" testId="qi-growth">
            <h2 className="w-full text-[18px] font-bold text-v3-navy">วงจรความมั่งคั่ง (Growth Loop)</h2>
            <div className="relative my-2 size-[300px]">
              <div className="absolute left-1/2 top-1/2 size-[86px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[43px] border-4 border-[#FBEFF2]">
                <Image src={loopMascot ?? "/images/v2/qi/growth-dragon.png"} alt="" fill sizes="86px" className="object-contain" />
              </div>
              {LOOP.map((s) => (
                <span key={s.t} className={`absolute ${s.pos} rounded-[10px] border-[1.5px] border-v3-cyan bg-[#EAF3FF] px-2 py-1 text-[12px] font-bold text-v3-navy`}>
                  {s.t}
                </span>
              ))}
              {/* ลูกศรวน (ตามเข็มนาฬิกา) เชื่อม 6 ขั้น (เฟรม rotate-cw/arrow-down/left/up-right) */}
              {[
                { c: "↻", pos: "left-[52%] top-[13%]" },
                { c: "→", pos: "left-[30%] top-[14%]" },
                { c: "↓", pos: "right-[8%] top-[42%]" },
                { c: "←", pos: "left-[55%] bottom-[15%]" },
                { c: "←", pos: "left-[30%] bottom-[15%]" },
                { c: "↗", pos: "left-[7%] top-[42%]" },
              ].map((a, i) => (
                <span key={i} aria-hidden className={`absolute ${a.pos} text-[18px] font-black leading-none text-v3-cyan`}>{a.c}</span>
              ))}
            </div>
            <p className="text-center text-[13px] leading-5 text-v3-text-muted">หมุนเวียนพลังงานบวกไม่สิ้นสุด ยิ่งแชร์ ยิ่งส่งเสริมซึ่งกันและกัน</p>
          </SectionCard>

          {/* ทางไหนคุ้มกับคุณ */}
          <SectionCard className="!rounded-[20px]" testId="qi-compare">
            <h2 className="text-[18px] font-bold text-v3-navy">ทางไหนคุ้มกับคุณ</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {COMPARE.map((c) => (
                <div
                  key={c.key}
                  className={
                    "flex flex-col items-center gap-1 rounded-[16px] px-2 py-3 text-center " +
                    (c.highlight ? "bg-v3-navy text-white" : "border border-v3-border-card bg-white")
                  }
                >
                  <p className={"text-[12px] font-black " + (c.highlight ? "text-white" : "text-v3-navy")}>{c.title}</p>
                  <p className={"text-[13px] font-black " + (c.highlight ? "text-v3-lime" : "text-v3-navy")}>{c.price}</p>
                  <p className={"text-[10px] leading-3 " + (c.highlight ? "text-white/80" : "text-v3-text-muted")}>{c.desc}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ชวนเพื่อน (interactive) */}
          <SectionCard id="referral" className="!rounded-[20px]" testId="qi-referral">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-v3-navy">ชวนเพื่อน รับคนละ 50 QI</h2>
              <Link href="/v2/qi/referral" data-testid="qi-referral-link" className="text-[12px] font-bold text-v3-cyan">
                หน้าชวนเพื่อน →
              </Link>
            </div>
            <p className="mt-1 text-[12px] leading-4 text-v3-text-body">
              เพื่อนสมัครผ่านโค้ดของคุณ — เพื่อนได้ +30 QI คุณได้ +50 QI
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-v3-border-input bg-white px-4">
                <span className="truncate text-[14px] font-black tracking-wider text-v3-navy" data-testid="qi-referral-code">
                  {referral?.code ?? "······"}
                </span>
              </div>
              <button
                onClick={async () => {
                  if (!referral?.code) return
                  await navigator.clipboard.writeText(referral.code).catch(() => {})
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 2000)
                }}
                data-testid="qi-referral-copy"
                className="grid h-11 flex-none place-items-center rounded-full bg-v3-navy px-4 text-[12px] font-bold text-white"
              >
                {copied ? "คัดลอกแล้ว!" : "คัดลอกโค้ด"}
              </button>
            </div>
            {typeof referral?.invitedCount === "number" && (
              <p className="mt-2 text-[11px] text-v3-text-muted">เพื่อนที่ใช้โค้ดแล้ว: {referral.invitedCount} คน</p>
            )}
          </SectionCard>

          {/* เคลื่อนไหวล่าสุด (ย่อ 3 แถว) */}
          {wallet?.history && wallet.history.length > 0 && (
            <SectionCard className="!rounded-[20px]" testId="qi-history">
              <div className="flex items-center justify-between">
                <h2 className="text-[18px] font-bold text-v3-navy">เคลื่อนไหวล่าสุด</h2>
                <Link href="/v2/qi/history" data-testid="qi-history-link" className="text-[12px] font-bold text-v3-cyan">
                  ดูทั้งหมด →
                </Link>
              </div>
              <ul className="mt-2 flex flex-col divide-y divide-v3-border-card">
                {wallet.history.slice(0, 3).map((h) => (
                  <li key={h.id} className="flex items-center justify-between py-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate text-v3-text-body">{reasonLabel(h.reason)}</span>
                    <span className={"flex-none font-bold " + (h.qiDelta > 0 ? "text-v3-sapphire" : "text-v3-error")}>
                      {h.qiDelta > 0 ? "+" : ""}
                      {h.qiDelta} QI
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {/* ปุ่มท้าย (Figma footer-cta) */}
          {!checkedIn ? (
            <button
              onClick={() => void earn("daily_login")}
              disabled={busyCode === "daily_login"}
              data-testid="qi-cta-checkin"
              className="grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-[15px] font-bold uppercase text-v3-lime disabled:opacity-40"
            >
              เริ่มต้นสะสมพลังชี่ของคุณเลย
            </button>
          ) : (
            <Link href="/v2/qi/missions" data-testid="qi-cta-checkin" className="grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-[15px] font-bold uppercase text-v3-lime">
              ทำภารกิจรับ QI เพิ่ม
            </Link>
          )}
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
        <InsufficientQiSheet line={sheet.line} balance={balance} onClose={() => setSheet(null)} />
      )}
    </SkyScreen>
  )
}

export default QiScreen
