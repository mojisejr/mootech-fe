// features/v2-shop/components/CardForm.tsx — the card fields (mootech-fe#363, then mootech-fe#491),
// Figma 55159:5363.
//
// Order and wording come from the frame and are NOT the ones the ticket previously assumed:
//   ชื่อบนบัตร → หมายเลขบัตร → วันหมดอายุ + CVC     (and it says CVC, never CVV)
// The auto-renewal checkbox below is the frame's (55159:5541) with the tick REMOVED and the control inert:
// round one has no auto-renewal, so a checkbox the user can turn on would promise something we will not do.
//
// #491 changed three things and left everything else alone:
//
// 🔴 GARBAGE IS REFUSED AT THE KEYSTROKE, not typed and then flagged. Feem's words were "กรอกมั่วไม่ได้".
//    A field that swallows a letter and then reddens has already let the buyer believe the number on
//    screen is the number they entered.
//
// 🔴 PASTE IS NEVER BLOCKED. Every value goes through the same formatter, so a number arriving whole
//    from a password manager with dashes or spaces is normalised rather than refused. Refusing it would
//    stop those buyers paying at all — worse than the typo it would prevent.
//
// 🔴 THE VALIDITY ANSWER IS NOT ASSEMBLED HERE. card-rules owns "which field is wrong" and `ok` is
//    derived from `fields` inside it. This file renders that answer and writes the words a buyer reads.
//    Asking twice is how two answers drift apart.
//
// The type is imported and re-exported rather than redeclared: pages/v2/shop/checkout.tsx imports
// CardState from here while scripts/card-rules.test.ts imports it from card-rules, and two structurally
// identical declarations agree only until one of them changes — at which point nothing reports it.
import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { Field } from '@/components/ui/input'
import {
  cvcLengthFor,
  detectBrand,
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  type CardField,
  type CardReason,
  type CardState,
  type CardValidation,
} from '../card-rules'
import { CardBrandMark } from './CardBrandMark'

export type { CardState }

const LABEL = 'text-sm font-medium leading-5 text-v3-text-body-alt'

export const RENEWAL_LABEL = 'บันทึกบัตรนี้ไว้สำหรับการต่ออายุอัตโนมัติ'

// CardReason is a machine token by design (#447) so a rule can change without silently rewording the
// screen, and copy can change without touching a rule. These are the words; they live only here.
const SAYS: Record<CardReason, string> = {
  empty: 'ยังไม่ได้กรอกช่องนี้',
  number_too_short: 'เลขบัตรยังไม่ครบ',
  number_length: 'จำนวนหลักไม่ตรงกับบัตรยี่ห้อนี้',
  number_luhn: 'เลขบัตรไม่ถูกต้อง ลองตรวจอีกครั้ง',
  expiry_format: 'กรอกเป็นเดือนและปี เช่น 04/2027',
  expiry_month: 'เดือนต้องอยู่ระหว่าง 01 ถึง 12',
  expiry_past: 'บัตรนี้หมดอายุแล้ว',
  // Deliberately short and brand-specific. The long form wrapped mid-phrase in the half-width CVC
  // column — a correct string that breaks in the wrong place, which textContent assertions cannot see.
  cvc_length: 'CVC ต้องมี N หลัก',
}

// The name is the one field with no rule beyond presence, so it keeps a plain filter: anything that is
// not a digit. Blocking digits stops the commonest paste-into-the-wrong-box mistake without inventing a
// rule about what a person may be called.
const clean = {
  name: (v: string) => v.replace(/[0-9]/g, ''),
  number: (v: string) => formatCardNumber(v),
  expiry: (v: string) => formatExpiry(digitsOnly(v)),
  cvc: (v: string) => digitsOnly(v),
} satisfies Record<CardField, (v: string) => string>

