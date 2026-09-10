// features/v2-qi/components/QiScreen.tsx — จอ "คู่มือพลังชี่" (/v2/qi).
//
// Design: Figma frame `qi-guide — UX v2` (55399:7219) — design context MCP 2026-09-07 (ตัวเลขทุกตัวจากเฟรม):
//   hero การ์ด r22 px20 py24 gap14 (ภาพมาสคอตจากทีม + orb 60) · title 24 bold navy · sub 12 #464646
//   · current-balance แถวน้ำเงิน r16 px16 py14 gap12: orb 60 · "ยอดคงเหลือปัจจุบัน" 13 ขาว · "N QI" 16 bold lime · chevron 32
//   · section header 18 bold navy + "ทำเลย ›" 13 #1455A4 · list การ์ดขาว border #E6E1DD r18, row px16 py13 gap12:
//     icon-slot 36 r12 (earn #E3F8D1 / spend #F6ECF0) + ไอคอนเส้น 22 (asset จาก Figma ใน /images/v2/qi/guide)
//     · ชื่อ 14 medium navy · หมายเหตุ 9 #8C8C8C · chip จำนวน px10 py5 r10 14 semibold (earn #63B05F / spend #E08586 บน #FCE9F0)
//   · ทางไหนคุ้มกับคุณ: การ์ดขาว border r16 px16 py14 gap6 · Pro = border-2 #6F1BAF + badge #F1E8FA "ใช้บ่อยคุ้มสุด" 9 bold
//   · sticky-footer ปุ่ม sapphire r999 py16 16 bold lime + "มีคำถามเพิ่มเติม ดูคำถามที่พบบ่อย" 9 #1455A4
// การ "รับ" QI จริงอยู่ที่จอเช็คอิน/ภารกิจ (ลิงก์ออกไป) — คู่มือนี้ไม่มีปุ่มรับรายบรรทัด.
// spend list ยัง "แตะเพื่อแลกได้" (ชีตยืนยัน) เพราะเป็นทางเดียวที่ redeem สิทธิ์ catalog. Identity = cookie-mumate-id (BFF → anonId).
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { SpendConfirmSheet, InsufficientQiSheet } from "./QiSpendSheets"
import { SkyHeader, SkyScreen } from "@/features/v2-profile/components/kit"
import { checkedInToday, todayBangkok, type MissionBoard, type QiCatalog, type QiSpendLine, type Referral, type Wallet } from "../qi-model"

const G = "/images/v2/qi/guide"
// ไอคอนเส้นตามเฟรม (earn: check-circle / sun / send / rocket / user-plus / glyph-5 · spend: sparkles / message / heart / cap / book)
const EARN_ICON: Record<string, string> = {
  daily_login: "check-circle",
  streak_7: "check-circle",
  signup: "rocket",
  onboarding: "rocket",
  read_today: "sun",
  share: "send",
  referral_free: "user-plus",
  referral_plus: "user-plus",
  referral_pro: "user-plus",
  wuxing_matrix: "glyph-5",
  first_buy_bonus: "sparkles",
}
const SPEND_ICON: Record<string, string> = {
  card_use: "sparkles",
  chat_question: "message-circle",
  matching_slot: "heart",
  course_destiny: "graduation-cap",
  book_lifecode: "book-open",
  plus_month: "graduation-cap",
  birth_edit: "sun",
}
const earnIcon = (code: string) => `${G}/${EARN_ICON[code] ?? "check-circle"}.svg`
// แถวที่เฟรมมีแต่ catalog ไม่มี code แยก — มาจากภารกิจ (engine MISSION_DEFS ผ่าน /api/missions): จำนวน QI = rewardCoins จริง
// วางแทรกตามลำดับเฟรม: หลัง daily_login (streak_7, read_fortune) · ไม่มี board = ไม่แสดง ไม่เดาตัวเลข
const MISSION_ROWS: Array<{ id: string; after: string; icon: string; title: string; note: string }> = [
  { id: "streak_7", after: "daily_login", icon: "check-circle", title: "เช็คอินครบ 7 วันติด", note: "นับใหม่ทุกสัปดาห์ ขาดวันเดียวเริ่มใหม่" },
  { id: "read_fortune", after: "streak_7", icon: "sun", title: "อ่านดวงวันนี้", note: "เปิดอ่านคำทำนายประจำวันให้จบ" },
]
type EarnRow = { key: string; icon: string; title: string; note: string | null; qi: number; testId: string }
export function earnRows(catalog: QiCatalog | null, board: MissionBoard | null): EarnRow[] {
  const rows: EarnRow[] = (catalog?.earn ?? []).map((l) => ({
    key: l.code, icon: earnIcon(l.code), title: EARN_COPY[l.code]?.title ?? l.title, note: EARN_COPY[l.code]?.note ?? l.note ?? null, qi: l.qi, testId: `qi-earn-${l.code}`,
  }))
  for (const m of MISSION_ROWS) {
    const def = (Array.isArray(board?.missions) ? board.missions : []).find((x) => x.id === m.id)
    if (!def) continue
    const row: EarnRow = { key: `mission:${m.id}`, icon: `${G}/${m.icon}.svg`, title: m.title, note: m.note, qi: def.rewardCoins, testId: `qi-earn-mission-${m.id}` }
    const at = rows.findIndex((r) => r.key === m.after || r.key === `mission:${m.after}`)
    rows.splice(at >= 0 ? at + 1 : rows.length, 0, row)
  }
  return rows
}
const spendIcon = (code: string) => `${G}/${SPEND_ICON[code] ?? "sparkles"}.svg`

