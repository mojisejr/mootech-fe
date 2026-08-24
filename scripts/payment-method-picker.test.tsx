// #363 — teeth for "we sell two methods, and the two we do not sell are not on the screen at all". MAIN lane.
//
// 🔴 MUTANT CONTRACT:
//   MU1  render every METHOD instead of the enabled ones      → "only what we sell" reddens
//   MU2  hide the two with CSS instead of not rendering       → "not in the DOM" reddens
//   MU3  drop the PromptPay tile                              → "promptpay exists" reddens
//   MU4  stop marking the selected tile                       → "selection is announced" reddens
//
// 🔑 WHY "NOT IN THE DOM" AND NOT "NOT VISIBLE". The ticket says ซ่อน — and `hidden` via CSS still leaves a
// tile a keyboard can focus and a screen reader can read, which on a payment step means a user can select a
// method we cannot take money through. The failure is silent for sighted users and total for everyone else.
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { PaymentMethodPicker, METHODS } from '@/features/v2-shop/components/PaymentMethodPicker'

afterEach(cleanup)

describe('#363 the methods we actually sell', () => {
  it('renders exactly the two we sell', () => {
    render(<PaymentMethodPicker value="card" onChange={vi.fn()} />)
    expect(screen.getByTestId('method-card')).toBeTruthy()
    expect(screen.getByTestId('method-promptpay')).toBeTruthy()
    expect(screen.getByTestId('method-picker').children.length).toBe(2)
  })

  it('🔴 Bank Transfer and Cash App are NOT IN THE DOM — not merely invisible', () => {
    render(<PaymentMethodPicker value="card" onChange={vi.fn()} />)
    expect(screen.queryByTestId('method-bank')).toBeNull()
    expect(screen.queryByTestId('method-cashapp')).toBeNull()
    // ...and nothing carries their words either, so no assistive tech can announce a method we cannot charge.
    expect(document.body.textContent).not.toContain('Bank Transfer')
    expect(document.body.textContent).not.toContain('Cash App')
  })

  it('but they are still DEFINED — re-enabling is one word, per the ticket', () => {
    // "ซ่อน ไม่ลบออกจากโค้ด". If someone deletes the definitions, this says so — the ticket asked for the
    // ability to switch them back on, and that ability is the thing being pinned, not the array's length.
    const ids = METHODS.map((m) => m.id)
    expect(ids).toContain('bank')
    expect(ids).toContain('cashapp')
    expect(METHODS.find((m) => m.id === 'bank')?.enabled).toBe(false)
    expect(METHODS.find((m) => m.id === 'cashapp')?.enabled).toBe(false)
  })

  it('selection is announced, not just coloured', () => {
    const { rerender } = render(<PaymentMethodPicker value="card" onChange={vi.fn()} />)
    expect(screen.getByTestId('method-card').getAttribute('aria-checked')).toBe('true')
    expect(screen.getByTestId('method-promptpay').getAttribute('aria-checked')).toBe('false')
    rerender(<PaymentMethodPicker value="promptpay" onChange={vi.fn()} />)
    expect(screen.getByTestId('method-promptpay').getAttribute('aria-checked')).toBe('true')
  })

  it('tapping a tile reports the choice upward', () => {
    const onChange = vi.fn()
    render(<PaymentMethodPicker value="card" onChange={onChange} />)
    fireEvent.click(screen.getByTestId('method-promptpay'))
    expect(onChange).toHaveBeenCalledWith('promptpay')
  })
})
