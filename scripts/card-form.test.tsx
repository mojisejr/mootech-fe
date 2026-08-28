// #491 — teeth for "a buyer cannot type nonsense into the card fields, and is told WHICH field is wrong".
//
// 🔴 MUTANT CONTRACT:
//   MU1  drop the keystroke filter on the number field      → "typing a letter changes nothing" reddens
//   MU2  block paste instead of normalising it              → the paste test reddens
//   MU3  put one shared error line at the bottom of the      → the per-field aria-invalid test reddens
//        form instead of marking the field
//   MU4  stop passing `now` in and read the clock inside     → the expired-card test reddens
//   MU5  render the brand mark for every input length        → "no mark before the brand is known" reddens
//
// 🔑 WHY THE FILTER, NOT A WARNING. Feem's words were "กรอกมั่วไม่ได้" — cannot enter it, not enter it and
// then be told off. A field that accepts a letter and then reddens has already let the buyer believe the
// card number is what they see.
//
// 🔑 WHY PASTE IS SACRED. Refusing pasted text stops every password-manager user from paying at all. That
// is worse than the typo it would prevent, so the test asserts paste WORKS rather than asserting it is
// filtered. formatCardNumber already strips separators — the component must lean on it, not re-implement.
//
// 🔑 THE VALIDATION ANSWER IS NEVER ASSEMBLED HERE. card-rules.validateCard owns "which field is wrong"
// and carries 18 cases of its own (#447). These tests assert the FORM renders that answer, never that it
// recomputes it. A second opinion about card validity is how the two answers drift apart.
import React, { useState } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

/**
 * Typing is simulated with fireEvent rather than user-event, which is not a dependency of this repo
 * and is not worth adding for one spec. A controlled input sees exactly one change event per
 * keystroke carrying the accumulated value, so this drives the same onChange the filter lives in.
 */
function typeInto(el: HTMLInputElement, text: string) {
  for (const ch of text) {
    fireEvent.change(el, { target: { value: el.value + ch } })
  }
}
import { validateCard } from '@/features/v2-shop/card-rules'
import { CardForm } from '@/features/v2-shop/components/CardForm'
import type { CardState } from '@/features/v2-shop/card-rules'

afterEach(cleanup)

/** A card that is valid on 2026-08-28 — the date every test below pins, so none of them has a clock. */
const VISA = '4242424242424242'
const NOW = new Date('2026-08-28T00:00:00Z')

/**
 * The Harness now plays the part checkout plays: it owns the clock and computes the validation, then
 * hands the RESULT down. That is the #492 shape, and it is why the two clock cases below still mean
 * something — they prove the clock belongs to the CALLER. CardForm itself no longer has one to test,
 * which is the point: it has no clock parameter at all.
 */
function Harness({ now = NOW, initial }: { now?: Date; initial?: Partial<CardState> }) {
  const [card, setCard] = useState<CardState>({ name: '', number: '', expiry: '', cvc: '', ...initial })
  return <CardForm value={card} onChange={setCard} validation={validateCard(card, now)} />
}

const number = () => screen.getByTestId('card-number') as HTMLInputElement
const expiry = () => screen.getByTestId('card-expiry') as HTMLInputElement
const cvc = () => screen.getByTestId('card-cvc') as HTMLInputElement

describe('#491 · garbage cannot be entered at all', () => {
  it('a letter typed into the card number changes nothing — not typed-then-warned', () => {
    render(<Harness />)
    typeInto(number(), 'a')
    expect(number().value).toBe('')
  })

  it('digits go in, and are grouped in fours as they are typed', () => {
    render(<Harness />)
    typeInto(number(), '4242424242424242')
    expect(number().value).toBe('4242 4242 4242 4242')
  })

  it('letters in the CVC and the expiry are refused the same way', () => {
    render(<Harness />)
    typeInto(cvc(), 'abc')
    typeInto(expiry(), 'xy')
    expect(cvc().value).toBe('')
    expect(expiry().value).toBe('')
  })

  it('the expiry inserts its own slash — the buyer never types it', () => {
    render(<Harness />)
    typeInto(expiry(), '042027')
    expect(expiry().value).toBe('04/2027')
  })
})

describe('#491 · paste is never blocked', () => {
  it('a number pasted with dashes lands clean, because password managers must keep working', () => {
    render(<Harness />)
    fireEvent.change(number(), { target: { value: '4242-4242-4242-4242' } })
    expect(number().value).toBe('4242 4242 4242 4242')
  })

  it('a number pasted with spaces lands clean too', () => {
    render(<Harness />)
    fireEvent.change(number(), { target: { value: '4242 4242 4242 4242' } })
    expect(number().value).toBe('4242 4242 4242 4242')
  })
})

