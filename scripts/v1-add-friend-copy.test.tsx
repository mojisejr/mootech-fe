// #413 — teeth for "the v1 add-friend modal says whose data it is collecting". MAIN lane.
//
// 🔴 MUTANT CONTRACT:
//   MU1  put "เพศดั้งเดิมของคุณ" back on the gender label      → the rendered audit reddens
//   MU2  ban the word wholesale, breaking the privacy line that
//        is correctly addressed to the user                    → the "this one is CORRECT" test reddens
//
// 🔑 THIS FILE READS THE RENDERED DOM, NOT THE SOURCE — the ticket asks for it and the reason is concrete.
// A source grep answers "does this file contain the string?", which is a different question from "does the
// user read it?": a label can be dead code, behind a branch, or supplied by a child. The audit below walks
// what the modal actually paints.
//
// 🔑 AND MU2 IS THE ONE THAT KEEPS THE RULE HONEST. The obvious way to satisfy this ticket is to purge
// "ของคุณ" from the file. One line in this modal is correctly addressed to the user — the privacy note
// "ข้อมูลที่คุณให้มา เราใช้แค่คำนวณดวงเท่านั้น" — and a blanket purge would break it while turning every
// assertion green. The rule is about WHO A FIELD IS ABOUT, not about a forbidden substring. (The same
// mutant earned its keep on #277; this is the v1 half of the same defect.)
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { CookiesProvider } from 'react-cookie'

// v1 code reads publicRuntimeConfig at module scope (via its api constants), so it must exist before the
// component is imported — the modal cannot be rendered at all otherwise.
vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, isReady: true, push: vi.fn(), replace: vi.fn() }) }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'unauthenticated' }) }))

afterEach(cleanup)

async function renderModal() {
  const Mod = (await import('@/components/modal-add-freind')).default
  render(
    <CookiesProvider>
      <Mod userId="u1" name="" image="" refer_code="" provider="" onClose={vi.fn()} onSubmitOK={vi.fn()} />
    </CookiesProvider>,
  )
}

/** Everything the modal actually paints: labels, headings, buttons, placeholders. */
function visibleCopy(): string[] {
  const text = Array.from(document.querySelectorAll('span, p, h1, h2, label, button')).map((e) => (e.textContent ?? '').trim())
  const holders = Array.from(document.querySelectorAll('input')).map((e) => e.getAttribute('placeholder') ?? '')
  return [...text, ...holders].filter((s) => s.length > 0)
}

/** The privacy note is ABOUT the user handing us data — "ของคุณ" there is correct and must survive. */
const CORRECT_USER_ADDRESSED = 'ข้อมูลที่คุณให้มา'

describe('#413 the v1 add-friend modal', () => {
  it('🔴 no FIELD tells the user the data being collected is theirs', async () => {
    await renderModal()
    const copy = visibleCopy()
    // Surface size out loud — an empty list would satisfy the loop below.
    expect(copy.length).toBeGreaterThan(6)
    // The field labels are what mislead. The privacy sentence is addressed to the user on purpose, so it is
    // named as the one exception rather than the rule being softened into "no ของคุณ anywhere".
    const fields = copy.filter((l) => !l.includes(CORRECT_USER_ADDRESSED))
    for (const line of fields) {
      expect(line, `the modal collects a FRIEND's data but says "${line}"`).not.toContain('ของคุณ')
    }
  })

  it('the gender label names the friend', async () => {
    await renderModal()
    expect(screen.getByText('เพศดั้งเดิมของเพื่อน')).toBeTruthy()
    expect(screen.queryByText('เพศดั้งเดิมของคุณ')).toBeNull()
  })

  it('🔴 the privacy line KEEPS "คุณ" — it is about the user handing us data, and it is correct', async () => {
    await renderModal()
    const privacy = visibleCopy().find((l) => l.includes(CORRECT_USER_ADDRESSED))
    expect(privacy, 'the privacy note disappeared — a blanket purge would do exactly this').toBeTruthy()
    expect(privacy).toContain('ข้อมูลที่คุณให้มา เราใช้แค่คำนวณดวงเท่านั้น')
  })

  it('the heading already said friend, and still does', async () => {
    await renderModal()
    expect(visibleCopy().some((l) => l.includes('เพิ่มเพื่อน'))).toBe(true)
  })
})
