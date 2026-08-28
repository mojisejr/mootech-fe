// features/v2-account/payment-history.ts — PURE. What "ประวัติการซื้อ" is allowed to show (#365).
//
// GET /api/v2/payment/status returns EVERY v2_payment row for the caller, in all three states the schema
// allows (lib/db/0007_v2_payment.sql:42 — 'PENDING' | 'APPROVED' | 'REJECT'), newest first.
//
// 🔴 THE CARD IS CALLED "ประวัติการซื้อ", SO ONLY A PURCHASE BELONGS IN IT (ฟีม 2026-08-26):
//   REJECT   money did NOT move. Listing it under "ซื้อ" tells someone they bought a thing they do not have.
//   PENDING  a QR the user closed sits in this state forever — there is no writer that ever expires it.
//            It would read as "something you still owe", permanently, for a purchase that never happened.
// This is an INTENDED difference, not a forgotten filter. If we ever need to show a failed attempt, that is
// a support surface with its own words ("รายการที่ไม่สำเร็จ"), not a line item inside a purchase list.
import { formatThaiDateAbbr } from '@/lib/v2/thai-date'
import { bkkDateStr } from '@/lib/usage-core'
import { formatSatang } from '@/features/v2-shop/usePackagePrice'

/** The wire shape from /api/v2/payment/status (pages/api/v2/payment/status.ts:17-25). */
export type PaymentRow = {
  packageCode: string
  tierCode: string
  amountSatang: number
  status: string
  createdAt: string // ISO 8601
}

/**
 * PURE and TOTAL: an ISO instant → the civil 'YYYY-MM-DD' in Asia/Bangkok → the Thai display string.
 * Unparseable input returns '' — the same contract formatThaiDateAbbr already has for junk.
 *
 * 🔴 WHY THE NaN GUARD EXISTS (ตู๋ R2-bonus, review of 2aac026): `bkkDateStr(new Date(junk))` THROWS
 * RangeError from Intl.DateTimeFormat.format. The version this replaced returned '' instead. It cannot
 * happen through the real API (status.ts:23 always sends `.toISOString()`), but toHistoryItems is reached
 * from historyState(), which this screen calls in its RENDER BODY — so a throw here takes down the whole
 * page, not just the card. That directly contradicts the promise this PR makes out loud: การ์ดล้ม จอไม่ล้ม.
 * A total function is cheaper than remembering where it is safe to be partial.
 */
export function bkkCivilDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return formatThaiDateAbbr(bkkDateStr(d))
}

export type HistoryItem = {
  key: string
  /** 'Mumate Pro · รายปี' — the plan as the user bought it. */
  title: string
  /** '14 ก.ค. 2569' */
  dateText: string
  /** '฿1,290' */
  amountText: string
}

/** package_code → the words the shop screen used when it sold it. Unknown code ⇒ fall back to the tier so a
 *  new catalogue row shows SOMETHING truthful instead of an empty line (never a guessed price or period). */
const PERIOD_WORD: Record<string, string> = { MONTHLY: 'รายเดือน', ANNUAL: 'รายปี', YEARLY: 'รายปี' }
const TIER_WORD: Record<string, string> = { PLUS: 'Mumate +', PRO: 'Mumate Pro', FREE: 'Mumate Free' }

function titleFor(row: PaymentRow): string {
  const tier = TIER_WORD[row.tierCode] ?? row.tierCode
  // package_code looks like 'PRO_ANNUAL' / 'PLUS_MONTHLY'; take the tail as the period when we know it.
  const tail = row.packageCode.split('_').pop() ?? ''
  const period = PERIOD_WORD[tail.toUpperCase()]
  return period ? `${tier} · ${period}` : tier
}

/**
 * Rows → what the card renders. Filters to APPROVED, keeps the server's newest-first order (❌ does not
 * re-sort: the server ordered by created_at DESC and a second ordering rule here would be a second copy).
 */
export function toHistoryItems(rows: PaymentRow[]): HistoryItem[] {
  return rows
    .filter((r) => r.status === 'APPROVED')
    .map((r, i) => ({
      key: `${r.createdAt}-${i}`,
      title: titleFor(r),
      // 🔴 #365 (ตู๋, review of 8cbe56b) — `createdAt` is an INSTANT, not a civil date: v2_payment.created_at
      // is `timestamptz` and status.ts hands it over as `.toISOString()`, which is always UTC. Slicing the
      // first 10 characters therefore read the UTC CALENDAR, so anyone who bought between 00:00 and 06:59
      // Thai time — 7 of every 24 hours — saw their purchase dated a day early, and across a month boundary
      // it moved the month too. Convert to the Bangkok civil date first, through the repo's ONE copy of that
      // rule (lib/usage-core.ts:63; lib/payment/repo.ts:350 writes member_payment.create_at the same way).
      dateText: bkkCivilDate(r.createdAt),
      amountText: formatSatang(r.amountSatang),
    }))
}


/** What the history card is showing. `error` exists so "โหลดไม่ได้" can never render as "ยังไม่มีรายการ" —
 *  a member who HAS bought something must not be told they never did, on the screen they opened to check.
 *  (AccountScreen said this in a comment and then collapsed all three into `[]`; ตู๋ caught it at 8cbe56b.) */
export type HistoryState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'empty' }
  | { kind: 'items'; items: HistoryItem[] }

/**
 * PURE. rows === null means "the fetch has not produced rows" — which is loading OR failed, and those two
 * are NOT the same answer, so `errored` is a separate input rather than something inferred from null.
 * 🔴 An APPROVED-less list is `empty`, not `error`: the request worked, the person simply has not bought.
 */
export function historyState(args: { done: boolean; errored: boolean; rows: PaymentRow[] | null }): HistoryState {
  if (args.errored) return { kind: 'error' }
  if (!args.done || args.rows === null) return { kind: 'loading' }
  const items = toHistoryItems(args.rows)
  return items.length === 0 ? { kind: 'empty' } : { kind: 'items', items }
}
