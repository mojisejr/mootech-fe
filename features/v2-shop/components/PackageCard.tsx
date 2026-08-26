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

// 🔴 DRAWN HERE, not exported from Figma. The design puts a gradient disc + crown beside every plan name,
// but `public/images/v2/` has no such asset and node 636:11973's children are flattened, so there is
// nothing to download. This is a stand-in with the right shape and the right tokens — NOT the artwork.
// Asked in #359; swap it for the real export the moment design delivers one.
function PlanMark() {
  return (
    <span
      aria-hidden
      data-testid="plan-mark-placeholder"
      className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-v3-sapphire to-[#9D85DA]"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none">
        <path d="M4 17.5 3 7l5 4 4-6 4 6 5-4-1 10.5H4Z" fill="#E1FF00" />
      </svg>
    </span>
  )
}

function CheckIcon() {
  return (
    <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-v3-sapphire">
      <svg viewBox="0 0 20 20" className="size-3" fill="none">
        <path d="M5 10.5 8.5 14 15 6.5" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

/** "ตกเพียงวันละ 2.1 บาทเท่านั้น" — derived from the SERVER price, truncated to 1dp like the design
 *  (790/365 = 2.16 → 2.1 · 1590/365 = 4.35 → 4.3). Truncated, not rounded: a per-day figure that rounds UP
 *  would advertise a price higher than the arithmetic supports. */
function perDayText(amountThb: number): string {
  const perDay = Math.floor((amountThb / 365) * 10) / 10
  return `ตกเพียงวันละ ${perDay.toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} บาทเท่านั้น`
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
      className={cn('rounded-3xl bg-white px-6 py-6 shadow-[0_4px_16px_rgba(11,48,91,0.06)]', className)}
    >
      <header className="flex items-start gap-3">
        <PlanMark />
        <h2 className="flex-1 pt-1 text-xl font-bold leading-7 text-v3-navy">{plan.name}</h2>
        {plan.badge ? (
          <span
            data-testid={`plan-badge-${plan.id}`}
            className={cn('shrink-0 rounded-full px-3 py-1 text-xs font-semibold leading-5', BADGE_TONE[plan.badge.tone])}
          >
            {plan.badge.label}
          </span>
        ) : null}
      </header>

      <p className="mt-2 text-sm leading-5 text-v3-text-body">{plan.tagline}</p>

      <hr className="my-5 border-0 border-t border-v3-border-warm" />

      {/* Price block — one number, and it came from the server. */}
      <div data-testid={`plan-price-${plan.id}`} className="min-h-[3.25rem]">
        {plan.id === 'free' ? (
          <p className="flex items-baseline gap-1">
            <span className="text-3xl font-bold leading-9 text-v3-navy">฿0</span>
            <span className="text-sm leading-5 text-v3-text-body">/ ตลอดชีพ (Lifetime)</span>
          </p>
        ) : price.kind === 'ready' ? (
          <>
            <p className="flex items-baseline gap-1">
              <span className="text-3xl font-bold leading-9 text-v3-navy">{formatThb(price.amountThb)}</span>
              <span className="text-sm leading-5 text-v3-text-body">{priceSuffix}</span>
            </p>
            <p className="mt-1 text-sm font-semibold leading-5 text-v3-cyan">{perDayText(price.amountThb)}</p>
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

      <ul className="mt-5 flex flex-col gap-3">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-sm leading-5 text-v3-text-body">
            <CheckIcon />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
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
              : 'ตอนนี้เราตรวจสอบสถานะสมาชิกไม่ได้ ลองใหม่อีกครั้งได้เลย'}
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
              {/* 🔴 Only a verdict of `upgrade` may say อัปเกรด. A legacy member (paid, no level name) is
                  `buy` with days to carry — calling THAT an upgrade would claim we know they rank below
                  this package, and we do not know what they hold at all. */}
              {`${verdict.kind === 'upgrade' ? 'อัปเกรดเป็น' : 'สมัครแพ็กเกจ'} ${plan.name} ${
                price.kind === 'ready' ? `${formatThb(price.amountThb)}${buttonSuffix}` : ''
              }`.trim()}
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
        <p data-testid={`plan-carry-note-${plan.id}`} className="mt-3 text-center text-sm font-semibold leading-5 text-v3-cyan">
          วันที่เหลือของแพ็กเกจปัจจุบันจะถูกบวกให้ ไม่หายไป
        </p>
      ) : null}

      {/* 🔴 The payment terms belong to a PAYMENT. Found by looking at the rendered page, not by any
          assertion: a PRO member's Mumate + card said "คุณเป็นสมาชิกระดับสูงกว่านี้อยู่แล้ว" and then, one
          line below, "เมื่อชำระเงินเรียบร้อยแล้ว ถือว่ายอมรับ…" — terms for a purchase the same card had
          just refused to offer. Same family as the card's other rule: never say words that imply an action
          this card does not have. */}
      {plan.id !== 'free' && (verdict.kind === 'buy' || verdict.kind === 'upgrade') ? (
        <p data-testid={`plan-legal-${plan.id}`} className="mt-3 text-center text-xs leading-[18px] text-v3-text-muted">
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