// copy ตามเฟรม (ชื่อ/หมายเหตุ) — จำนวน QI ยังมาจาก catalog ของ engine เสมอ; code ที่เฟรมไม่มีใช้ข้อความ engine
const EARN_COPY: Record<string, { title: string; note: string }> = {
  daily_login: { title: "เช็คอินรายวัน", note: "กดวันละครั้ง ไม่ต้องจ่ายอะไร" },
  share: { title: "แชร์ดวงวันนี้", note: "แชร์การ์ดลงโซเชียล วันละ 1 ครั้ง" },
  signup: { title: "ภารกิจเริ่มต้น", note: "สมัคร กรอกวันเกิด เชื่อม LINE เปิดแจ้งเตือน" },
  referral_free: { title: "เพื่อนสมัครจากลิงก์คุณ", note: "นับเมื่อเพื่อนกรอกวันเกิดและเช็คอินครั้งแรก" },
  wuxing_matrix: { title: "สะสมเพื่อนครบ 5 ธาตุ", note: "ธาตุของเพื่อนคำนวณจากวันเกิด เลือกไม่ได้" },
}
const SPEND_COPY: Record<string, string> = {
  card_use: "เปิดไพ่ / เซียมซี",
  chat_question: "ถามเซียนมู่ (AI Chat)",
  matching_slot: "เพิ่มช่องดวงสมพงศ์ถาวร",
  course_destiny: "คอร์สเรียนดูดวงชะตา",
  book_lifecode: "Life Code Book",
}

// มูลค่าจริง (บาท) ของสิทธิ์ที่แลกด้วย QI — "มูลค่า ฿N" ตามเฟรม (เฉพาะเส้นที่มีมูลค่าเงิน)
const SPEND_BAHT: Record<string, number> = { course_destiny: 499, book_lifecode: 1890 }
const SPEND_NOTE: Record<string, string> = { plus_month: "เหมาะกับ QI ที่สะสมเอง · ซื้อ Pro ตรงถูกกว่า ฿199" }

const COMPARE = [
  { key: "free", title: "สะสมฟรีอย่างเดียว", price: "ฟรี", desc: "เหมาะถ้าดูดวงสัปดาห์ละ 1-2 ครั้ง ใช้เวลาสะสมหน่อยแต่ไม่เสียเงิน", highlight: false },
  { key: "once", title: "ซื้อ QI เป็นครั้ง", price: "เริ่ม ฿35", desc: "เหมาะถ้าอยากดูเป็นช่วง ๆ ไม่ผูกมัดรายเดือน", highlight: false },
  { key: "pro", title: "Mumate Pro", price: "฿199 / เดือน", desc: "เหมาะถ้าถามเซียนมู่เกิน 20 ครั้งต่อเดือน ถูกกว่าซื้อ QI ชัดเจน", highlight: true },
]

type SheetState = { kind: "confirm" | "insufficient"; line: QiSpendLine } | null

