// scripts/calendar-refusal-on-screen.test.tsx — #529 + #530, the SCREEN half.
//
// scripts/calendar-refusal-reaches-screen.test.tsx (#533) proves the two refusals leave the route and
// survive to the hook. It cannot prove a person ever sees them: both pages could read the fields perfectly
// and still render the old neutral notice, and every one of those tests would stay green.
//
// So this file mounts the REAL pages and asserts the STRING a person reads — never a prop, never a
// data-attribute, never a source spelling. That rule is the repo's, from shop-screen-mount.test.tsx:5,
// written after mootech-fe#452 shipped a tooth that read a prop and a tooth that read a comment.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   R1  monthRefusalSurface returns an upgrade for an UNNAMED refusal (null)   → the five-neutral-causes test reddens
//   R2  dayBodyState checks `detail` before `outOfSpan`                        → the fail-closed test reddens
//   R3  dayBodyState answers 'loading' where it should answer 'unavailable'    → the forever-spinner test reddens
//   R4  the sign-in card links to the shop instead of /v2/login                → the no-sales-pitch test reddens
//   R5  the month page renders CalendarSkeleton for a NAMED refusal            → the month-arrow tests redden
//   R6  the day page drops the upgrade branch and falls back to the spinner    → the day-wall test reddens
//   R7  the settled day screen returns to ctaLabel='' (the loading sentinel)   → the no-lie-in-the-bar test reddens
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { CookiesProvider } from 'react-cookie'
import { monthRefusalSurface, dayBodyState, type DayBodyState } from '@/features/v2-calendar/refusal-view'
import { CalendarRefusalCard, SIGN_IN_HREF } from '@/features/v2-calendar/components/refusal/CalendarRefusalCard'
import { SHOP_HREF } from '@/features/v2-shop/upgrade-cta'

// Same one-line stub as tier-prod-pages.test.tsx:16 — the module graph reads runtime config at load.
vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ pathname: '/v2/calendar', asPath: '/v2/calendar', route: '/v2/calendar', query: { date: '2026-12-25' }, isReady: true, push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(() => Promise.resolve()), events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } }),
}))

const monthState = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
const dayState = vi.hoisted(() => ({ value: { detail: null as unknown, loading: false, outOfSpan: false } }))
const tierState = vi.hoisted(() => ({ value: { isPaid: false as boolean | null, tier: null as string | null, loading: false } }))

vi.mock('@/features/v2-calendar/hooks/useCalendarMonth', () => ({ useCalendarMonth: () => monthState.value }))
vi.mock('@/features/v2-calendar/hooks/useDayDetail', () => ({ useDayDetail: () => dayState.value }))
vi.mock('@/features/v2-shell/hooks/useClientTier', () => ({ useClientTier: () => tierState.value }))

/** The seam useCalendarMonth actually returns (useCalendarMonth.ts:53-101), with a refusal swapped per row.
 *  Built as the FULL shape rather than a two-field stub so a failure means the page is wrong, never that
 *  the fixture was thin — the lesson recorded in shop-screen-mount.test.tsx about a too-thin mock. */
function monthSeam(refusal: 'out-of-span' | 'no-identity' | null) {
  return {
    month: null, loading: false, refusal,
    year: 2026, monthIndex: 12, todayISO: '2026-08-30', selectedDate: null,
    selectDay: vi.fn(), goPrev: vi.fn(), goNext: vi.fn(), goToday: vi.fn(),
  }
}

/** The neutral notice CalendarSkeleton renders for every UNNAMED empty month (CalendarSkeleton.tsx:113). */
const NEUTRAL_MONTH_LINE = 'ยังแสดงปฏิทินของคุณไม่ได้ตอนนี้'

afterEach(cleanup)
beforeEach(() => {
  monthState.value = monthSeam(null)
  dayState.value = { detail: null, loading: false, outOfSpan: false }
  tierState.value = { isPaid: false, tier: null, loading: false }
})

