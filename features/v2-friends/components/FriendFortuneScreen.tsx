// features/v2-friends/components/FriendFortuneScreen.tsx — จอ "ดูดวงเพื่อน" (/v2/friends/[id] · ประชุม 24 พ.ย. ข้อ 2)
//
// ลำดับของจอ = กติกาของเงิน:
//   1) ถามราคาก่อน (GET /api/v2/friends/reading) — ยังไม่คำนวณ ยังไม่หักชี แค่เปิดหน้าไม่มีค่าใช้จ่าย
//   2) ผู้ใช้กด "ดูดวง" (ถ้าเป็นราคา 30 ชี ต้องยืนยันผ่าน SpendConfirmSheet ก่อน)
//   3) POST /api/v2/friends/reading → server คำนวณก่อน แล้วค่อยบันทึกสล็อตฟรี/หักชี → ส่งดวง
//      402 → ชีตชีไม่พอ (ยอดจากกระเป๋าจริง) · 502/503 → บอกว่าไม่สำเร็จ "ไม่มีการหักชี" + ลองใหม่
// เนื้อหาทุกบรรทัดมาจาก engine (ชะตา 4 เสา + ใจความดวง) — จอนี้ไม่แต่งเนื้อหาเอง
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { Menubar } from "@/features/v2-shell/components/Menubar"
import { KitButton, SectionCard, SheetShell, SkyHeader, SkyScreen } from "@/features/v2-profile/components/kit"
import { InsufficientQiSheet } from "@/features/v2-qi/components/QiSpendSheets"
import type { QiSpendLine } from "@/features/v2-qi/qi-model"
import type { ChartPayload } from "@/lib/chart/engine-chart"
import { ZODIAC_TABLE } from "@/lib/personalization/zodiac"
import { formatThaiDateAbbr } from "@/lib/v2/thai-date"
import { FRIEND_READING_CODE, FRIEND_READING_QI, type ReadingBasis } from "../reading-policy"
import { friendInitial } from "../friends-model"
import { Portal } from "./Portal"
import { FRIENDS_COMPAT_HREF } from "./FriendsListScreen"

export const FRIENDS_LIST_HREF = "/v2/friends"

export type FriendReadingQuote = {
  friend: { id: string; name: string; pictureUrl: string | null }
  hasBirthTime: boolean
  canCompute: boolean
  plan: { basis: ReadingBasis; priceQi: number; freeUsedAfter: number | null }
  balance: number | null
  freeSlots: { used: number; max: number } | null
}

type Luck = { label?: string | null; text?: string | null } | null
export type FriendReadingResult = {
  ok: true
  friend: { id: string; name: string; pictureUrl: string | null }
  birth: { date: string; hasBirthTime: boolean }
  chart: ChartPayload
  pillars: { year: FriendPillar | null; month: FriendPillar | null; day: FriendPillar | null; hour: FriendPillar | null }
  reading: { prediction?: { personality?: string | null; habit?: string | null; love?: string | null } | null; cautions?: string[] | null; deity?: string | null; luck?: { year?: Luck; month?: Luck } | null } | null
  charge: { basis: ReadingBasis; qi: number }
  balance: number | null
  freeSlots: { used: number; max: number } | null
}
type FriendPillar = { stem: string; branch: string; stemElement: string; branchElement: string }

/** รายการในชีตยืนยัน/ชีตชีไม่พอ — ค่าเดียวกับ reading-policy (ราคา 30 ชี) ไม่ไปอ่าน catalog ของ engine ให้ลำดับ deploy มาขัด */
export const FRIEND_READING_LINE: QiSpendLine = {
  code: FRIEND_READING_CODE,
  qi: FRIEND_READING_QI,
  grant: { type: "credit", kind: "card_use", credits: 0 },
  title: "ดูดวงเพื่อน",
  note: "ดูดวงของเพื่อนในรายชื่อ 1 ครั้ง",
}

const qiText = (n: number) => n.toLocaleString("th-TH")