const BORDER = "#E6E1DD"

function Orb({ size = 60 }: { size?: number }) {
  return (
    <span aria-hidden className="relative block flex-none overflow-hidden rounded-full" style={{ width: size, height: size }}>
      <Image src={`${G}/orb.png`} alt="" fill sizes={`${size}px`} className="object-cover" />
    </span>
  )
}

function Chevron() {
  return (
    <span className="grid size-8 flex-none place-items-center">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="m7.5 4.5 5 5.5-5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  )
}

function Amount({ qi, kind }: { qi: number; kind: "earn" | "spend" }) {
  const earn = kind === "earn"
  return (
    <span className={"flex-none rounded-[10px] px-2.5 py-[5px] text-[14px] font-semibold leading-5 whitespace-nowrap " + (earn ? "bg-v3-qi-earn-bg text-v3-qi-earn" : "bg-v3-qi-spend-bg text-v3-qi-spend")}>
      {earn ? "+" : "-"}{qi.toLocaleString("th-TH")} QI
    </span>
  )
}

function Row({ icon, iconBg, title, note, right, testId, onClick }: { icon: string; iconBg: string; title: string; note?: string | null; right: React.ReactNode; testId: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className="grid size-9 flex-none place-items-center rounded-[12px]" style={{ backgroundColor: iconBg }}>
        <img src={icon} alt="" aria-hidden className="size-[22px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[2px] text-left">
        <span className="truncate text-[14px] font-medium leading-5 text-v3-navy">{title}</span>
        {note ? <span className="truncate text-[9px] leading-3 text-v3-text-note">{note}</span> : null}
      </span>
      {right}
    </>
  )
  const cls = "flex w-full items-center gap-3 px-4 py-[13px] border-t first:border-t-0"
  return onClick ? (
    <button type="button" onClick={onClick} data-testid={testId} className={cls} style={{ borderColor: BORDER }}>{inner}</button>
  ) : (
    <div data-testid={testId} className={cls} style={{ borderColor: BORDER }}>{inner}</div>
  )
}

function ListCard({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return <div data-testid={testId} className="flex w-full flex-col overflow-hidden rounded-[18px] border bg-white" style={{ borderColor: BORDER }}>{children}</div>
}

export function QiScreen() {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [, setReferral] = useState<Referral | null>(null)
  const [catalog, setCatalog] = useState<QiCatalog | null>(null)
  const [board, setBoard] = useState<MissionBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [guard, setGuard] = useState<"not_authenticated" | null>(null)
  const [busyCheckin, setBusyCheckin] = useState(false)
  const [sheet, setSheet] = useState<SheetState>(null)

  const load = useCallback(async () => {
    try {
      const [w, r, c, m] = await Promise.all([fetch("/api/qi-wallet"), fetch("/api/referral"), fetch("/api/qi-catalog"), fetch("/api/missions").catch(() => null)])
      if (w.status === 401) {
        setGuard("not_authenticated")
        return
      }
      if (w.ok) setWallet(await w.json())
      if (r.ok) setReferral(await r.json())
      if (c.ok) setCatalog(await c.json())
      if (m?.ok) setBoard((await m.json().catch(() => null)) as MissionBoard | null)
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
      const res = await fetch("/api/qi-earn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "daily_login" }) })
      if (res.ok) await load()
    } finally {
      setBusyCheckin(false)
    }
  }

  const checkedIn = checkedInToday(wallet?.history, todayBangkok())
  const balance = wallet?.qi ?? 0
  const openSpend = (line: QiSpendLine) => setSheet(balance >= line.qi ? { kind: "confirm", line } : { kind: "insufficient", line })

  const checkinQi = catalog?.earn.find((e) => e.code === "daily_login")?.qi ?? 5
  const chatQi = catalog?.spend.find((s) => s.code === "chat_question")?.qi ?? 0
  const cardQi = catalog?.spend.find((s) => s.code === "card_use")?.qi ?? 0
  const dailyFree = (catalog?.earn ?? []).filter((e) => e.limit === "daily").reduce((n, e) => n + e.qi, 0)

  return (
    <SkyScreen>
      <Head>
        <title>คู่มือพลังชี่ — Mumate</title>
      </Head>
      <SkyHeader title="คู่มือพลังชี่" testId="qi" />

      {loading && (
        <div className="mt-2 flex flex-col gap-5" data-testid="qi-loading">
          <div className="h-[220px] w-full animate-pulse rounded-[22px] bg-white/70" />
          <div className="h-[88px] w-full animate-pulse rounded-[16px] bg-v3-sapphire/20" />
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
        <div className="mt-2 flex flex-col gap-5 pb-2">
          {/* hero — การ์ดภาพมาสคอต (ทีมส่งใน Drive "เหรียญ Qi") + orb 60 + หัว 24 + คำอธิบาย 12 */}
          <section data-testid="qi-hero" className="flex flex-col items-center overflow-hidden rounded-[22px] bg-white text-center">
            {/* รูปมาสคอตเต็มความสูง (4:3 ของไฟล์ 800×600) — ผู้ใช้ 2026-09-07: เอา orb กลางออก ขยายรูปลงมาแทน */}
            <span className="relative block aspect-[4/3] w-full">
              <Image src={`${G}/hero-mascots.png`} alt="" fill sizes="393px" priority className="object-cover" />
            </span>
            <div className="flex flex-col items-center gap-3.5 px-5 pb-6 pt-4">
              <h2 className="text-[24px] font-bold leading-8 text-v3-navy">คู่มือสะสมและใช้พลังชี่</h2>
              <p className="text-[12px] leading-[18px] text-v3-text-body">QI คือแต้มพลังงานในแอป สะสมฟรีได้ทุกวัน หรือซื้อเพิ่มก็ได้ ใช้แลกบริการดูดวงทั้งหมด</p>
            </div>
          </section>

          {/* current-balance — แตะดูประวัติ */}
          <Link href="/v2/qi/history" data-testid="qi-wallet" className="flex items-center gap-3 rounded-[16px] bg-v3-sapphire px-4 py-3.5 text-white">
            <Orb size={60} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[13px] leading-[18px]">ยอดคงเหลือปัจจุบัน</span>
              <span className="text-[16px] font-bold leading-6 text-v3-lime"><span data-testid="qi-balance">{balance.toLocaleString("th-TH")}</span> QI</span>
            </span>
            <Chevron />
          </Link>

          {/* สะสมพลังชี่ฟรี */}
          <section className="flex flex-col gap-2.5" data-testid="qi-tasks">
            <div className="flex items-center">
              <h2 className="flex-1 text-[18px] font-bold leading-6 text-v3-navy">สะสมพลังชี่ฟรี</h2>
              <Link href="/v2/qi/missions" data-testid="qi-missions-link" className="text-[13px] leading-[18px] text-v3-sapphire">ทำเลย ›</Link>
            </div>
            <ListCard>
              {earnRows(catalog, board).map((r) => (
                <Row key={r.key} testId={r.testId} icon={r.icon} iconBg="#E3F8D1" title={r.title} note={r.note} right={<Amount qi={r.qi} kind="earn" />} />
              ))}
              {!catalog && <div className="h-[64px] w-full animate-pulse bg-v3-ghost-white" />}
            </ListCard>
            <p className="text-[9px] leading-3 text-v3-text-note">ทำครบทุกอย่างได้ราว {dailyFree.toLocaleString("th-TH")} QI ต่อวัน โดยไม่ต้องจ่ายเงิน</p>
          </section>

          {/* ใช้พลังชี่แลกอะไรได้บ้าง — แตะเพื่อแลก */}
          <section className="flex flex-col gap-2.5" data-testid="qi-redeem">
            <h2 className="text-[18px] font-bold leading-6 text-v3-navy">ใช้พลังชี่แลกอะไรได้บ้าง</h2>
            <ListCard>
              {(catalog?.spend ?? []).map((line) => (
                <Row
                  key={line.code}
                  testId={`qi-redeem-${line.code}`}
                  icon={spendIcon(line.code)}
                  iconBg="#F6ECF0"
                  title={SPEND_COPY[line.code] ?? line.title}
                  note={SPEND_BAHT[line.code] ? `มูลค่า ฿${SPEND_BAHT[line.code].toLocaleString("th-TH")}` : SPEND_NOTE[line.code] ?? null}
                  right={<Amount qi={line.qi} kind="spend" />}
                  onClick={() => openSpend(line)}
                />
              ))}
              {!catalog && <div className="h-[64px] w-full animate-pulse bg-v3-ghost-white" />}
            </ListCard>
            {chatQi > 0 && cardQi > 0 ? (
              <p className="text-[9px] leading-3 text-v3-text-note">
                ยอด {balance.toLocaleString("th-TH")} QI ของคุณ = ถามเซียนมู่ได้ {Math.floor(balance / chatQi).toLocaleString("th-TH")} ครั้ง หรือเปิดไพ่ได้ {Math.floor(balance / cardQi).toLocaleString("th-TH")} ครั้ง
              </p>
            ) : null}
          </section>

          {/* ทางไหนคุ้มกับคุณ */}
          <section className="flex flex-col gap-2.5" data-testid="qi-compare">
            <h2 className="text-[18px] font-bold leading-6 text-v3-navy">ทางไหนคุ้มกับคุณ</h2>
            {COMPARE.map((c) => (
              <div key={c.key} className="flex flex-col gap-1.5 rounded-[16px] bg-white px-4 py-3.5" style={{ border: c.highlight ? "2px solid #6F1BAF" : `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-2 text-[14px] leading-5 text-v3-navy">
                  <span className="flex-1 font-medium">{c.title}</span>
                  {c.highlight ? <span className="rounded-[8px] bg-v3-purple-bg px-[7px] py-[3px] text-[9px] font-bold leading-3 text-v3-purple">ใช้บ่อยคุ้มสุด</span> : null}
                  <span className="font-semibold whitespace-nowrap">{c.price}</span>
                </div>
                <p className="text-[12px] leading-[18px] text-v3-text-body">{c.desc}</p>
              </div>
            ))}
            <p className="text-[9px] leading-3 text-v3-text-note">QI ไม่มีวันหมดอายุ และ QI ที่ได้ฟรีกับที่ซื้อใช้ร่วมกันได้</p>
          </section>

          {/* ทางเข้าจอย่อย: ชวนเพื่อน / เติม QI (นอกเฟรม แต่เป็นฟีเจอร์จริง — แถวเล็กใต้ตาราง) */}
          <div className="flex items-center gap-2 text-[13px] leading-[18px]">
            <Link href="/v2/qi/referral" data-testid="qi-referral-link" className="flex-1 rounded-[14px] border bg-white px-4 py-3 text-center font-semibold text-v3-sapphire" style={{ borderColor: BORDER }}>ชวนเพื่อน รับ 50 QI</Link>
            <Link href="/v2/qi/buy" data-testid="qi-topup-link" className="flex-1 rounded-[14px] border bg-white px-4 py-3 text-center font-semibold text-v3-sapphire" style={{ borderColor: BORDER }}>ซื้อแพ็ก QI</Link>
          </div>

          {/* sticky-footer (Figma) */}
          <div className="flex flex-col items-center gap-2 pt-1">
            {!checkedIn ? (
              <button onClick={() => void checkin()} disabled={busyCheckin} data-testid="qi-cta-checkin" className="grid w-full place-items-center rounded-full bg-v3-sapphire py-4 text-[16px] font-bold leading-6 uppercase text-v3-lime disabled:opacity-40">
                {busyCheckin ? "กำลังบันทึก..." : `เริ่มสะสมพลังชี่วันนี้ รับ +${checkinQi} QI`}
              </button>
            ) : (
              <Link href="/v2/qi/missions" data-testid="qi-cta-checkin" className="grid w-full place-items-center rounded-full bg-v3-sapphire py-4 text-[16px] font-bold leading-6 uppercase text-v3-lime">
                ทำภารกิจรับ QI เพิ่ม
              </Link>
            )}
            <Link href="/v2/qi/history" data-testid="qi-history-link" className="text-center text-[9px] leading-3 text-v3-sapphire">มีคำถามเพิ่มเติม ดูประวัติการได้รับและใช้ QI</Link>
          </div>
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
          hints={{ checkinQi: catalog?.earn.find((e) => e.code === "daily_login")?.qi, shareQi: catalog?.earn.find((e) => e.code === "share")?.qi }}
        />
      )}
    </SkyScreen>
  )
}

export default QiScreen
