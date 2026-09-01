// #585 ก้อน 3 — teeth on the THREE-SLOT form, asserted through the real CompatibilityScreen.
//
// WHY NOT TEST colleague-candidates.ts HARDER INSTEAD. That module already has its own spec and it is
// pure, so it can be green while the screen renders one row, or wires every row to slot 0, or lets three
// rows answer to a single testid. The claims below are all about the SCREEN: how many rows exist, that
// they are distinguishable, and that a pick lands in the row that asked for it.
//
// 🔴 THE SURFACE SIZE IS ASSERTED, NOT ASSUMED. "every candidate row is empty" is green over zero rows,
// so the count is checked first and separately — a screen that renders no slots at all must fail here,
// loudly, instead of passing an emptiness check about nothing.
//
// .tsx so the legacy `for f in scripts/*.test.ts` tsx lane never sees it, and REGISTERED in
// vitest.config.mts `include` — an unregistered .test.tsx is run by nothing at all and looks exactly
// like a passing spec from the outside.
//
// MUTANT CONTRACT — each flips real behaviour, each must go RED here:
//   M1  render one candidate row instead of `candidates.slots`        → the count case RED
//   M2  child testids go back to the hardcoded `compat-person2-*`     → the distinct-ids case RED
//   M3  `setSlotOpen(slot.index)` → `setSlotOpen(0)`                  → the lands-in-slot-1 case RED
//   M4  canProceed requires all three (`chosen.length === 3`)         → the enabled-at-one case RED
//   M5  colleague takes the single-row branch (`maxCandidates >= 1`)  → the count case RED
//   M6  the two tagline lines collapse into one element               → the authored-break case RED
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const { useCompatibility, getDetail } = vi.hoisted(() => ({
  useCompatibility: vi.fn(),
  getDetail: vi.fn(),
}))

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(), query: {}, pathname: '/v2/service/compatibility' }) }))
vi.mock('@/features/v2-service/hooks/useCompatibilityResult', () => ({ calculateCompatibility: vi.fn() }))
vi.mock('@/features/auth/hooks/useV2Logout', () => ({ useV2Logout: () => ({ logout: vi.fn() }) }))
vi.mock('@/features/v2-shell/components/Menubar', () => ({ Menubar: () => null }))
vi.mock('@/features/v2-shell/components/TopBarBell', () => ({ TopBarBell: () => null }))
vi.mock('@/features/v2-shell/components/TopBarAvatar', () => ({ TopBarAvatar: () => null }))
vi.mock('@/features/v2-shell/components/LoadingScreen', () => ({ LoadingScreen: () => <div data-testid="loading" /> }))
vi.mock('react-cookie', () => ({ useCookies: () => [{ 'cookie-mumate-id': 'u-1' }] }))
vi.mock('@/features/v2-service/hooks/useCompatibility', () => ({ useCompatibility: () => useCompatibility() }))

// The friend-detail read behind slot enrichment. Answering `null` is the real "detail unavailable" path:
// the row keeps the name it was given and never fabricates a birthdate.
vi.mock('@/constants/api/api-member-with-friend-get-detail', () => ({
  MemberWithFriendGetDetailApi: (...args: unknown[]) => getDetail(...args),
}))

// The picker's CHROME is not what these cases are about — which slot receives the person is. This stub
// stands in for the modal and hands back a fixed friend on demand, so the assertion is about the screen's
// wiring rather than about driving a list UI.
vi.mock('@/features/v2-service/components/CompatSelectFriendModal', () => ({
  CompatSelectFriendModal: ({ onSelect }: { onSelect: (input: unknown) => void }) => (
    <>
      <button type="button" data-testid="pick-a"
        onClick={() => onSelect({ id: 'f-1', name: 'กัสสรนาดี', surname: '', picture_url: '', dob: '', time: '' })} />
      <button type="button" data-testid="pick-b"
        onClick={() => onSelect({ id: 'f-9', name: 'ปินหยก', surname: '', picture_url: '', dob: '', time: '' })} />
    </>
  ),
}))

import { CompatibilityScreen } from '@/features/v2-service/components/CompatibilityScreen'
import { resolveCompatibilityKind } from '@/features/v2-service/compatibility'

const COLLEAGUE = resolveCompatibilityKind('colleague')!
const LOVE = resolveCompatibilityKind('love')!
const PERSON1 = { id: 'u-1', name: 'ฟีม', dob: '1990-01-01', time: '08:00', gender: 'MALE' }

function mountColleague() {
  useCompatibility.mockReturnValue({
    person1: PERSON1,
    person2: null,
    matchingType: 'FRIEND',
    canViewResult: false,
    loadingPerson1: false,
    loadingPerson2: false,
    selectFriend: vi.fn(),
    clearFriend: vi.fn(),
    createFriend: vi.fn(),
    updateFriendProfile: vi.fn(),
  })
  render(<CompatibilityScreen config={COLLEAGUE} />)
}

