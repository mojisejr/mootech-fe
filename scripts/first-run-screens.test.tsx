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
