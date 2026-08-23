// #277 — teeth for "every word on the add-friend sheet says whose data this is". MAIN lane.
//
// 🔴 MUTANT CONTRACT:
//   MU1  put "ของคุณ" back on the create-mode gender label   → the audit reddens
//   MU2  put "ใส่ชื่อของคุณ" back on the name placeholder     → the audit reddens
//   MU3  make create and edit word a field differently        → the parity test reddens
//   MU4  blanket-replace "ของคุณ" everywhere, including the   → the "this one is CORRECT" test reddens
//        save-error line, which is correctly addressed to the user
//
// 🔑 WHY THIS IS NOT A TYPO TICKET. The sheet collects a birth date and time that feed a compatibility
// calculation. A label reading "ของคุณ" on a form about somebody else invites the user to type THEIR OWN
// details, and the result is a reading of the user against themselves — well-formed data about the wrong
// person. Nothing downstream can detect that, which is why the words are the only defence.
//
// 🔑 AND WHY MU4 MATTERS AS MUCH AS MU1. The obvious fix for this ticket is "remove ของคุณ from the file",
// and one line in it is correctly addressed to the user: the save-failure copy "ไม่ใช่ข้อมูลของคุณผิด"
// ("it isn't YOUR data that's wrong"). A blanket replace would break a sentence that was right, so the
// audit names the exception instead of banning the string.
import React from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AddFriendSheet } from '@/features/v2-service/components/AddFriendSheet'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, isReady: true, push: vi.fn() }) }))
afterEach(cleanup)

const EDIT = {
  initial: { name: 'มานี', surname: '', birthDay: '2540-05-04', time: '09:30', isRememberTime: true, gender: 'FEMALE' as const },
  onSave: vi.fn(),
}

/** Everything the user can read on the sheet: labels, placeholders, buttons, headings. */
function visibleCopy(): string[] {
  const sheet = screen.getByTestId('add-friend-sheet')
  const text = Array.from(sheet.querySelectorAll('label, p, span, h1, h2, button')).map((e) => (e.textContent ?? '').trim())
  const holders = Array.from(sheet.querySelectorAll('input')).map((e) => e.getAttribute('placeholder') ?? '')
  return [...text, ...holders].filter((s) => s.length > 0)
}

describe('#277 whose data is this form about', () => {
  it('🔴 CREATE mode never tells the user the fields are theirs', () => {
    render(<AddFriendSheet onClose={vi.fn()} onCreate={vi.fn()} />)
    const copy = visibleCopy()
    // Surface size stated out loud — an empty list would satisfy every assertion below.
    expect(copy.length).toBeGreaterThan(8)
    for (const line of copy) {
      expect(line, `create mode says "${line}" — that is the user's own data, not their friend's`).not.toContain('ของคุณ')
    }
  })

  it('the two fields that misaddressed the user now name the friend', () => {
    render(<AddFriendSheet onClose={vi.fn()} onCreate={vi.fn()} />)
    expect(screen.getByText('เพศดั้งเดิมของเพื่อน')).toBeTruthy()
    expect(screen.getByTestId('add-friend-name').getAttribute('placeholder')).toBe('ใส่ชื่อเพื่อน')
    expect(screen.getByText('ชื่อเพื่อน')).toBeTruthy()
  })

  it('create and edit word the FIELDS identically — one sheet, one language', () => {
    render(<AddFriendSheet onClose={vi.fn()} onCreate={vi.fn()} />)
    const create = visibleCopy()
    cleanup()
    render(<AddFriendSheet onClose={vi.fn()} onCreate={vi.fn()} edit={EDIT} />)
    const edit = visibleCopy()
    // The heading and the dialog title differ by design (one adds, one edits). The FIELD wording must not.
    for (const field of ['ชื่อเพื่อน', 'ใส่ชื่อเพื่อน', 'เพศดั้งเดิมของเพื่อน', 'วันเกิด', 'เวลาเกิด', 'จำไม่ได้']) {
      expect(create, `create is missing "${field}"`).toContain(field)
      expect(edit, `edit is missing "${field}"`).toContain(field)
    }
  })

  it('🔴 the save-failure line KEEPS "ของคุณ" — it is correctly addressed to the user', () => {
    // "ไม่ใช่ข้อมูลของคุณผิด" = "it isn't YOUR data that's wrong". Removing it with a blanket find-and-replace
    // would turn a reassurance into nonsense. The rule is about FIELD LABELS, not about a banned substring.
    const src = readFileSync(join(process.cwd(), 'features/v2-service/components/AddFriendSheet.tsx'), 'utf8')
    expect(src).toContain('ไม่ใช่ข้อมูลของคุณผิด')
  })

  it('there is no longer a BRANCH that can address the wrong person', () => {
    // The bug lived in a ternary: edit said friend, create said you. With both sides equal the branch is
    // gone, so no future edit can resurrect one half of it by accident.
    const src = readFileSync(join(process.cwd(), 'features/v2-service/components/AddFriendSheet.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    expect(src).not.toMatch(/edit \?[^}]*เพศดั้งเดิม/)
  })
})