// ────────────────────────────────────────────────────────────────────────────────────────────────
describe('#530 monthRefusalSurface — only a NAMED refusal changes the screen', () => {
  it('out-of-span → the upgrade invitation, scoped to the month', () => {
    expect(monthRefusalSurface('out-of-span')).toEqual({ kind: 'upgrade', scope: 'month' })
  })

  it('no-identity → the sign-in path, NOT a sale', () => {
    expect(monthRefusalSurface('no-identity')).toEqual({ kind: 'sign-in' })
  })

  // 🔴 R1. `month: null` means five different things (useCalendarMonth.ts:104-110) and only one of them is
  // a wall. A default: that fell through to 'upgrade' would offer to sell a package to somebody whose
  // network just died — the same bug as today's, pointed the other way.
  it('🔴 null → null, so all five unnamed empty-month causes keep the neutral face', () => {
    expect(monthRefusalSurface(null)).toBeNull()
  })
})

// ────────────────────────────────────────────────────────────────────────────────────────────────
describe('#529 dayBodyState — four states, and the failure one is the point', () => {
  const CASES: Array<[string, Parameters<typeof dayBodyState>[0], DayBodyState]> = [
    ['a real detail in hand', { detail: { any: 1 }, loading: false, outOfSpan: false }, 'ready'],
    ['the fetch is genuinely in flight', { detail: null, loading: true, outOfSpan: false }, 'loading'],
    ['the day is past what the package sells', { detail: null, loading: false, outOfSpan: true }, 'upgrade'],
    ['settled, nothing to show, not walled', { detail: null, loading: false, outOfSpan: false }, 'unavailable'],
  ]
  it.each(CASES)('%s → %s', (_name, input, expected) => {
    expect(dayBodyState(input)).toBe(expected)
  })

  // TOTAL — the same assertion calendar-view-state.test.ts makes for the month body. Surface size stated
  // out loud so a shortened table cannot read as "every state is covered".
  it('the table above is the whole space: 2 x 2 x 2 inputs, never a fifth answer', () => {
    const seen = new Set<string>()
    for (const detail of [null, { any: 1 }]) {
      for (const loading of [true, false]) {
        for (const outOfSpan of [true, false]) seen.add(dayBodyState({ detail, loading, outOfSpan }))
      }
    }
    expect([...seen].sort()).toEqual(['loading', 'ready', 'unavailable', 'upgrade'])
  })

  // 🔴 R2. Fail closed. A response carrying BOTH a detail and the wall flag should not arise, but if it
  // ever does, painting the detail serves paid content past the wall. Refusing to sell is recoverable.
  it('🔴 outOfSpan wins over a detail that arrived anyway — never serve past the wall', () => {
    expect(dayBodyState({ detail: { any: 1 }, loading: false, outOfSpan: true })).toBe('upgrade')
  })

  // Pins the implication that lets pages/v2/calendar/[date].tsx write `bodyState !== 'ready' || !detail`
  // with the second clause unreachable. Reorder the branches and this reddens instead of the clause
  // quietly becoming load-bearing.
  it("'ready' is answered ONLY when detail is truthy", () => {
    for (const loading of [true, false]) {
      for (const outOfSpan of [true, false]) {
        expect(dayBodyState({ detail: null, loading, outOfSpan })).not.toBe('ready')
      }
    }
  })

  // 🗄️ R8 LIVED HERE AND WAS REMOVED WITH THE PARAMETER IT GUARDED. It asserted that an unsettled
  // identity is not a failure — true, and now enforced one layer down by mootech-fe#533 `9fa30dc`, which
  // splits "the row has not arrived" from "it arrived with no birthday" inside useDayDetail. Keeping a
  // copy here would have been a test for a state this screen can no longer be handed. The live tooth is
  // "while the user row is in flight the hook says LOADING" in calendar-refusal-reaches-screen.test.tsx;
  // reverting that branch reddens 4 cases, checked before this block was deleted rather than after.

  // 🔴 R3. THE BUG THIS TICKET IS ABOUT. Before refusal-view.ts the page tested `!detail` alone, so this
  // exact input returned the spinner and nothing was left to stop it. A pulse reads as "any second now"
  // and the person waits (calendar-view-state.ts:16). Settled must never answer 'loading'.
  it('🔴 settled-with-nothing must NOT answer loading — that is the forever spinner', () => {
    expect(dayBodyState({ detail: null, loading: false, outOfSpan: false })).not.toBe('loading')
  })
})

