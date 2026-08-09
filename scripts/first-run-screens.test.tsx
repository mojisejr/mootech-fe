// first-run screens — the two places where these screens have real logic (issue #215).
// Everything else about them (colour, spacing, type) is design-verify's job, not a unit test's.
//
// .tsx, not .ts: these render components, so the file needs JSX — which also keeps it out of the
// legacy `for f in scripts/*.test.ts` lane in ci.yml (that lane runs plain node:assert scripts under
// tsx and would throw on `import … from 'vitest'`). Registered in vitest.config.mts `include`.
//
// MUTANT CONTRACT: delete `disabled={!consent}` from the <Button> in PdpaConsentScreen and the whole
// "04-pdpa" describe goes RED (3 of 3). That is the close condition on issue #215 — "the button works
// when you click it" is not evidence of a gate, because a screen with no gate at all passes that too.
//
// The assertions read the RENDERED DOM (button.disabled, input.checked, aria-checked), never the props
// that were just passed in — a test that reads back what it wrote passes whether or not the component
// honours the value. Note there is no @testing-library/jest-dom in this repo, so the matchers are plain
// property/attribute reads rather than toBeDisabled()/toBeChecked().
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  IntentCheckScreen,
  GOALS,
  type GoalId,
} from '@/features/v2-first-run/components/IntentCheckScreen'
import { PdpaConsentScreen } from '@/features/v2-first-run/components/PdpaConsentScreen'

// Explicit unmount between tests. vitest has no globals here, so testing-library's auto-cleanup
// never registers — without this, every render stacks in the same document.body and the queries
// below start reporting "found multiple elements". Worth stating plainly: the FIRST test in each
// describe still passed while this was missing, so a green-ish run was not evidence it was there.
afterEach(cleanup)

const acceptButton = () =>
  screen.getByRole('button', { name: /ยอมรับและดำเนินการต่อ/ }) as HTMLButtonElement
const consentBox = () => screen.getByRole('checkbox') as HTMLInputElement
const checkedTiles = () =>
  screen.getAllByRole('radio').filter((t) => t.getAttribute('aria-checked') === 'true')

/** The real screen wired to real state — same loop as the preview page, so a click has to travel
 *  through the component's own callback to come back as a rendered change. */
function LivePdpa({ initial = false, onAccept }: { initial?: boolean; onAccept?: () => void }) {
  const [consent, setConsent] = useState(initial)
  return <PdpaConsentScreen consent={consent} onConsentChange={setConsent} onAccept={onAccept} />
}

describe('04-pdpa — the consent gate', () => {
  it('leaves the button disabled while the box is unticked', () => {
    render(<LivePdpa />)
    expect(consentBox().checked).toBe(false)
    expect(acceptButton().disabled).toBe(true)
  })

  it('enables the button once the box is ticked, and disables it again when unticked', () => {
    render(<LivePdpa />)

    fireEvent.click(consentBox())
    expect(consentBox().checked).toBe(true)
    expect(acceptButton().disabled).toBe(false)

    // the gate has to be a live binding, not a one-way latch that never closes again
    fireEvent.click(consentBox())
    expect(consentBox().checked).toBe(false)
    expect(acceptButton().disabled).toBe(true)
  })

  it('does not fire onAccept while consent is missing, even on a direct click', () => {
    const onAccept = vi.fn()
    render(<LivePdpa onAccept={onAccept} />)

    fireEvent.click(acceptButton())
    expect(onAccept).not.toHaveBeenCalled()

    fireEvent.click(consentBox())
    fireEvent.click(acceptButton())
    expect(onAccept).toHaveBeenCalledTimes(1)
  })
})

/** Same idea for the goal grid: state lives here, so the assertion is on what a click PRODUCES. */
function LiveIntent() {
  const [goal, setGoal] = useState<GoalId | null>(null)
  return <IntentCheckScreen selected={goal} onSelect={setGoal} />
}

