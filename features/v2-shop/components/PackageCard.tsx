// features/v2-shop/components/PackageCard.tsx — one plan card on "เลือกแพ็คเกจที่ใช่" (Figma 636:11973).
//
// 🔴 The card renders a PRICE IT WAS GIVEN — it never computes or hardcodes one (DoD). Even the
// "ตกเพียงวันละ X บาท" line is derived from that same amount, so there is exactly one number on this card
// and it came from the server.
//
// 🔴 A plan with no sellable package_code does NOT get a checkout link (#359 B2). It renders, it says why,
// and its button does not pretend. Wiring it would send the tap into UnsellablePackageError at
// lib/payment/catalog.ts:79-82 — a failure at the till, after the user believed they were buying.
//
// Deliberate differences from the Figma frame (all recorded in the PR's intended-difference list):
//   · button label uses the plan's own name (Mumate + / Mumate Pro), not PLUS / PRO   — ฟีม 2026-08-21
//   · no bonus box and no "(รวมคอร์สฟรี 499฿)" on the button — nobody delivers those yet (#359 Q2)
//   · no "ส่วนลดสินค้าในร้าน 10/20%" feature line — there is no shop system (grep = 0 hit) (#359 Q1)
//   · the legal note links Privacy only; "เงื่อนไขการให้บริการ" has no page in the repo (#359 ③)
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TextLink } from '@/components/ui/link'
import { ComingSoonAction } from '@/features/v2-shell/components/ComingSoon'
import { cn } from '@/lib/utils/cn'
import { formatThaiDateAbbr } from '@/lib/v2/thai-date'
import type { CardVerdict } from '../card-verdict'
import type { BillingPeriod, Plan } from '../packages'
import { checkoutHrefFor, codeFor } from '../packages'
import { formatThb, usePackagePrice } from '../usePackagePrice'

const BADGE_TONE = {
  pumpkin: 'bg-v3-pumpkin text-white',
  error: 'bg-v3-error text-white',
} as const

// 997:2773 — read via get_design_context: the mark is a 38px Sapphire→#9D85DA gradient disc with the TEXT
// "👑" (16px, white) inside. It is an emoji glyph in the frame, not artwork, so rendering the same glyph is
// the faithful reproduction — nothing is redrawn here.
function PlanMark() {
  return (
    <span
      aria-hidden
      data-testid="plan-mark"
      className="grid size-[38px] shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-r from-v3-sapphire to-[#9D85DA] text-base leading-none text-white"
    >
      👑
    </span>
  )
}

// 997:2644 — Pacific Cyan 20px disc (radius 10) holding the frame's 10×10 check export.
function CheckIcon() {
  return (
    <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-[10px] bg-v3-cyan">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/v2/shop/check-tick.svg" alt="" width={10} height={10} className="size-2.5" />
    </span>
  )
}

// 997:2634 / 997:2665 / 997:2709 — each card carries its own elevation in the frame; not one shared shadow.
const CARD_SHADOW: Record<string, string> = {
  free: 'shadow-[0_8px_12px_rgba(26,38,77,0.08)]',
  plus: 'shadow-[0_12px_30px_rgba(26,38,77,0.10)]',
  pro: 'shadow-[0_16px_40px_rgba(26,38,77,0.14)]',
}

/** "ตกเพียงวันละ 2.1 บาทเท่านั้น" — derived from the SERVER price, truncated to 1dp like the design
 *  (790/365 = 2.16 → 2.1 · 1590/365 = 4.35 → 4.3). Truncated, not rounded: a per-day figure that rounds UP
 *  would advertise a price higher than the arithmetic supports.
 *  Two spellings, both the frame's: Plus says "ตกเพียงวันละ" (997:2676), Pro says "ตกวันละ" (997:2725). */
function perDayText(amountThb: number, planId: string): string {
  const perDay = Math.floor((amountThb / 365) * 10) / 10
  const n = perDay.toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return planId === 'pro' ? `ตกวันละ ${n} บาทเท่านั้น` : `ตกเพียงวันละ ${n} บาทเท่านั้น`
}

