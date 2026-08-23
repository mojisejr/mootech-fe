// #363 — teeth for the money block. MAIN lane.
//
// 🔴 MUTANT CONTRACT:
//   MU1  render a computed total instead of quote.amountSatang        → "prints the quote" reddens
//   MU2  show "VAT 0% ฿0" instead of hiding the row                   → "VAT 0 hides the row" reddens
//   MU3  drop the summary line when a code is applied (chip only)     → "chip AND line" reddens
//   MU4  put "วันนี้" back on the total label                          → the promise audit reddens
//   MU5  put "ต่ออายุอัตโนมัติ" back on the plan sub-line               → the promise audit reddens
//   MU6  render the annual-saving row with a made-up number           → "absent unless sent" reddens
//
// 🔑 THE AUDIT TEST IS PER-LINE, NOT PER-WORD, AND THAT IS THE WHOLE POINT (ตู๋ #363 ⑤).
// "ยอดชำระวันนี้" contains no forbidden word — it passes any banned-list — and it still promises a next
// instalment. So the test walks every rendered line and asks the ticket's question of each one. A banned-word
// list would have shipped that string.
import React from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { OrderSummaryCard, type Quote } from '@/features/v2-shop/components/OrderSummaryCard'

afterEach(cleanup)

const quote = (over: Partial<Quote> = {}): Quote => ({
  listSatang: 159000, discountSatang: 0, amountSatang: 159000,
  vatSatang: 10402, vatPercent: 7, codeApplied: null, ...over,
})

const discount = { state: 'default' as const, value: '', onChange: vi.fn(), onApply: vi.fn(), onClear: vi.fn() }

const renderCard = (q: Quote, d = discount) =>
  render(<OrderSummaryCard planName="Mumate Pro · รายปี" validUntilText="14 ก.ค. 2570" quote={q} onChangePlan={vi.fn()} discount={d} />)

describe('#363 the summary prints the quote — it does not recompute it', () => {
  it('every amount is the server\'s number, rendered through the one formatter', () => {
    // Deliberately incoherent numbers: list 1590, code −0, vat 104.02, total 1.23. Nothing here adds up, and
    // that is the test — a component that derives ANY of these cannot reproduce this frame.
    renderCard(quote({ amountSatang: 123, vatSatang: 10402, listSatang: 159000 }))
    expect(screen.getByTestId('summary-list').textContent).toBe('฿1,590')
    expect(screen.getByTestId('summary-vat').textContent).toBe('฿104.02')
    expect(screen.getByTestId('summary-total').textContent).toBe('฿1.23')
  })

  it('the component source contains no arithmetic on money', () => {
    const src = readFileSync(join(process.cwd(), 'features/v2-shop/components/OrderSummaryCard.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``')
    expect(src).not.toMatch(/\/\s*100|toFixed|Math\.(round|floor|ceil)/)
  })
})

describe('#363 rows that appear and disappear', () => {
  it('VAT 0 hides the WHOLE row — never "VAT 0% ฿0"', () => {
    renderCard(quote({ vatPercent: 0, vatSatang: 0 }))
    expect(screen.queryByTestId('summary-vat')).toBeNull()
    expect(document.body.textContent).not.toContain('VAT')
  })

  it('VAT 7 shows the row with the server\'s own number', () => {
    renderCard(quote({ vatPercent: 7, vatSatang: 9400 }))
    expect(screen.getByTestId('summary-vat').textContent).toBe('฿94')
    expect(document.body.textContent).toContain('VAT 7% (รวมแล้ว)')
  })

  it('an applied code shows BOTH the chip and the summary line', () => {
    renderCard(quote({ codeApplied: 'SAVE10', discountSatang: 15900, amountSatang: 143100 }),
      { ...discount, state: 'success', value: 'SAVE10' })
    expect(screen.getByTestId('discount-chip')).toBeTruthy()          // the chip in the field
    expect(screen.getByTestId('summary-code-discount').textContent).toBe('−฿159') // and the line in the totals
    expect(document.body.textContent).toContain('ส่วนลดโค้ด SAVE10')
  })

  it('the annual-saving row is ABSENT until the lane actually sends the number', () => {
    renderCard(quote())
    expect(screen.queryByTestId('summary-annual-saving')).toBeNull()
    cleanup()
    // ...and lights up on its own the day it arrives — no edit to the component.
    renderCard(quote({ annualSavingSatang: 79800 }))
    expect(screen.getByTestId('summary-annual-saving').textContent).toBe('−฿798')
  })
})

describe('#363 the promise audit — per LINE, not per word', () => {
  it('no rendered line tells the reader they will be charged again', () => {
    renderCard(quote({ codeApplied: 'SAVE10', discountSatang: 15900 }), { ...discount, state: 'success', value: 'SAVE10' })
    const lines = Array.from(document.querySelectorAll('p, span, button'))
      .map((e) => (e.textContent ?? '').trim())
      .filter((t) => t.length > 0 && !/^[฿−✕✓✨🔥]/.test(t))
    // Surface size stated out loud: an empty list would pass every assertion below.
    expect(lines.length).toBeGreaterThan(5)
    for (const line of lines) {
      expect(line, `"${line}" promises a renewal`).not.toContain('ต่ออายุ')
      // "ยอดชำระวันนี้" carries no banned word and still promises a next instalment — this is the case that
      // proves a word list is the wrong instrument.
      expect(line, `"${line}" implies another instalment`).not.toMatch(/วันนี้|งวด|ครั้งต่อไป|อัตโนมัติ/)
    }
    // and the replacements are actually on screen, so "no bad line" cannot be satisfied by rendering nothing
    expect(document.body.textContent).toContain('ใช้ได้ถึง 14 ก.ค. 2570')
    expect(document.body.textContent).toContain('ยอดชำระ')
  })
})