export function CardForm({
  value,
  onChange,
  validation,
}: {
  value: CardState
  onChange: (v: CardState) => void
  /**
   * 🔴 COMPUTED BY THE CALLER, AND THERE IS NO `now` PROP ON PURPOSE (mootech-fe#492, lamun's call).
   *
   * The previous shape took `now?: Date` defaulting to `new Date()`, with a comment one line below
   * reading "Never read from a clock here." checkout.tsx never passed it, so this form read its own
   * clock every render — in the file whose own comment forbade it, written the same day.
   *
   * A default that quietly hands out a clock IS the mechanism that allows a second one. So the fix is
   * the type, not the warning: this form has no clock because it has no clock PARAMETER. Today proved a
   * warning does not stop the person who wrote it, in their own file, hours later.
   *
   * `validateCard` therefore has exactly one call site (checkout.tsx), which removes — rather than
   * reduces — the case where someone adds a rule in one place and not the other.
   */
  validation: CardValidation
}) {
  // Errors appear when the buyer LEAVES a field, not while they are still filling it in. Marking a
  // half-typed number as wrong is technically true and useless.
  const [touched, setTouched] = useState<Partial<Record<CardField, boolean>>>({})

  // detectBrand STAYS here. It is pure and clock-free, so it cannot bring back the second clock that
  // removing `now` was about — and the form needs the brand for three things that are not validation:
  // the CVC keystroke cap, the digit count inside the CVC message, and the brand mark (lamun, #492).
  const brand = detectBrand(value.number)
  const reasonFor = (f: CardField) => (touched[f] ? validation.fields[f] : null)

  const set = (k: CardField) => (e: { target: { value: string } }) => {
    const raw = e.target.value
    const next =
      k === 'cvc'
        ? digitsOnly(raw).slice(0, cvcLengthFor(brand))
        : k === 'number'
          ? clean.number(raw)
          : k === 'expiry'
            ? clean.expiry(raw)
            : clean.name(raw)
    onChange({ ...value, [k]: next })
  }

  const blur = (k: CardField) => () => setTouched((t) => ({ ...t, [k]: true }))

  const field = (k: CardField) => {
    const reason = reasonFor(k)
    // The CVC length is the brand's, so the sentence carries the number rather than describing it.
    const words = reason ? SAYS[reason].replace('N', String(cvcLengthFor(brand))) : undefined
    return { error: reason != null, helper: words, onBlur: blur(k) }
  }

  return (
    <div data-testid="card-form" className="flex w-full flex-col gap-4">
      <Field
        label="ชื่อบนบัตร"
        data-testid="card-name"
        value={value.name}
        onChange={set('name')}
        placeholder="David Watson"
        autoComplete="cc-name"
        {...field('name')}
      />
      <Field
        label="หมายเลขบัตร"
        data-testid="card-number"
        value={value.number}
        onChange={set('number')}
        placeholder="4645 7534 5454 1345"
        inputMode="numeric"
        autoComplete="cc-number"
        trailingIcon={<CardBrandMark brand={brand} />}
        {...field('number')}
      />
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <Field
            label="วันหมดอายุ"
            data-testid="card-expiry"
            value={value.expiry}
            onChange={set('expiry')}
            placeholder="04/2026"
            inputMode="numeric"
            autoComplete="cc-exp"
            {...field('expiry')}
          />
        </div>
        <div className="min-w-0 flex-1">
          {/* the frame says CVC. */}
          <Field
            label="CVC"
            data-testid="card-cvc"
            value={value.cvc}
            onChange={set('cvc')}
            placeholder="457"
            inputMode="numeric"
            autoComplete="cc-csc"
            {...field('cvc')}
          />
        </div>
      </div>

      {/* 🔴 Present, faded, unticked and INERT — see the header. `disabled` also keeps it out of the tab order,
          so it cannot be switched on by keyboard either. */}
      <div className={cn('flex items-center gap-2 opacity-50')}>
        <input data-testid="card-renewal" type="checkbox" checked={false} disabled readOnly aria-label={RENEWAL_LABEL} className="size-4 rounded border-v3-border-checkbox" />
        <span className="text-sm leading-5 text-v3-text-body">{RENEWAL_LABEL}</span>
        <span data-testid="card-renewal-soon" className="rounded-full bg-v3-ghost-white px-2 py-0.5 text-xs text-v3-sapphire">เร็วๆ นี้</span>
      </div>
    </div>
  )
}

export default CardForm