// 🔴 THE CARD NOW HAS TWO INDEPENDENT AXES AND THEY MUST NOT BE COLLAPSED (#457):
//   price   — is this package for sale?      (usePackagePrice: ready | loading | error | unsellable)
//   verdict — may THIS viewer buy it?        (cardVerdictFor: buy | upgrade | current | blocked | unknown)
// A package can be perfectly on sale and still not be for THIS person, and a package this person could
// upgrade to can be off sale. Rendering one from the other is how a member gets invited into a refusal.
export function PackageCard({
  plan,
  period,
  verdict,
  className,
}: {
  plan: Plan
  period: BillingPeriod
  /** what this card may say to the current viewer — #457. `free-card` freezes the pre-#457 behaviour. */
  verdict: CardVerdict
  className?: string
}) {
  const code = codeFor(plan, period)
  const price = usePackagePrice(plan.id === 'free' ? null : code)
  // 🔴 "Can this be bought?" is a RUNTIME fact after #377: a package_code exists in this file, but whether
  // it is on sale lives in payment_package.is_active and is flipped from /ops without a deploy. So the link
  // needs BOTH — a declared code AND a server row that is actually ready. Deciding from the code alone
  // would send a tap into UnsellablePackageError('not on sale') at lib/payment/catalog.ts:74-76.
  const href = price.kind === 'ready' ? checkoutHrefFor(plan, period) : null
  // Two spellings on purpose, both taken from the frame: the price block sets the unit off from the amount
  // ("฿790 / ปี"), the button runs them together ("฿790/ปี"). One shared string would be wrong in one of
  // the two places, and the rendered-text audit is what caught it (the button read "฿790/ เดือน").
  const unitLabel = period === 'annual' ? 'ปี' : 'เดือน'
  const priceSuffix = `/ ${unitLabel}`
  const buttonSuffix = `/${unitLabel}`

  return (
    <section
      data-testid={`plan-card-${plan.id}`}
      className={cn('flex flex-col gap-5 rounded-3xl bg-white p-6', CARD_SHADOW[plan.id] ?? CARD_SHADOW.free, className)}
    >
      {/* 997:2635 / 2668 / 2771 — mark + name (20 on Free, 22 on the paid cards) · badge right · 13px tagline. */}
      <div className="flex flex-col gap-2">
        <header className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <PlanMark />
            <h2 className={cn('font-bold leading-normal text-v3-navy', plan.id === 'free' ? 'text-xl' : 'text-[22px]')}>{plan.name}</h2>
          </div>
          {plan.badge ? (
            <span
              data-testid={`plan-badge-${plan.id}`}
              className={cn('shrink-0 rounded-[30px] px-4 py-1.5 text-[11px] font-bold leading-normal', BADGE_TONE[plan.badge.tone])}
            >
              {plan.badge.label}
            </span>
          ) : null}
        </header>
        <p className="text-[13px] leading-normal text-v3-text-body">{plan.tagline}</p>
      </div>

      <hr className="border-0 border-t border-v3-border-warm" />

      {/* Price block — one number, and it came from the server. */}
      {/* 997:2639 / 2672 / 2718 — 32px bold amount; Free's unit 14 regular, the paid units 16 medium; the
          cyan 14 semibold line under it (Pro's carries "ประหยัด 2 เดือน •" when the annual tab is on). */}
      <div data-testid={`plan-price-${plan.id}`} className="flex min-h-[3.25rem] flex-col gap-0.5">
        {plan.id === 'free' ? (
          <p className="flex items-baseline gap-1 text-v3-navy">
            <span className="text-[32px] font-bold leading-normal">฿0</span>
            <span className="text-sm leading-normal">/ ตลอดชีพ (Lifetime)</span>
          </p>
        ) : price.kind === 'ready' ? (
          <>
            <p className="flex items-baseline gap-1 text-v3-navy">
              <span className="text-[32px] font-bold leading-normal">{formatThb(price.amountThb)}</span>
              <span className="text-base font-medium leading-normal">{priceSuffix}</span>
            </p>
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold leading-5 text-v3-cyan">
              {plan.id === 'pro' && period === 'annual' ? (
                <>
                  <span>ประหยัด 2 เดือน</span>
                  <span aria-hidden className="text-xs font-normal text-v3-text-body">•</span>
                </>
              ) : null}
              <span>{perDayText(price.amountThb, plan.id)}</span>
            </p>
          </>
        ) : price.kind === 'loading' ? (
          <p className="text-sm leading-5 text-v3-text-muted">กำลังโหลดราคา…</p>
        ) : price.kind === 'error' ? (
          // Our outage — say so. Do not let it read as "this plan costs nothing" or "you did something wrong".
          <p className="text-sm leading-5 text-v3-error">ตอนนี้เราดึงราคาไม่ได้ ลองใหม่อีกครั้งได้เลย</p>
        ) : (
          // unsellable | missing | offSale — the plan is real, this billing period is not for sale.
          <p className="text-sm leading-5 text-v3-text-body">
            {period === 'annual' ? 'ยังไม่เปิดขายแพ็กเกจนี้' : 'ยังไม่เปิดขายแบบรายเดือน'}
          </p>
        )}
      </div>

      <ul className="flex flex-col gap-3">
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-3 text-sm leading-5 text-v3-text-body">
            <CheckIcon />
            <span className="min-w-0 flex-1">{f}</span>
          </li>
        ))}
      </ul>

      <div>
        {plan.id === 'free' || verdict.kind === 'free-card' ? (
          // Free's button leaves the shop for the app — it must never reach checkout (DoD).
          <Link href="/v2" data-testid="plan-cta-free" className="block rounded-full">
            <Button variant="primary" size="full" tabIndex={-1}>
              เริ่มใช้ฟรี
            </Button>
          </Link>
        ) : verdict.kind === 'undetermined' ? (
          // 🔴 DoD ④ — we do not know this viewer's level, so we render NEITHER branch: no buy button
          // (which would tell a member to re-buy what they hold) and no "แพ็กปัจจุบัน" (which would claim
          // knowledge we do not have). The two reasons get two sentences — a failed lookup that says
          // "กำลังตรวจสอบ…" forever is our outage wearing the costume of the user's patience.
          <p
            data-testid={`plan-cta-pending-${plan.id}`}
            className={cn(
              'grid min-h-14 w-full place-items-center rounded-full border border-dashed px-4 text-center text-sm font-semibold leading-5',
              verdict.because === 'loading'
                ? 'border-v3-border-warm text-v3-text-muted'
                : 'border-v3-error text-v3-error',
            )}
          >
            {verdict.because === 'loading'
              ? 'กำลังตรวจสอบสถานะสมาชิกของคุณ…'
              : 'ตอนนี้เราตรวจสอบสถานะสมาชิกของคุณไม่ได้ · ลองโหลดหน้านี้ใหม่อีกครั้ง'}
          </p>
        ) : verdict.kind === 'current' ? (
          // They already hold this level. Not a disabled button: there is nothing to press, so we render no
          // control at all rather than a dead one (PackageCard's own rule below — a locked CONTROL must
          // still answer; the honest fix here is not to offer a control).
          <p
            data-testid={`plan-status-${plan.id}`}
            className="grid min-h-14 w-full place-items-center rounded-full bg-v3-sapphire/10 px-4 text-center text-base font-bold leading-6 text-v3-sapphire"
          >
            {verdict.expireAt && formatThaiDateAbbr(verdict.expireAt)
              ? `แพ็กเกจปัจจุบันของคุณ · ใช้ได้ถึง ${formatThaiDateAbbr(verdict.expireAt)}`
              : 'แพ็กเกจปัจจุบันของคุณ'}
          </p>
        ) : verdict.kind === 'blocked' ? (
          // They hold something ABOVE this. Selling it would take time and level away from them
          // (purchase-gate.ts CANNOT_DOWNGRADE). Name the situation, never the fix.
          <p
            data-testid={`plan-status-${plan.id}`}
            className="grid min-h-14 w-full place-items-center rounded-full bg-v3-bg-cream px-4 text-center text-sm font-semibold leading-5 text-v3-text-body"
          >
            คุณเป็นสมาชิกระดับสูงกว่านี้อยู่แล้ว
          </p>
        ) : href !== null ? (
          <Link href={href} data-testid={`plan-cta-${plan.id}`} className="block rounded-full">
            {/* 🔴 normal-case overrides Button's uppercase (button.tsx:131) for THIS label only.
                ฟีมเคาะ 2026-08-21 ว่าปุ่มต้องเขียน `Mumate +` / `Mumate Pro` ❌ ไม่ใช่ `PLUS` / `PRO`
                — แต่ปุ่ม primary บังคับ uppercase ⇒ พิกเซลออกมาเป็น `MUMATE +` ซึ่งย้อนกลับไปใกล้สิ่งที่
                คำตัดสินนั้นสั่งไม่ให้ใช้ · textContent เขียว (มันเก็บ `Mumate +` ไว้ครบ) — จับได้จากภาพ
                ที่ render จริงเท่านั้น ตระกูลเดียวกับ "ข้อความถูก แต่ตัดบรรทัดผิด" ของ #326 */}
            <Button variant="primary" size="full" tabIndex={-1} className="normal-case">
              {/* 🔴 Only a verdict of `upgrade` may say อัปเกรด. A legacy member is `buy` with days to
                  carry — calling THAT an upgrade would claim we know they rank below this package, and we
                  do not know what they hold at all.
                  ⚠️ Since #358 Phase 1 they DO have a level name on screen ('PRO', lib/v2/subscription.ts:26).
                  What they have no PROVABLE level for is the gate, which is handed `tier: null` for them on
                  purpose (features/v2-shop/card-verdict.ts:111) so purchase-gate's legacy branch allows the
                  buy. Guard: scripts/shop-screen-mount.test.tsx '#457 row 5' asserts no 'อัปเกรดเป็น'. */}
              {/* #581 — the price+unit sits in its own nowrap span. This is NOT the \u00A0 treatment used on
                  the bullets (packages.ts): the break here lands on the '/' inside '\u0e3f790/\u0e1b\u0e35', and '/' is a
                  break opportunity in its own right, so no space character can prevent it. Measured at 360:
                  the button read '\u0e2a\u0e21\u0e31\u0e04\u0e23\u0e41\u0e1e\u0e47\u0e01\u0e40\u0e01\u0e08 Mumate + \u0e3f790/' with '\u0e1b\u0e35' alone on the next line —
                  mojisejr/mootech-fe#517's original symptom, still live on the buy button.
                  ⚠️ textContent is UNCHANGED by this split: the space before the price is emitted only when a
                  price exists, which is exactly what the old `.trim()` achieved.
                  🔴 The OUTER span is not decoration. Button is `inline-flex … gap-1`
                  (components/ui/Button.tsx:130), so two sibling children become two flex items with a gap
                  between them — measured at 360, that rendered the label as a two-column button reading
                  'สมัครแพ็กเกจ Mumate' / '+' beside a floating '฿790/ปี'. Wrapping both in one span keeps the
                  whole label a single flex item, so it flows as ordinary text again. */}
              <span>
                {`${verdict.kind === 'upgrade' ? 'อัปเกรดเป็น' : 'สมัครแพ็กเกจ'} ${plan.name}`}
                {price.kind === 'ready' ? (
                  <>{' '}<span className="whitespace-nowrap">{`${formatThb(price.amountThb)}${buttonSuffix}`}</span></>
                ) : null}
              </span>
            </Button>
          </Link>
        ) : (
          // No sellable code ⇒ the button must not promise a purchase it cannot complete (#359 B2).
          // 🔴 NOT `disabled`: this repo decided a locked control still answers
          // (YamTimes.tsx:100-101 "ปุ่มต้องกดได้และตอบ"), and React drops clicks on a disabled element
          // before any handler runs — so a disabled button is also untestable from the DOM. ComingSoonAction
          // is the mechanism already built for exactly this state.
          <ComingSoonAction
            testId={`plan-cta-${plan.id}`}
            label={`${plan.name} ยังไม่เปิดขาย`}
            message={`${plan.name} ยังไม่เปิดขายตอนนี้ · เราจะแจ้งทันทีที่เปิด`}
            className="grid h-14 w-full place-items-center rounded-full border border-v3-sapphire px-4 text-base font-bold leading-6 text-v3-sapphire"
          >
            {`${plan.name} · ยังไม่เปิดขาย`}
          </ComingSoonAction>
        )}
      </div>

      {/* 🔴 DoD ③ — the fear this line removes is specific: a member who thinks upgrading forfeits the time
          they already paid for will not upgrade. It appears ONLY when days actually follow them, so it can
          never become a decoration that is true on every card. */}
      {verdict.kind === 'upgrade' || (verdict.kind === 'buy' && verdict.carriesDays) ? (
        <p data-testid={`plan-carry-note-${plan.id}`} className="text-center text-sm font-semibold leading-5 text-v3-cyan">
          วันที่เหลือของแพ็กเกจปัจจุบันจะถูกบวกให้ ไม่หายไป
        </p>
      ) : null}

      {/* 🔴 The payment terms belong to a PAYMENT. Found by looking at the rendered page, not by any
          assertion: a PRO member's Mumate + card said "คุณเป็นสมาชิกระดับสูงกว่านี้อยู่แล้ว" and then, one
          line below, "เมื่อชำระเงินเรียบร้อยแล้ว ถือว่ายอมรับ…" — terms for a purchase the same card had
          just refused to offer. Same family as the card's other rule: never say words that imply an action
          this card does not have. */}
      {plan.id !== 'free' && (verdict.kind === 'buy' || verdict.kind === 'upgrade') ? (
        // 997:2844 — Body/Caption 9px, 16 line-height, Text/Secondary, centred.
        <p data-testid={`plan-legal-${plan.id}`} className="text-center text-[9px] leading-4 text-v3-text-body">
          เมื่อชำระเงินเรียบร้อยแล้ว ถือว่ายอมรับ{' '}
          <TextLink type="legal" size="small" href="/privacy/policy">
            นโยบายความเป็นส่วนตัว
          </TextLink>{' '}
          ของบริษัท
        </p>
      ) : null}
    </section>
  )
}