/** ป้ายบอกราคาของการดู "ครั้งนี้" — null = ยังไม่รู้ราคา */
export function priceText(q: Pick<FriendReadingQuote, "plan" | "balance" | "freeSlots">): string {
  const { plan, balance, freeSlots } = q
  if (plan.basis === "slot") return "สิทธิ์สมาชิก Pro — เพื่อนคนนี้อยู่ในสล็อตฟรีของคุณแล้ว ดูได้ไม่หักชี"
  if (plan.basis === "new_slot") {
    return `สิทธิ์สมาชิก Pro — ฟรี ${freeSlots?.max ?? ""} คนแรก (ใช้ไป ${freeSlots?.used ?? 0}/${freeSlots?.max ?? ""} คน)`
  }
  return `ดู 1 ครั้งใช้ ${qiText(plan.priceQi)} QI${balance !== null ? ` · คงเหลือ ${qiText(balance)} QI` : ""}`
}

/** ข้อความหลังดวงออก: จ่ายอะไรไป — บอกตามที่ server ตอบ ไม่เดา */
export function chargeText(c: FriendReadingResult["charge"], balance: number | null): string {
  if (c.basis === "qi") return `หัก ${qiText(c.qi)} QI${balance !== null ? ` · คงเหลือ ${qiText(balance)} QI` : ""}`
  return "ใช้สิทธิ์สมาชิก Pro — ไม่หักชี"
}

function Section({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <SectionCard className="!rounded-[18px]" testId={testId}>
      <h2 className="text-[16px] font-bold text-v3-navy">{title}</h2>
      <div className="mt-2">{children}</div>
    </SectionCard>
  )
}
const PROSE = "whitespace-pre-line text-[14px] leading-[22px] text-v3-text-body"

