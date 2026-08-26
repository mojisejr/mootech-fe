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
import { formatSatang } from '@/features/v2-shop/usePackagePrice'

/** The wire shape from /api/v2/payment/status (pages/api/v2/payment/status.ts:17-25). */
export type PaymentRow = {
  packageCode: string
  tierCode: string
  amountSatang: number
  status: string
  createdAt: string // ISO 8601
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
      dateText: formatThaiDateAbbr(r.createdAt.slice(0, 10)),
      amountText: formatSatang(r.amountSatang),
    }))
}
