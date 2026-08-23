// #363 — teeth for the discount-code block on checkout. MAIN lane.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`, each a DIFFERENT test):
//   MU1  compute the saved amount in the component instead of printing `savedText`  → "never does arithmetic"
//   MU2  show the chip's saved amount but drop it from the helper line (or vice versa) → "one number, two places"
//   MU3  swap the server's error reason for the hardcoded fallback when one was given → "server's words win"
//   MU4  let ใช้ fire on an empty code                                              → "inert while empty"
//   MU5  render the input row in the success state                                  → "success replaces the row"
//   MU6  drop role=alert from the error helper                                      → "the failure is announced"
//
// 🔑 WHY MU1 IS THE ONE THAT MATTERS. The ticket's rule is "ทุกยอดบนจอตรงกับที่ server คำนวณ — จอไม่คิดเลขเอง",
// and the failure mode is not a crash: a component that computes agrees with the server on every case anyone
// thinks to test, and disagrees on the one nobody did (a code that changes VAT, a rounding rule that moved).
// So the assertion is not "the number is right" — a component that computes passes that. It is "the number
// the caller handed in is the number on screen, character for character, in BOTH places it appears".
import React from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import {
  DiscountCodeField,
  DISCOUNT_ERROR_FALLBACK,
  DISCOUNT_PLACEHOLDER,
} from '@/features/v2-shop/components/DiscountCodeField'

afterEach(cleanup)

const noop = () => {}
const base = { value: '', onChange: noop, onApply: noop, onClear: noop }

describe('#363 discount code — the three states the component was drawn with', () => {
  it('default: an empty pill, the design placeholder, and ใช้ inert until something is typed', () => {
    render(<DiscountCodeField {...base} state="default" />)
    expect(screen.getByTestId('discount-input').getAttribute('placeholder')).toBe(DISCOUNT_PLACEHOLDER)
    expect(screen.getByTestId('discount-apply').hasAttribute('disabled')).toBe(true)
    expect(screen.queryByTestId('discount-chip')).toBeNull()
    expect(screen.queryByTestId('discount-helper')).toBeNull()
  })

  it('ใช้ stays inert while the code is empty — including whitespace only', () => {
    const onApply = vi.fn()
    const { rerender } = render(<DiscountCodeField {...base} state="default" value="   " onApply={onApply} />)
    fireEvent.click(screen.getByTestId('discount-apply'))
    expect(onApply).not.toHaveBeenCalled()
    // ...and wakes up the moment there is something to ask the server about.
    rerender(<DiscountCodeField {...base} state="default" value="SAVE10" onApply={onApply} />)
    fireEvent.click(screen.getByTestId('discount-apply'))
    expect(onApply).toHaveBeenCalledTimes(1)
  })

  it('success: the chip REPLACES the input row — you cannot type over an applied code', () => {
    render(<DiscountCodeField {...base} state="success" value="SAVE10" savedText="฿159" />)
    expect(screen.getByTestId('discount-chip')).toBeTruthy()
    expect(screen.queryByTestId('discount-input')).toBeNull()
    expect(screen.queryByTestId('discount-apply')).toBeNull()
  })

  it('🔴 the amount on screen is the caller\'s string, character for character, in BOTH places', () => {
    // A deliberately "wrong-looking" amount: if anything in the component recomputes, rounds, reformats or
    // re-derives, it cannot reproduce this. That is the point — the component must not be able to have an
    // opinion about money. (A component that computes would print ฿159 here and look correct.)
    render(<DiscountCodeField {...base} state="success" value="SAVE10" savedText="฿1.23" />)
    expect(screen.getByTestId('discount-saved').textContent).toBe('−฿1.23')
    expect(screen.getByTestId('discount-helper').textContent).toContain('ประหยัด ฿1.23')
  })

  it('the source contains no money arithmetic at all', () => {
    // The behavioural test above can only catch a computation that produces a DIFFERENT number. This one
    // catches the capability. Narrow on purpose: it looks for arithmetic, not for the word "amount".
    // 🔴 STRIP STRING LITERALS FIRST. The first version of this check went red on the component's own
    // Tailwind classes — `gap-3`, `py-2.5`, `border-[1.5px]` all look exactly like arithmetic to a regex.
    // An instrument that cannot tell a class name from a calculation would have forced the styling to be
    // written around the test, which is the tail wagging the dog. Class names live in strings; arithmetic
    // on money does not.
    const src = readFileSync(join(process.cwd(), 'features/v2-shop/components/DiscountCodeField.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/`(?:[^`\\]|\\.)*`/g, '``')
    expect(src).not.toMatch(/[a-zA-Z_)\]]\s*[*/+-]\s*\d|\d\s*[*/+-]\s*[a-zA-Z_(]/)
    expect(src).not.toMatch(/toFixed|Math\.(round|floor|ceil)|parseFloat|Number\(/)
  })

  it('error: the SERVER\'s reason wins; the design copy is only the fallback', () => {
    const { rerender } = render(
      <DiscountCodeField {...base} state="error" value="EXPIRED99" errorText="โค้ดนี้ใช้ครบจำนวนแล้ว" />,
    )
    expect(screen.getByTestId('discount-helper').textContent).toContain('โค้ดนี้ใช้ครบจำนวนแล้ว')
    // ...and when the server said nothing, the screen still says something rather than showing an empty row.
    rerender(<DiscountCodeField {...base} state="error" value="EXPIRED99" />)
    expect(screen.getByTestId('discount-helper').textContent).toContain(DISCOUNT_ERROR_FALLBACK)
  })

  it('error is ANNOUNCED, not just coloured — the failure reaches a screen reader', () => {
    render(<DiscountCodeField {...base} state="error" value="EXPIRED99" />)
    const helper = screen.getByTestId('discount-helper')
    expect(helper.getAttribute('role')).toBe('alert')
    expect(screen.getByTestId('discount-input').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByTestId('discount-input').getAttribute('aria-describedby')).toBe(helper.id)
  })

  it('✕ asks the caller to drop the code — it does not clear anything itself', () => {
    const onClear = vi.fn()
    const onChange = vi.fn()
    render(<DiscountCodeField {...base} state="success" value="SAVE10" savedText="฿159" onClear={onClear} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('discount-clear'))
    expect(onClear).toHaveBeenCalledTimes(1)
    // The re-price belongs to checkout (it must ask the server again). A component that cleared its own value
    // would leave the screen showing a code-free field beside a total that still has the discount in it.
    expect(onChange).not.toHaveBeenCalled()
  })
})