describe('02-intent-check — goal selection', () => {
  it('renders all six goals with nothing selected up front', () => {
    render(<LiveIntent />)
    // assert the SURFACE too: six tiles actually painted. A grid that rendered zero of them would
    // otherwise satisfy "nothing is selected" perfectly.
    expect(screen.getAllByRole('radio')).toHaveLength(6)
    expect(GOALS).toHaveLength(6)
    expect(checkedTiles()).toHaveLength(0)
  })

  it('marks exactly the clicked goal as selected', () => {
    render(<LiveIntent />)
    fireEvent.click(screen.getByRole('radio', { name: /ความรัก/ }))

    expect(screen.getByRole('radio', { name: /ความรัก/ }).getAttribute('aria-checked')).toBe('true')
    expect(checkedTiles()).toHaveLength(1)
  })

  it('moves the selection rather than accumulating it', () => {
    render(<LiveIntent />)
    fireEvent.click(screen.getByRole('radio', { name: /ความรัก/ }))
    fireEvent.click(screen.getByRole('radio', { name: /การงาน/ }))

    expect(screen.getByRole('radio', { name: /การงาน/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: /ความรัก/ }).getAttribute('aria-checked')).toBe('false')
    expect(checkedTiles()).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 05-element — the facet block and the copy gate (issue #233 Phase 3)
//
// MUTANT CONTRACT (both must be verified by GREPPING the file after patching it — a runner that
// prints "applied" is not evidence it landed; that misreport cost an hour on #215):
//
//   M1  in buildFacets(), replace `if (!cycle) return null` with a default row
//       → "hides the whole facet block" + "never prints a gender-derived value" go RED.
//       (verified 2026-08-09 @fbee798: 2 failed / 14 passed. The FIRST draft of the second test only
//       looked for the words ชาย/หญิง and stayed green under this mutant — an anchor named for a
//       class it did not guard. It was widened, not dropped.)
//       This is the `gender ?? 'MALE'` family: user.gender is nullable, element_cycle.gender is a
//       notNull key, and the real table gives WOOD/YANG/MALE spouse=EARTH vs FEMALE spouse=METAL.
//       Guessing shows one person's chart to another and nothing else in the app would object.
//
//   M2  swap 'work' and 'career' in FACETS back to the order the Figma frame draws
//       → "maps every column to its own row" goes RED.  (verified: 1 red / 13 green)
//       The frame and the table disagree; the table is the product.
//
//   M3  pick the advice glyph by index again — `Icon={i === 0 ? Leaf : Activity}`
//       → "picks the advice glyph by key" goes RED.  (verified: 1 red / 18 green)
//       That test carries its own control (`forward[0] !== forward[1]`) because its first draft
//       compared the svg CLASS, which is identical for both glyphs: equal-to-equal, green forever.
//
// The rendered-DOM rule from the header applies here too: these read textContent and node counts,
// not the props handed in. A test that asserts on `source.cycle` would pass even if the screen threw
// the row away.
import {
  ElementResultScreen,
  buildFacets,
  polarityTitle,
  type ElementCycleRow,
  type ElementResultSource,
} from '@/features/v2-first-run/components/ElementResultScreen'
import { buildMascotPaths } from '@/lib/personalization/mascot'

// Transcribed from the real element_cycle table (goo's dump, #233). spouse is the column that moves.
const ROW_MALE: ElementCycleRow = {
  power: 'YANG',
  friend: 'WOOD',
  work: 'FIRE',
  career: 'METAL',
  fortune: 'EARTH',
  spouse: 'EARTH',
  supporter: 'WATER',
}
const ROW_FEMALE: ElementCycleRow = { ...ROW_MALE, spouse: 'METAL' }

function sourceFor(elementTh: string, cycle: ElementCycleRow | null): ElementResultSource {
  const mascot = buildMascotPaths('ชวด', elementTh)
  if (!mascot) throw new Error(`fixture is wrong, not the component: no mascot for ${elementTh}`)
  return { mascot, cycle }
}

/** Every string the app could render for a gender. Assert against the WHOLE screen, not a prop. */
const GENDER_WORDS = /ชาย|หญิง|MALE|FEMALE/i

describe('05-element — facets come from the row, never from a guess', () => {
  it('maps every column to its own row, in the order v1 renders them', () => {
    expect(buildFacets(ROW_MALE)).toEqual([
      { label: 'เพื่อน/พี่น้อง/หุ้นส่วน', element: 'WOOD' },
      { label: 'เรียน/ทำงาน/ลงทุน', element: 'FIRE' },
      { label: 'หน้าที่การงาน', element: 'METAL' },
      { label: 'โชคลาภ', element: 'EARTH' },
      { label: 'คู่ครอง', element: 'EARTH' },
      { label: 'ผู้สนับสนุน/ส่งเสริม', element: 'WATER' },
    ])
  })

  it('returns nothing at all when one column is unreadable — five of six is a silent drop', () => {
    expect(buildFacets({ ...ROW_MALE, fortune: 'PLASTIC' })).toBeNull()
    expect(buildFacets({ ...ROW_MALE, spouse: '' })).toBeNull()
  })

  it('states the polarity only when the row carries one', () => {
    expect(polarityTitle('ธาตุไม้', 'YIN')).toBe('ธาตุไม้หยิน')
    expect(polarityTitle('ธาตุไม้', 'YANG')).toBe('ธาตุไม้หยาง')
    expect(polarityTitle('ธาตุไม้', null)).toBe('ธาตุไม้')
    expect(polarityTitle('ธาตุไม้', 'STRONG')).toBe('ธาตุไม้')
  })

  it('hides the whole facet block when there is no row, and says why', () => {
    render(<ElementResultScreen source={sourceFor('ไม้', null)} />)

    expect(screen.queryByTestId('facet-list')).toBeNull()
    expect(screen.getByTestId('facet-unavailable').textContent).toMatch(/ข้อมูลโปรไฟล์ของคุณยังไม่ครบ/)
    // the heading above it is still correct — that is exactly why borrowed values would be believed
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/ธาตุของคุณคือ ไม้/)
  })

  // Named for what it actually guards. The first version of this test only looked for the WORDS
  // ชาย/หญิง/MALE/FEMALE — and a guessed row does not contain them, it contains element names. It
  // stayed GREEN under mutant M1 while the bug it was named for was live. What leaks a guessed
  // gender is the VALUES: คู่ครอง is EARTH for MALE and METAL for FEMALE, so any facet content at
  // all, when there is no row, is a gender that was invented somewhere upstream.
  it('never prints a gender-derived value when the row is missing', () => {
    render(<ElementResultScreen source={sourceFor('ไม้', null)} />)
    const text = document.body.textContent ?? ''

    for (const label of ['เพื่อน/พี่น้อง/หุ้นส่วน', 'โชคลาภ', 'คู่ครอง', 'ผู้สนับสนุน/ส่งเสริม']) {
      expect(text).not.toContain(label)
    }
    expect(text).not.toMatch(GENDER_WORDS)
  })

  it('renders the row it was handed — the คู่ครอง facet moves with it', () => {
    render(<ElementResultScreen source={sourceFor('ไม้', ROW_MALE)} />)
    const male = screen.getByText('คู่ครอง').closest('div')?.textContent ?? ''
    cleanup()

    render(<ElementResultScreen source={sourceFor('ไม้', ROW_FEMALE)} />)
    const female = screen.getByText('คู่ครอง').closest('div')?.textContent ?? ''

    expect(male).toMatch(/ธาตุดิน/)
    expect(female).toMatch(/ธาตุทอง/)
    expect(male).not.toBe(female) // the two rows must not collapse into one rendering
  })

  it('drops the authored-copy blocks for an element nobody has written yet (#237)', () => {
    render(<ElementResultScreen source={sourceFor('ทอง', ROW_MALE)} />)

    expect(screen.queryByText('ลักษณะเด่นของคุณ')).toBeNull()
    expect(screen.queryByText('คำแนะนำเบื้องต้น')).toBeNull()
    // ...while everything that IS real still renders
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/ธาตุของคุณคือ ทอง/)
    expect(screen.getByTestId('facet-list')).toBeTruthy()
    // and no ธาตุไม้ copy leaked in to fill the hole
    expect(document.body.textContent ?? '').not.toMatch(/สัญลักษณ์แห่งความเจริญรุ่งเรือง/)
  })

  // Found by opening the PNG, not by a count: with no row the block's heading collapsed to
  // "ธาตุทอง" sitting right under the h1 "ธาตุของคุณคือ ทอง". Every harness number was green.
  it('names the block instead of echoing the h1 when there is no row', () => {
    render(<ElementResultScreen source={sourceFor('ทอง', null)} />)
    const h2s = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '')

    expect(h2s).toContain('ธาตุที่ส่งผลในแต่ละด้าน')
    expect(h2s).not.toContain('ธาตุทอง')
  })

  it('still states the polarity when the row carries one', () => {
    render(<ElementResultScreen source={sourceFor('ไม้', ROW_MALE)} />)
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toContain(
      'ธาตุไม้หยาง',
    )
  })

  // The API reading is per-person (60 ดิถี); the local constant is per-element and on its way out
  // (#237). If precedence ever inverted, a user whose call SUCCEEDED would still read the generic
  // paragraph — and every count on this screen would stay green while it happened.
  it('prefers the service reading over the local copy', () => {
    render(
      <ElementResultScreen
        source={{
          ...sourceFor('ไม้', ROW_MALE),
          summary: {
            tagline: 'คำเปิดเฉพาะบุคคลจาก bazi',
            traits: ['ลักษณะเฉพาะบุคคล ก'],
            advice: [{ key: 'talent', label: 'การใช้จุดแข็ง', text: 'คำแนะนำเฉพาะบุคคล ก' }],
          },
        }}
      />,
    )
    const text = document.body.textContent ?? ''

    expect(text).toContain('คำเปิดเฉพาะบุคคลจาก bazi')
    expect(text).toContain('ลักษณะเฉพาะบุคคล ก')
    expect(text).toContain('คำแนะนำเฉพาะบุคคล ก')
    // the service LABELS each advice item; dropping it would leave two identical-looking paragraphs
    expect(text).toContain('การใช้จุดแข็ง')
    // and the ธาตุไม้ paragraph must be gone, not merely pushed further down the page
    expect(text).not.toMatch(/สัญลักษณ์แห่งความเจริญรุ่งเรือง/)
  })

  it('keeps art and facets when the reading is missing — a dead API is not a dead screen', () => {
    render(<ElementResultScreen source={{ ...sourceFor('ไม้', ROW_MALE), summary: null }} />)

    expect(screen.getByTestId('facet-list').children).toHaveLength(6)
    expect(document.querySelector('img')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/ธาตุของคุณคือ ไม้/)
  })

  // An index standing in for an identity is how #190's compass shipped wrong. Reversing the array
  // must reverse the glyphs with it, not leave them pinned to slot 0 and slot 1.
  it('picks the advice glyph by key, not by array position', () => {
    const advice = [
      { key: 'talent', label: 'จุดแข็ง', text: 'ก' },
      { key: 'health', label: 'สุขภาพ', text: 'ข' },
    ]
    // The SVG PATHS, not the class — Leaf and Activity are handed the same className here, so a
    // class-based comparison would have been equal-to-equal and passed no matter what the component
    // did. (It did exactly that on the first draft of this test.)
    const glyphs = (nodes: Element[]) => nodes.map((li) => li.querySelector('svg')?.innerHTML ?? '')

    render(<ElementResultScreen source={{ ...sourceFor('ไม้', ROW_MALE), summary: { tagline: 't', traits: [], advice } }} />)
    const forward = glyphs(Array.from(document.querySelectorAll('li')))
    cleanup()

    render(<ElementResultScreen source={{ ...sourceFor('ไม้', ROW_MALE), summary: { tagline: 't', traits: [], advice: [...advice].reverse() } }} />)
    const reversed = glyphs(Array.from(document.querySelectorAll('li')))

    // control FIRST: if the two glyphs are indistinguishable, everything below is equal-to-equal
    expect(forward).toHaveLength(2)
    expect(forward[0]).not.toBe(forward[1])
    expect(reversed).toEqual([...forward].reverse())
  })

  it('shows the card art for (นักษัตร, ธาตุ), not for the element alone', () => {
    render(<ElementResultScreen source={sourceFor('ไฟ', ROW_MALE)} />)
    const src = (document.querySelector('img') as HTMLImageElement | null)?.getAttribute('src') ?? ''
    expect(decodeURIComponent(src)).toMatch(/01_ชวด-ไฟ\.jpg/)
  })
})