describe('#491 · the buyer is told WHICH field is wrong', () => {
  it('a short number marks the number field and leaves the others alone', () => {
    render(<Harness />)
    typeInto(number(), '4242')
    fireEvent.blur(number())
    expect(number().getAttribute('aria-invalid')).toBe('true')
    expect(cvc().getAttribute('aria-invalid')).toBeNull()
    expect(expiry().getAttribute('aria-invalid')).toBeNull()
  })

  it('the reason is rendered as words next to that field, not as a token', () => {
    render(<Harness />)
    typeInto(number(), '4242')
    fireEvent.blur(number())
    const described = number().getAttribute('aria-describedby')
    expect(described).toBeTruthy()
    const helper = document.getElementById(described!)
    expect(helper?.textContent ?? '').not.toMatch(/number_too_short|number_luhn|expiry_past/)
    expect((helper?.textContent ?? '').length).toBeGreaterThan(0)
  })

  it('nothing is marked before the buyer has left the field — no yelling while typing', () => {
    render(<Harness />)
    typeInto(number(), '4242')
    expect(number().getAttribute('aria-invalid')).toBeNull()
  })

  it('an expiry in the past is marked, and `now` comes from the caller so this can be pinned', () => {
    render(<Harness now={new Date('2026-08-28T00:00:00Z')} />)
    typeInto(expiry(), '072026')
    fireEvent.blur(expiry())
    expect(expiry().getAttribute('aria-invalid')).toBe('true')
  })

  it('the same expiry is fine when `now` is earlier — proving the clock is the parameter, not the machine', () => {
    render(<Harness now={new Date('2025-01-01T00:00:00Z')} />)
    typeInto(expiry(), '072026')
    fireEvent.blur(expiry())
    expect(expiry().getAttribute('aria-invalid')).toBeNull()
  })
})

describe('#491 · the brand mark', () => {
  it('appears once the leading digits identify the brand', () => {
    render(<Harness />)
    typeInto(number(), VISA)
    expect(screen.getByTestId('card-brand').getAttribute('aria-label')).toMatch(/visa/i)
  })

  it('is absent while the brand is still unknown — an empty field shows no mark', () => {
    render(<Harness />)
    expect(screen.queryByTestId('card-brand')).toBeNull()
  })

  it('follows the digits rather than being set once', () => {
    render(<Harness />)
    typeInto(number(), '5555555555554444')
    expect(screen.getByTestId('card-brand').getAttribute('aria-label')).toMatch(/mastercard/i)
  })
})

describe('#491 · one CardState, not two', () => {
  it('the form re-exports the rules module’s type so the page cannot bind to a stale copy', async () => {
    const form = await import('@/features/v2-shop/components/CardForm')
    const rules = await import('@/features/v2-shop/card-rules')
    // A type is erased at runtime, so there is no behaviour that can tell two structurally identical
    // declarations apart. This one check therefore reads the source, which is a weaker instrument: it
    // can only see that the declaration is gone and the import is there, and it would stay green if the
    // rest of the file were gutted. The behavioural teeth above are what cover the file's actual work.
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(process.cwd(), 'features/v2-shop/components/CardForm.tsx'), 'utf8')
    expect(src).not.toMatch(/^export type CardState = \{/m)
    expect(src).toMatch(/export type \{[^}]*CardState[^}]*\}/)
    expect(src).toMatch(/from '\.\.\/card-rules'/)
    expect(typeof form.CardForm).toBe('function')
    expect(typeof rules.validateCard).toBe('function')
  })
})

describe('#502 · the checkout border matches its own frame, not the app-wide one', () => {
  // 🔴 WHAT THIS DOES AND DOES NOT PROVE. The FRAME question — which colour Figma asks for — was
  // settled by pixels: Figma 402:21464 samples #D1D5DB on three fields, and the rendered route now
  // samples #D3D6DC where it used to sample #E6E8EB (both antialiased one step off their token).
  // Images are in harness/pixel-proof/502-*. This test is only the REGRESSION tooth: it catches
  // someone flipping the field back to the app-wide border. A class assertion cannot tell you what
  // the frame wants, and it is not offered as if it could.
  it('the card fields carry the checkout border, not border-input', () => {
    render(<Harness />)
    const pill = number().closest('div')!
    expect(pill.className).toContain('border-v3-border-checkout')
    expect(pill.className).not.toContain('border-v3-border-input')
  })

  it('the tone is a swapped class, never both — cn concatenates and would leave the winner to CSS order', () => {
    render(<Harness />)
    const cls = number().closest('div')!.className
    const both = cls.includes('border-v3-border-checkout') && cls.includes('border-v3-border-input')
    expect(both).toBe(false)
  })
})