export function FriendFortuneScreen({ friendId }: { friendId: string }) {
  const [quote, setQuote] = useState<FriendReadingQuote | null>(null)
  const [quoteStatus, setQuoteStatus] = useState<number | null>(null) // HTTP ของใบเสนอราคาเมื่อล้ม
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<FriendReadingResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [readError, setReadError] = useState<{ kind: "failed" | "notFound" | "notReady" } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [insufficient, setInsufficient] = useState<number | null>(null) // ยอดชีจริงตอนไม่พอ (null = ปิดชีต) — เก็บยอดแยก

  useEffect(() => {
    let alive = true
    setQuote(null)
    setQuoteStatus(null)
    void (async () => {
      try {
        const r = await fetch(`/api/v2/friends/reading?id=${encodeURIComponent(friendId)}`)
        const j = (await r.json().catch(() => null)) as Partial<FriendReadingQuote> | null
        if (!alive) return
        if (!r.ok || !j?.friend || !j.plan) {
          setQuoteStatus(r.status || 500)
          return
        }
        setQuote(j as FriendReadingQuote)
      } catch {
        if (alive) setQuoteStatus(500)
      }
    })()
    return () => {
      alive = false
    }
  }, [friendId, attempt])

  const read = useCallback(async () => {
    setBusy(true)
    setReadError(null)
    try {
      const r = await fetch("/api/v2/friends/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: friendId }),
      })
      const j = (await r.json().catch(() => null)) as (Partial<FriendReadingResult> & { balance?: unknown }) | null
      if (r.status === 402) {
        setInsufficient(typeof j?.balance === "number" ? j.balance : 0)
        return
      }
      if (r.status === 404) {
        setReadError({ kind: "notFound" })
        return
      }
      if (r.status === 503) {
        setReadError({ kind: "notReady" })
        return
      }
      if (!r.ok || !j?.ok || !j.reading || !j.chart) {
        setReadError({ kind: "failed" })
        return
      }
      setResult(j as FriendReadingResult)
      setConfirming(false)
    } catch {
      setReadError({ kind: "failed" })
    } finally {
      setBusy(false)
    }
  }, [friendId])

  const onPrimary = () => {
    if (!quote || busy) return
    if (quote.plan.basis === "qi") {
      // รู้ยอดและรู้ว่าไม่พอ → เปิดชีตชีไม่พอเลย ไม่ต้องให้ engine คำนวณฟรี (ไม่รู้ยอด → ให้ยืนยันก่อนแล้ว server ตัดสิน)
      if (quote.balance !== null && quote.balance < quote.plan.priceQi) setInsufficient(quote.balance)
      else setConfirming(true)
      return
    }
    void read()
  }

  const name = quote?.friend.name ?? result?.friend.name ?? "เพื่อน"
  const pic = (result?.friend.pictureUrl ?? quote?.friend.pictureUrl ?? "").trim()
  const friendForInitial = { id: friendId, name }

  return (
    <SkyScreen menubar={<Menubar />}>
      <Head><title>ดูดวงเพื่อน · MuMate</title></Head>
      <SkyHeader title="ดูดวงเพื่อน" backHref={FRIENDS_LIST_HREF} testId="friend-fortune" />

      {/* ใบเสนอราคายังโหลด */}
      {!quote && quoteStatus === null && (
        <div className="mt-3" data-testid="friend-fortune-loading">
          <div className="h-[220px] w-full animate-pulse rounded-[20px] bg-v3-sky-tint/60" />
        </div>
      )}

      {quoteStatus !== null && !result && (
        <div className="v3-shadow-card mt-3 rounded-[24px] bg-white p-6 text-center" data-testid="friend-fortune-quote-error" data-status={quoteStatus}>
          <p className="text-[15px] font-bold text-v3-navy">
            {quoteStatus === 404 ? "ไม่พบเพื่อนคนนี้ในรายชื่อของคุณ" : quoteStatus === 503 ? "ฟีเจอร์นี้ยังเปิดให้ใช้ไม่ได้ในตอนนี้" : "โหลดข้อมูลไม่สำเร็จ"}
          </p>
          <p className="mt-1 text-[12px] leading-[18px] text-v3-text-body">
            {quoteStatus === 404 ? "เพื่อนอาจถูกลบไปแล้ว หรือไม่ใช่เพื่อนในรายชื่อของคุณ" : "ยังไม่มีการหักชี ลองใหม่ได้"}
          </p>
          {quoteStatus === 404 ? (
            <Link href={FRIENDS_LIST_HREF} data-testid="friend-fortune-back-list"
              className="mt-4 grid h-11 place-items-center rounded-full bg-v3-sapphire text-sm font-bold text-v3-lime">กลับไปรายชื่อเพื่อน</Link>
          ) : (
            <button type="button" onClick={() => setAttempt((a) => a + 1)} data-testid="friend-fortune-retry"
              className="mt-4 grid h-11 w-full place-items-center rounded-full bg-v3-sapphire text-sm font-bold text-v3-lime">ลองใหม่</button>
          )}
        </div>
      )}

      {quote && !result && (
        <div className="mt-3 flex flex-col gap-3">
          {/* ตัวตนเพื่อน + ราคา + ปุ่มดู — ยังไม่มีการคำนวณ/หักชีจนกว่าจะกด */}
          <SectionCard testId="friend-fortune-gate">
            <div className="flex items-center gap-3">
              <span className="relative grid size-12 flex-none place-items-center overflow-hidden rounded-full bg-v3-sapphire text-[16px] font-bold text-white">
                {pic ? <Image src={pic} alt="" fill sizes="48px" style={{ objectFit: "cover" }} /> : <span>{friendInitial(friendForInitial)}</span>}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-bold leading-6 text-v3-navy" data-testid="friend-fortune-name">{quote.friend.name}</p>
                {quote.hasBirthTime === false && <p className="text-[12px] leading-[18px] text-v3-text-body">ไม่ทราบเวลาเกิด — จะไม่แสดงเสาชั่วโมง</p>}
              </div>
            </div>
            <p className="mt-4 text-[13px] leading-5 text-v3-text-body" data-testid="friend-fortune-price">{priceText(quote)}</p>
            <button type="button" onClick={onPrimary} disabled={!quote.canCompute || busy} data-testid="friend-fortune-read"
              className="mt-4 grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-[15px] font-bold text-v3-lime disabled:bg-v3-disabled-bg disabled:text-v3-text-muted">
              {busy ? "กำลังคำนวณดวง…" : quote.plan.basis === "qi" ? `ดูดวง · ${qiText(quote.plan.priceQi)} QI` : `ดูดวงของ${quote.friend.name}`}
            </button>
            {!quote.canCompute && (
              <p className="mt-2 text-[12px] leading-[18px] text-v3-text-muted" data-testid="friend-fortune-no-birth">
                วันเกิดของเพื่อนคนนี้ยังใช้คำนวณไม่ได้ — แก้ไขได้จากหน้าดูดวงคู่ <Link href={FRIENDS_COMPAT_HREF} className="font-bold text-v3-sapphire">ไปแก้ไข</Link>
              </p>
            )}
            <p className="mt-3 text-[11px] leading-4 text-v3-text-muted">ดวงคำนวณจากวันเกิดที่คุณบันทึกไว้ของเพื่อน · นอกสิทธิ์ฟรีจะหัก QI ทุกครั้งที่ดู</p>
          </SectionCard>

          {busy && (
            <div className="v3-shadow-card rounded-[24px] bg-white p-6 text-center" data-testid="friend-fortune-computing" role="status">
              <div className="mx-auto size-9 animate-spin rounded-full border-[3px] border-v3-sky-tint border-t-v3-sapphire" />
              <p className="mt-3 text-[14px] font-bold text-v3-navy">กำลังคำนวณดวงของ{quote.friend.name}…</p>
              <p className="mt-1 text-[12px] leading-[18px] text-v3-text-body">ใช้เวลาสักครู่ ชีจะถูกหักเมื่อดวงออกมาแล้วเท่านั้น</p>
            </div>
          )}

          {readError && !busy && (
            <div className="v3-shadow-card rounded-[24px] bg-white p-6 text-center" data-testid="friend-fortune-error">
              <p className="text-[15px] font-bold text-v3-navy">
                {readError.kind === "notFound" ? "ไม่พบเพื่อนคนนี้ในรายชื่อของคุณ" : readError.kind === "notReady" ? "ฟีเจอร์นี้ยังเปิดให้ใช้ไม่ได้ในตอนนี้" : "คำนวณดวงไม่สำเร็จ"}
              </p>
              <p className="mt-1 text-[12px] leading-[18px] text-v3-text-body">ยังไม่มีการหักชี — ลองใหม่ได้</p>
              {readError.kind !== "notFound" && (
                <button type="button" onClick={() => void read()} data-testid="friend-fortune-error-retry"
                  className="mt-4 grid h-11 w-full place-items-center rounded-full bg-v3-sapphire text-sm font-bold text-v3-lime">ลองใหม่</button>
              )}
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="mt-3 flex flex-col gap-3" data-testid="friend-fortune-result">
          <ResultHero result={result} />
          {result.charge && (
            <p className="text-center text-[12px] font-semibold text-v3-text-body" data-testid="friend-fortune-charge">{chargeText(result.charge, result.balance)}</p>
          )}
          {result.reading?.prediction?.personality && <Section title="บุคลิก" testId="friend-fortune-personality"><p className={PROSE}>{result.reading.prediction.personality}</p></Section>}
          {result.reading?.prediction?.habit && <Section title="นิสัย" testId="friend-fortune-habit"><p className={PROSE}>{result.reading.prediction.habit}</p></Section>}
          {result.reading?.prediction?.love && <Section title="ความรัก" testId="friend-fortune-love"><p className={PROSE}>{result.reading.prediction.love}</p></Section>}
          {Array.isArray(result.reading?.cautions) && result.reading.cautions.length > 0 && (
            <Section title="ข้อควรระวัง" testId="friend-fortune-cautions">
              <ul className="flex list-decimal flex-col gap-2 pl-5">
                {result.reading.cautions.map((c, i) => <li key={i} className={PROSE}>{c}</li>)}
              </ul>
            </Section>
          )}
          {result.reading?.deity && <Section title="เทพประจำตัว" testId="friend-fortune-deity"><p className={PROSE}>{result.reading.deity}</p></Section>}
          {result.reading?.luck?.year?.text && <Section title="จังหวะปีนี้" testId="friend-fortune-luck-year"><p className={PROSE}>{result.reading.luck.year.text}</p></Section>}
          {result.reading?.luck?.month?.text && <Section title="จังหวะเดือนนี้" testId="friend-fortune-luck-month"><p className={PROSE}>{result.reading.luck.month.text}</p></Section>}
          <p className="px-1 text-center text-[11px] leading-4 text-v3-text-muted">ดวงนี้คำนวณจากข้อมูลวันเกิดที่คุณกรอกไว้ ใช้เป็นแนวทางเท่านั้น</p>
        </div>
      )}

      {/* ชีตยืนยันราคา / ชีตชีไม่พอ — ผ่าน Portal เพราะจอนี้มีแถบเมนูล่าง (ดูหมายเหตุใน Portal.tsx) */}
      {quote && (
        <Portal>
          {confirming && (
            <ReadingConfirmSheet
              friendName={quote.friend.name}
              priceQi={quote.plan.priceQi}
              balance={quote.balance}
              busy={busy}
              onClose={() => setConfirming(false)}
              onConfirm={() => void read()}
            />
          )}
          {insufficient !== null && (
            <InsufficientQiSheet
              line={FRIEND_READING_LINE}
              balance={insufficient}
              onClose={() => setInsufficient(null)}
            />
          )}
        </Portal>
      )}
    </SkyScreen>
  )
}

/** ชีตยืนยันก่อนใช้ชี — หน้าตาเดียวกับ SpendConfirmSheet ของศูนย์ QI แต่ "ยืนยัน" ไม่หักชีเอง:
 *  มันส่งต่อไป POST /api/v2/friends/reading ซึ่งคำนวณก่อนแล้วค่อยหักในคำขอเดียว (ใช้ชีตเดิมไม่ได้เพราะเขายิง
 *  /api/qi-spend เองทันที = หักชีก่อนรู้ว่าดวงจะออกหรือไม่) */
function ReadingConfirmSheet({ friendName, priceQi, balance, busy, onClose, onConfirm }: {
  friendName: string
  priceQi: number
  balance: number | null
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const short = balance !== null ? Math.max(0, priceQi - balance) : 0
  const after = balance !== null ? Math.max(0, balance - priceQi) : null
  return (
    <SheetShell label="ยืนยันการใช้ QI" onClose={() => !busy && onClose()}>
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className="text-[18px] font-bold leading-7 text-v3-navy" data-testid="friend-fortune-confirm-title">ดูดวงของ{friendName}</h2>
        <p className="max-w-xs text-[13px] leading-5 text-v3-text-body">ดูดวงเพื่อนคนนี้ 1 ครั้ง ใช้ {qiText(priceQi)} QI</p>
      </div>
      <dl className="mt-4 flex flex-col gap-3 rounded-[16px] bg-v3-blush-tint px-4 py-4 text-[14px]" data-testid="friend-fortune-confirm-breakdown">
        <div className="flex items-center justify-between">
          <dt className="text-v3-text-body">ยอดปัจจุบัน</dt>
          <dd className="font-black text-v3-navy">{balance !== null ? `${qiText(balance)} QI` : "—"}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-v3-text-body">ค่าบริการครั้งนี้</dt>
          <dd className="font-black text-v3-qi-spend" data-testid="friend-fortune-confirm-price">−{qiText(priceQi)} QI</dd>
        </div>
        <div className="flex items-center justify-between border-t border-black/5 pt-3">
          <dt className="text-v3-text-body">ยอดหลังหัก</dt>
          <dd className="font-black text-v3-navy">{after !== null ? `${qiText(after)} QI` : "—"}</dd>
        </div>
      </dl>
      {short > 0 && <p className="mt-3 text-center text-[12px] font-bold text-v3-error" data-testid="friend-fortune-confirm-short">ชีไม่พอ — ขาดอีก {qiText(short)} QI</p>}
      <div className="mt-4 flex flex-col gap-2">
        <KitButton onClick={onConfirm} disabled={busy || short > 0} testId="friend-fortune-confirm">
          {busy ? "กำลังคำนวณ..." : `ยืนยัน ใช้ ${qiText(priceQi)} QI`}
        </KitButton>
        <KitButton variant="outline" onClick={onClose} testId="friend-fortune-confirm-cancel">ยกเลิก</KitButton>
      </div>
      <p className="mt-3 text-center text-[11px] leading-4 text-v3-text-muted">ระบบจะหัก QI เมื่อดวงคำนวณเสร็จแล้วเท่านั้น ถ้าคำนวณไม่สำเร็จจะไม่หักชี</p>
    </SheetShell>
  )
}

/** ชะตาของเพื่อน: อักษรแรกของชื่อ/รูป · ธาตุ + หยาง-หยิน · นักษัตรปีเกิด · เสา 4 ต้น (ไม่มีเสาชั่วโมงเมื่อไม่ทราบเวลา) */
function ResultHero({ result }: { result: FriendReadingResult }) {
  const pic = (result.friend.pictureUrl ?? "").trim()
  const el = result.pillars?.day?.stemElement || ""
  const power = result.chart?.summary?.power === "YIN" ? "หยิน" : result.chart?.summary?.power === "YANG" ? "หยาง" : ""
  const animal = ZODIAC_TABLE.find((z) => z.branch === result.chart?.yearOfZodiac?.below)?.th ?? ""
  const birthDate = formatThaiDateAbbr(result.birth.date)
  const pillars: Array<[string, FriendPillar | null]> = [
    ["ปี", result.pillars?.year ?? null],
    ["เดือน", result.pillars?.month ?? null],
    ["วัน", result.pillars?.day ?? null],
    ["ชั่วโมง", result.birth.hasBirthTime ? result.pillars?.hour ?? null : null],
  ]
  return (
    <div className="flex flex-col gap-3">
      <SectionCard testId="friend-fortune-hero">
        <div className="flex items-center gap-3">
          <span className="relative grid size-14 flex-none place-items-center overflow-hidden rounded-full bg-v3-sapphire text-[18px] font-bold text-white">
            {pic ? <Image src={pic} alt="" fill sizes="56px" style={{ objectFit: "cover" }} /> : <span>{friendInitial({ id: result.friend.id, name: result.friend.name })}</span>}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-black leading-6 text-v3-navy" data-testid="friend-fortune-result-name">{result.friend.name}</p>
            <p className="text-[12px] leading-[18px] text-v3-text-body">
              {birthDate}{result.birth.hasBirthTime ? "" : " · ไม่ทราบเวลาเกิด"}
            </p>
          </div>
        </div>
        {(el || animal) && (
          <div className="mt-3 flex flex-wrap gap-2" data-testid="friend-fortune-tags">
            {el && <span className="rounded-full bg-v3-sky-tint px-3 py-1 text-[12px] font-bold text-v3-sapphire">ธาตุ{el}{power ? ` ${power}` : ""}</span>}
            {animal && <span className="rounded-full bg-v3-sky-tint px-3 py-1 text-[12px] font-bold text-v3-sapphire">ปี{animal}</span>}
          </div>
        )}
      </SectionCard>

      <SectionCard className="!rounded-[18px]" testId="friend-fortune-pillars">
        <div className="grid grid-cols-4 gap-2 text-center">
          {pillars.map(([label, p]) => (
            <div key={label} className="flex flex-col items-center gap-1" data-testid={`friend-fortune-pillar-${label === "ปี" ? "year" : label === "เดือน" ? "month" : label === "วัน" ? "day" : "hour"}`}>
              <span className="text-[11px] font-semibold text-v3-text-muted">{label}</span>
              {p ? (
                <>
                  <span className="text-[22px] font-bold leading-7 text-v3-navy">{p.stem}{p.branch}</span>
                  <span className="text-[10px] leading-4 text-v3-text-body">{[p.stemElement, p.branchElement].filter(Boolean).join(" · ")}</span>
                </>
              ) : (
                <span className="text-[13px] leading-7 text-v3-text-muted">—</span>
              )}
            </div>
          ))}
        </div>
        {!result.birth.hasBirthTime && <p className="mt-2 text-[11px] leading-4 text-v3-text-muted">ไม่ทราบเวลาเกิด จึงไม่แสดงเสาชั่วโมง</p>}
      </SectionCard>
    </div>
  )
}

export default FriendFortuneScreen