// ────────────────────────────────────────────────────────────────────────────────────────────────
describe('CalendarRefusalCard — what the person reads, and where it sends them', () => {
  it('the month wall invites an upgrade and points back at the selector still on screen', () => {
    render(<CalendarRefusalCard surface={{ kind: 'upgrade', scope: 'month' }} />)
    expect(screen.getByText(/เดือนนี้ยังไม่รวมอยู่ในแพ็กเกจของคุณ/)).toBeTruthy()
    expect(screen.getByText(/แถบเลือกเดือนด้านบน/)).toBeTruthy()
    expect(screen.getByTestId('calendar-refusal-cta').getAttribute('href')).toBe(SHOP_HREF)
  })

  it('the day wall says the DAY, not the month — one card, two subjects', () => {
    render(<CalendarRefusalCard surface={{ kind: 'upgrade', scope: 'day' }} />)
    expect(screen.getByText(/วันที่เลือกยังไม่รวมอยู่ในแพ็กเกจของคุณ/)).toBeTruthy()
    expect(screen.queryByText(/เดือนนี้ยังไม่รวม/)).toBeNull()
  })

  // 🔴 R4. The control the two tickets both ask for, in its sharpest form: fixing "a wall looks like a
  // crash" must not create "a crash looks like a sales pitch". Somebody whose identity we cannot resolve
  // gets the sign-in path and NO route to the shop anywhere on the card.
  it('🔴 the sign-in card offers a way back in, and no way to the shop', () => {
    const { container } = render(<CalendarRefusalCard surface={{ kind: 'sign-in' }} />)
    expect(screen.getByTestId('calendar-refusal-signin').getAttribute('href')).toBe(SIGN_IN_HREF)
    expect(screen.queryByTestId('calendar-refusal-cta')).toBeNull()
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(hrefs).not.toContain(SHOP_HREF)
  })

  // The copy must not assert a cause the field cannot see. 'no-identity' covers not-signed-in, no account
  // and an ambiguous session alike (pages/api/v2/calendar-month.ts, the resolveSessionUserId exit), so
  // claiming the session EXPIRED would be the same sin CalendarSkeleton.tsx:106 declines to commit.
  it('the sign-in copy does not claim a cause it cannot see', () => {
    render(<CalendarRefusalCard surface={{ kind: 'sign-in' }} />)
    expect(screen.queryByText(/หมดอายุ/)).toBeNull()
  })
})

// ────────────────────────────────────────────────────────────────────────────────────────────────
describe('#530 the month screen — the arrow ฟีม pressed', () => {
  async function mountMonth() {
    const { default: Page } = await import('@/pages/v2/calendar')
    return render(<CookiesProvider><Page teamPreview={false} /></CookiesProvider>)
  }

  // 🔴 R5. Today both refusals land on CalendarSkeleton's "ลองรีเฟรชอีกครั้ง หรือตรวจว่าโปรไฟล์มีวันเกิดครบแล้ว",
  // which is wrong for both of them and is the whole ticket.
  it('🔴 out-of-span → the upgrade invitation replaces the refresh-and-check-your-birthday notice', async () => {
    monthState.value = monthSeam('out-of-span')
    await mountMonth()
    await waitFor(() => expect(screen.getByText(/เดือนนี้ยังไม่รวมอยู่ในแพ็กเกจของคุณ/)).toBeTruthy())
    expect(screen.queryByText(NEUTRAL_MONTH_LINE)).toBeNull()
  })

  it('🔴 no-identity → the sign-in path, and the shop link is nowhere in the body', async () => {
    monthState.value = monthSeam('no-identity')
    const { container } = await mountMonth()
    await waitFor(() => expect(screen.getByTestId('calendar-refusal-signin')).toBeTruthy())
    expect(screen.queryByText(NEUTRAL_MONTH_LINE)).toBeNull()
    expect(container.querySelector('[data-testid="calendar-refusal-cta"]')).toBeNull()
  })

  // The control. An empty month with no named refusal is every other cause, and it must look exactly as
  // it did before this PR — not one pixel of the sales card.
  it('🔴 control: an unnamed empty month keeps the neutral notice and shows no upgrade card', async () => {
    monthState.value = monthSeam(null)
    await mountMonth()
    await waitFor(() => expect(screen.getByText(NEUTRAL_MONTH_LINE)).toBeTruthy())
    expect(screen.queryByTestId('calendar-refusal')).toBeNull()
  })
})

