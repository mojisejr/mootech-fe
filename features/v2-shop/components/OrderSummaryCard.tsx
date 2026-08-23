// features/v2-shop/components/OrderSummaryCard.tsx — the money the user is about to pay (mootech-fe#363).
// Figma 55159:5316 (Order Summary Card) via get_design_context.
//
// 🔴 EVERY NUMBER HERE COMES FROM THE SERVER'S QUOTE. The component receives the /api/v2/payment/preview
// response and prints it. It does not add, subtract, or derive — the only arithmetic anywhere on this screen
// is `formatSatang`'s single `/100` (see usePackagePrice.ts), because the lane speaks satang and people speak
// baht. A summary that can compute is a summary that can disagree with the charge, and the user finds out
// after the card is debited.
//
// ── THREE DELIBERATE DEPARTURES FROM THE FRAME, all recorded in the PR ────────────────────────────────
// ① "ต่ออายุอัตโนมัติ 14 ก.ค. 2570" → "ใช้ได้ถึง 14 ก.ค. 2570". Round one has no auto-renewal (ฟีม
//    2026-08-13). Writing that we will renew and then not renewing is a lie however faint, so the WORDS
//    change — the row is not merely hidden.
// ② "ยอดชำระวันนี้" → "ยอดชำระ". "วันนี้" promises a next instalment (ตู๋ #363 ⑤). Note it passes any
//    forbidden-word list — nothing in it is on one — which is exactly why the rule is per-LINE ("does this
//    line make the reader expect to be charged again?") and not per-word.
// ③ 🔴 THE "ส่วนลดรายปี (2 เดือน) −฿798" ROW IS NOT RENDERED — because nothing can produce it.
//    /payment/preview has no such field (listSatang IS the annual price), and the client cannot derive it:
//    lib/db/0009_package_tier.sql:99-100 prices V2_*_MONTHLY at 0, so monthly×12 = 0, not ฿2,388. The row
//    would have to be invented, and inventing money on a payment screen is the one thing this file may not
//    do. That is also the ROOT of the frame's arithmetic not adding up (1,590 − 798 ≠ 1,590): the frame drew
//    a line that never had a source. บอง confirmed and chose this (2026-08-23).
//    ⏭ FORWARD-COMPATIBLE ON PURPOSE: pass `annualSavingSatang` and the row appears, with zero edits here.
import { formatSatang } from '../usePackagePrice'
import { DiscountCodeField, type DiscountState } from './DiscountCodeField'

/** The /api/v2/payment/preview response, verbatim. `annualSavingSatang` is not in it today — see ③. */
export type Quote = {
  listSatang: number
  discountSatang: number
  amountSatang: number
  vatSatang: number
  vatPercent: number
  codeApplied: string | null
  /** Not sent today. When the money lane learns the annual saving, this row lights up on its own. */
  annualSavingSatang?: number
}

export type OrderSummaryCardProps = {
  planName: string
  /** Already-formatted Thai date the plan runs to. The screen does not do calendar maths either. */
  validUntilText: string
  quote: Quote
  onChangePlan: () => void
  discount: {
    state: DiscountState
    value: string
    onChange: (v: string) => void
    onApply: () => void
    onClear: () => void
    errorText?: string
    busy?: boolean
  }
}

function Row({ label, value, testId, valueClass = 'text-v3-navy' }: { label: string; value: string; testId: string; valueClass?: string }) {
  return (
    <div className="flex w-full items-start justify-between text-sm">
      <p className="leading-[22px] text-v3-text-body">{label}</p>
      <p data-testid={testId} className={`font-bold leading-5 ${valueClass}`}>{value}</p>
    </div>
  )
}

export function OrderSummaryCard({ planName, validUntilText, quote, onChangePlan, discount }: OrderSummaryCardProps) {
  const hasCode = quote.codeApplied !== null && quote.discountSatang > 0
  // VAT 0 hides the WHOLE row (ticket ④) — "VAT 0% ฿0" is a line that makes a reader stop and wonder.
  const showVat = quote.vatPercent > 0

  return (
    <section data-testid="order-summary" className="flex w-full flex-col gap-4 rounded-[20px] bg-white p-5 font-ibm drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]">
      <div className="flex w-full items-center justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p data-testid="summary-plan" className="text-lg font-bold leading-6 text-v3-navy">{planName}</p>
          {/* ① — see the header note. */}
          <p data-testid="summary-valid-until" className="text-sm leading-[22px] text-v3-text-body">ใช้ได้ถึง {validUntilText}</p>
        </div>
        <button type="button" data-testid="summary-change" onClick={onChangePlan} className="shrink-0 text-sm font-bold leading-5 text-v3-cyan">
          เปลี่ยน
        </button>
      </div>

      <hr className="w-full border-t border-v3-border-card" />

      <div className="flex w-full flex-col gap-3">
        <Row testId="summary-list" label="ราคา" value={formatSatang(quote.listSatang)} />

        {/* ③ — renders only if the lane ever sends it. Absent today, by design, with a reason. */}
        {quote.annualSavingSatang !== undefined && quote.annualSavingSatang > 0 && (
          <Row
            testId="summary-annual-saving"
            label="ส่วนลดรายปี"
            value={`−${formatSatang(quote.annualSavingSatang)}`}
            valueClass="text-v3-success-text"
          />
        )}

        <hr className="w-full border-t border-v3-border-card" />

        <DiscountCodeField
          state={discount.state}
          value={discount.value}
          onChange={discount.onChange}
          onApply={discount.onApply}
          onClear={discount.onClear}
          savedText={hasCode ? formatSatang(quote.discountSatang) : undefined}
          errorText={discount.errorText}
          busy={discount.busy}
        />

        {/* The ticket's 6③: Success shows the chip AND a summary line — not one or the other. They answer
            different questions ("which code is on?" vs "what did it take off the total?"). */}
        {hasCode && (
          <Row
            testId="summary-code-discount"
            label={`ส่วนลดโค้ด ${quote.codeApplied}`}
            value={`−${formatSatang(quote.discountSatang)}`}
            valueClass="text-v3-success-text"
          />
        )}

        {showVat && (
          <Row testId="summary-vat" label={`VAT ${quote.vatPercent}% (รวมแล้ว)`} value={formatSatang(quote.vatSatang)} />
        )}
      </div>

      <hr className="w-full border-t border-v3-border-card" />

      <div className="flex w-full items-center justify-between">
        {/* ② — see the header note. */}
        <p className="text-base font-bold leading-6 text-v3-navy">ยอดชำระ</p>
        <p data-testid="summary-total" className="text-2xl font-bold leading-8 text-v3-sapphire">{formatSatang(quote.amountSatang)}</p>
      </div>
    </section>
  )
}

export default OrderSummaryCard