beforeEach(() => {
  window.localStorage.clear()
  getDetail.mockResolvedValue(null)
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })))
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('#585 ก้อน 3 — the three co-worker slots', () => {
  it('เพื่อนร่วมงานมีช่องครบ 3 ช่อง ไม่ใช่ช่องเดียว', () => {
    mountColleague()
    const rows = screen.queryAllByTestId(/^compat-candidate-\d+$/)
    // the count FIRST: every other case below would pass vacuously over zero rows
    expect(rows).toHaveLength(COLLEAGUE.maxCandidates)
    expect(COLLEAGUE.maxCandidates).toBe(3)
    // …and the single-pair row is NOT also on screen — two pickers for one job
    expect(screen.queryByTestId('compat-person2')).toBeNull()
  })

  it('ทั้งสามช่องตอบคนละ testid ⇒ เลือกแถวที่สองได้จริง ไม่ใช่ได้แถวแรกทุกครั้ง', () => {
    mountColleague()
    const ids = [0, 1, 2].map((i) => screen.getByTestId(`compat-candidate-${i}-empty`).textContent)
    expect(ids).toHaveLength(3)
    // all three say the same words — the point is that three DISTINCT nodes answer, which
    // getByTestId enforces by throwing on a duplicate.
    expect(new Set([0, 1, 2].map((i) => screen.getByTestId(`compat-candidate-${i}`))).size).toBe(3)
  })

  /** open the picker from a slot and choose one of the two stub people */
  async function pickInto(slot: number, who: 'a' | 'b') {
    screen.getByTestId(`compat-candidate-${slot}`).click()
    // the modal mounts on a state update, so it has to be awaited — reading it synchronously would be
    // asserting on the frame BEFORE the one the user sees
    ;(await screen.findByTestId(`pick-${who}`)).click()
  }

  it('คนที่สองลงช่องที่สอง ❌ ไม่ได้ไปทับคนแรก', async () => {
    mountColleague()
    await pickInto(0, 'a')
    await waitFor(() => expect(screen.getByTestId('compat-candidate-0-name').textContent).toBe('กัสสรนาดี'))
    await pickInto(1, 'b')
    await waitFor(() => expect(screen.getByTestId('compat-candidate-1-name').textContent).toBe('ปินหยก'))
    // 🔴 the discriminator: with every row wired to slot 0 (mutant M3) the second pick would REPLACE
    // กัสสรนาดี instead of landing beside her, and row 1 would still be empty.
    expect(screen.getByTestId('compat-candidate-0-name').textContent).toBe('กัสสรนาดี')
  })

  it('กดช่องที่สองตอนฟอร์มยังว่าง คนไปลงช่องแรก — พฤติกรรมที่รู้ตัว ยังไม่ได้ให้ฟีมเคาะ', async () => {
    mountColleague()
    await pickInto(1, 'b')
    // colleague-candidates.setCandidateAt refuses to leave a hole in the middle ("a hole is not a state
    // the form has"), so choosing into an empty slot 1 appends at 0. The row the user TAPPED is not the
    // row that fills, which is a visible jump nothing on screen explains.
    // This case exists so that behaviour cannot change silently in either direction: it is asserted, and
    // it is named on the ticket as a question rather than left as a discovery.
    await waitFor(() => expect(screen.getByTestId('compat-candidate-0-name').textContent).toBe('ปินหยก'))
    expect(screen.getByTestId('compat-candidate-1-empty')).toBeTruthy()
  })

  it('ปุ่มดูผลลัพธ์ปิดตอนยังไม่เลือกใคร และเปิดตั้งแต่คนแรก (Figma 720:27747)', async () => {
    mountColleague()
    const button = screen.getByTestId('compat-view-result') as HTMLButtonElement
    expect(button.disabled).toBe(true)

    screen.getByTestId('compat-candidate-0').click()
    ;(await screen.findByTestId('pick-a')).click()
    // ONE person is enough. Requiring three would make the two empty slots mandatory, which is the
    // opposite of the frame that draws this button live with one row filled.
    await waitFor(() => expect((screen.getByTestId('compat-view-result') as HTMLButtonElement).disabled).toBe(false))
  })

  it('คำโปรยขึ้นสองบรรทัดตามที่ออกแบบไว้ ❌ ไม่ใช่ก้อนเดียวให้เบราว์เซอร์ตัดเอง', () => {
    mountColleague()
    const tagline = screen.getByTestId('compat-tagline')
    const lines = Array.from(tagline.querySelectorAll('span')).map((s) => s.textContent)
    // Thai has no word spaces: a browser-chosen break can split a word mid-way and a textContent
    // assertion cannot see it happen. Two elements make the authored break a thing a test can point at.
    expect(lines).toEqual([COLLEAGUE.tagline[0], COLLEAGUE.tagline[1]])
    expect(lines).toHaveLength(2)
  })

  it('จอคู่รักไม่ได้ถูกลากมาด้วย — ยังเป็นช่องเดียวเหมือนเดิม', () => {
    useCompatibility.mockReturnValue({
      person1: PERSON1,
      person2: null,
      matchingType: 'LOVE',
      canViewResult: false,
      loadingPerson1: false,
      loadingPerson2: false,
      selectFriend: vi.fn(),
      clearFriend: vi.fn(),
      createFriend: vi.fn(),
      updateFriendProfile: vi.fn(),
    })
    render(<CompatibilityScreen config={LOVE} />)
    expect(screen.getByTestId('compat-person2')).toBeTruthy()
    expect(screen.queryAllByTestId(/^compat-candidate-\d+$/)).toHaveLength(0)
  })
})