// ────────────────────────────────────────────────────────────────────────────────────────────────
describe('#529 the day screen — the wall that spun forever', () => {
  async function mountDay() {
    const { default: Page } = await import('@/pages/v2/calendar/[date]')
    return render(<CookiesProvider><Page teamPreview={false} /></CookiesProvider>)
  }

  // 🔴 R6. The measured before-state: detail null + loading false + outOfSpan true returned the spinner at
  // [date].tsx:188 and nothing stopped it, because the fetch had already finished.
  it('🔴 a walled day shows the upgrade invitation, and the spinner is gone', async () => {
    dayState.value = { detail: null, loading: false, outOfSpan: true }
    await mountDay()
    await waitFor(() => expect(screen.getByText(/วันที่เลือกยังไม่รวมอยู่ในแพ็กเกจของคุณ/)).toBeTruthy())
    expect(screen.queryByTestId('day-detail-pending')).toBeNull()
  })

  // 🔴 The control both tickets ask for by name: a genuine failure still reads as a failure, and is never
  // dressed up as an invitation to buy.
  it('🔴 control: a genuine failure reads as a failure — no spinner, no sales card', async () => {
    dayState.value = { detail: null, loading: false, outOfSpan: false }
    await mountDay()
    await waitFor(() => expect(screen.getByTestId('day-detail-unavailable')).toBeTruthy())
    expect(screen.queryByTestId('day-detail-pending')).toBeNull()
    expect(screen.queryByTestId('calendar-refusal')).toBeNull()
  })

  // 🔴 R7. THE PIXELS CAUGHT THIS ONE, NOT THE STRINGS. Every assertion above was green while the bottom
  // bar still printed กำลังโหลด… on the walled day: `ctaLabel=""` is the sentinel Menubar.tsx:92 reads as
  // "loading". So the card said "your package stops here" and the bar one row below said "still loading",
  // and the whole point of this ticket is that the screen must not lie about what is happening.
  // Encoded as a case rather than written in a comment, so a later refactor that reinstates the sentinel
  // reddens instead of shipping quietly.
  it.each([
    ['a walled day', { detail: null, loading: false, outOfSpan: true }],
    ['a failed day', { detail: null, loading: false, outOfSpan: false }],
  ])('🔴 %s has finished loading, so no part of the screen may still say so', async (_n, seam) => {
    dayState.value = seam as typeof dayState.value
    const { container } = await mountDay()
    await waitFor(() => expect(screen.queryByTestId('day-detail-pending')).toBeNull())
    expect(container.textContent ?? '').not.toMatch(/กำลังโหลด/)
  })

  it('a fetch really in flight still gets the spinner — it is telling the truth now', async () => {
    dayState.value = { detail: null, loading: true, outOfSpan: false }
    await mountDay()
    await waitFor(() => expect(screen.getByTestId('day-detail-pending')).toBeTruthy())
    expect(screen.queryByTestId('calendar-refusal')).toBeNull()
  })
})
