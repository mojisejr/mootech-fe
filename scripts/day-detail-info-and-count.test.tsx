// #565 — two guarantees on the day-detail cards.
//
// A. The ⓘ is a real control with text behind it, and the text is an INLINE panel, not a floating
//    popover. That choice is the guarantee: a panel in normal flow cannot overflow the card, so the
//    320/360/393 question the issue asks about is answered by construction. components/calculator/
//    BadgeMarker.tsx is the floating version and #416 recorded what it costs — positioned with
//    window.innerWidth, tuned at 390 only.
// B. The "ความเข้ากัน N ด้าน" heading says the number of rows it actually renders. It said five while
//    the engine sent four. Writing four in its place would move the same bug one engine change to the
//    right, which is exactly the shape #557 had to fix in the quota copy.
//
// .tsx so ci.yml's legacy `for f in scripts/*.test.ts` lane never sees it. Registered in
// vitest.config.mts `include` — APPENDED, never replacing (that list carries its own "UNION, never
// pick a side" warning; #214 and #218 ate each other there once).
//
// MUTANT CONTRACT — each flips real behaviour, each goes RED here:
//   I1  SectionCard renders the ⓘ as a plain glyph even when given a node  → "ⓘ ที่มีเนื้อต้องกดได้" RED
//   I2  the panel renders always, ignoring infoOpen                        → "ยังไม่กด ต้องยังไม่เห็น" RED
//   I3  the panel never closes on a second press                           → "กดซ้ำต้องปิด" RED
//   I4  a bare `info` becomes a button too                                 → "ⓘ ที่ไม่มีเนื้อต้องไม่ใช่ปุ่ม" RED
//   I5  pressing ⓘ also collapses the section                              → "สองปุ่มต้องแยกกัน" RED
//   C1  title back to a literal `ความเข้ากัน 5 ด้าน`                        → both count cases RED
//   C2  title uses a constant 4 instead of areas.length                    → the 3-area case RED
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SectionCard } from '@/features/v2-calendar/components/day-detail/SectionCard'
import { CompatList } from '@/features/v2-calendar/components/day-detail/CompatList'
import type { DayDetailArea } from '@/features/v2-calendar/types'

afterEach(cleanup)

const area = (key: string, label: string, percent: number): DayDetailArea => ({
  key,
  label,
  percent,
  grade: 'B',
  isStrength: false,
})

describe('#565 A · the ⓘ explanation', () => {
  it('a node turns the ⓘ into a control, and the text is hidden until it is pressed', () => {
    render(
      <SectionCard title="ทิศ สีมงคล" info={<p>ใส่เสื้อสีมงคลเพื่อความราบรื่นในวันนี้</p>}>
        <p>เนื้อของการ์ด</p>
      </SectionCard>,
    )
    const toggle = screen.getByTestId('section-info-toggle')
    expect(toggle.tagName).toBe('BUTTON')
    // I2 — not on screen before the press
    expect(screen.queryByTestId('section-info-panel')).toBeNull()
    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(toggle)
    // assert the RENDERED string, not a prop we passed in
    expect(screen.getByTestId('section-info-panel').textContent).toContain(
      'ใส่เสื้อสีมงคลเพื่อความราบรื่นในวันนี้',
    )
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    // I3 — a second press closes it
    fireEvent.click(toggle)
    expect(screen.queryByTestId('section-info-panel')).toBeNull()
  })

  it('I4 · a bare `info` stays an inert glyph — no control, no panel', () => {
    render(
      <SectionCard title="ความเข้ากัน 4 ด้าน" info>
        <p>เนื้อ</p>
      </SectionCard>,
    )
    expect(screen.queryByTestId('section-info-toggle')).toBeNull()
    expect(screen.queryByTestId('section-info-panel')).toBeNull()
  })

  it('I5 · the ⓘ and the collapse chevron are separate controls', () => {
    render(
      <SectionCard title="เวลามงคล" info={<p>ใช้นัดหมายลูกค้า</p>}>
        <p data-testid="body">เนื้อของการ์ด</p>
      </SectionCard>,
    )
    expect(screen.getByTestId('body')).toBeTruthy()
    fireEvent.click(screen.getByTestId('section-info-toggle'))
    // opening the explanation must not collapse the section under it
    expect(screen.getByTestId('body')).toBeTruthy()
    expect(screen.getByTestId('section-info-panel')).toBeTruthy()
  })
})

describe('#565 B · the heading counts the rows it renders', () => {
  it('four areas → "ความเข้ากัน 4 ด้าน"', () => {
    const areas = [
      area('home', 'อยู่บ้าน', 68),
      area('workplace', 'ไปที่ทำงาน', 72),
      area('companions', 'หุ้นส่วน', 55),
      area('outside', 'ไปหาลูกค้า', 48),
    ]
    render(<CompatList areas={areas} insight="" />)
    expect(screen.getByText('ความเข้ากัน 4 ด้าน')).toBeTruthy()
    expect(screen.queryByText('ความเข้ากัน 5 ด้าน')).toBeNull()
  })

  it('C2 · three areas → "ความเข้ากัน 3 ด้าน" (a constant 4 would survive the case above)', () => {
    const areas = [area('home', 'อยู่บ้าน', 68), area('workplace', 'ไปที่ทำงาน', 72), area('companions', 'หุ้นส่วน', 55)]
    render(<CompatList areas={areas} insight="" />)
    expect(screen.getByText('ความเข้ากัน 3 ด้าน')).toBeTruthy()
  })

  it('the count matches the number of rows actually on screen, not just a string', () => {
    const areas = [area('home', 'อยู่บ้าน', 68), area('workplace', 'ไปที่ทำงาน', 72)]
    const { container } = render(<CompatList areas={areas} insight="" />)
    const rows = container.querySelectorAll('[data-testid="day-compat-row"]')
    const heading = screen.getByText(/^ความเข้ากัน \d+ ด้าน$/).textContent ?? ''
    const claimed = Number(heading.match(/(\d+)/)?.[1])
    // reads the SCREEN. No `|| areas.length` fallback: with one, a card that rendered nothing would
    // still pass, and the check would be comparing the heading against the array it came from.
    expect(rows.length).toBe(2)
    expect(claimed).toBe(rows.length)
  })
})
