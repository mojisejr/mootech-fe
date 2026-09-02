// #585 ก้อน 4 — the WORDS, through the real screen. The sibling file proves the five causes come out of
// the transport distinct; this one proves they stay distinct all the way to what a person reads.
//
// 🔴 WHY BOTH FILES. A mapper that returns five different labels satisfies scripts/work-compare-call.ts
// while the screen prints one sentence for all five, and that screen is what mootech-fe#593 was about:
// nobody reads a label. The distinctness has to be asserted where the text is.
//
// MUTANT CONTRACT — each flips real behaviour, each must go RED here:
//   C1  point 'engine-down' at the quota copy          → 2 RED (engine-down-vs-quota, five-sentences)
//   C3  return a fixed id instead of calling the POST   → 4 RED
//   C4  navigate to /result/<id> instead of /work/<id>  → destination RED
//   C5  never set calculating                          → both waiting-state cases RED
//
// Fired 2026-09-02 with the mutated line PRINTED each time, because "the mutant survived" and "the mutant
// never landed" look identical on screen. That is not a rhetorical point here: the first C4 attempt used a
// perl one-liner that failed to compile, the file was never edited, and the suite went red anyway on a
// waitFor timeout — a tooth I would have reported as proven and never was. Re-landed with a checked
// substitution (assert exactly one match) and it then failed on the ASSERTION, which is the different
// failure class. The clean file was also run 4 times at the same SHA to show the red was the mutant.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { useCompatibility, getDetail, workCreate, push } = vi.hoisted(() => ({
  useCompatibility: vi.fn(),
  getDetail: vi.fn(),
  workCreate: vi.fn(),
  push: vi.fn(),
}))

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({ useRouter: () => ({ push, query: {}, pathname: '/v2/service/compatibility' }) }))
vi.mock('@/features/v2-service/hooks/useCompatibilityResult', () => ({ calculateCompatibility: vi.fn() }))
vi.mock('@/features/auth/hooks/useV2Logout', () => ({ useV2Logout: () => ({ logout: vi.fn() }) }))
vi.mock('@/features/v2-shell/components/Menubar', () => ({ Menubar: () => null }))
vi.mock('@/features/v2-shell/components/TopBarBell', () => ({ TopBarBell: () => null }))
vi.mock('@/features/v2-shell/components/TopBarAvatar', () => ({ TopBarAvatar: () => null }))
// 🔴 NOT stubbed to null, unlike the sibling ก้อน 3 file: the waiting state is one of the things under
// test here, so the loader has to render text that can be read back.
vi.mock('@/features/v2-shell/components/LoadingScreen', () => ({
  LoadingScreen: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div data-testid="loading"><p data-testid="loading-title">{title}</p><p data-testid="loading-sub">{subtitle}</p></div>
  ),
}))
vi.mock('react-cookie', () => ({ useCookies: () => [{ 'cookie-mumate-id': 'u-1' }] }))
vi.mock('@/features/v2-service/hooks/useCompatibility', () => ({ useCompatibility: () => useCompatibility() }))
vi.mock('@/constants/api/api-member-with-friend-get-detail', () => ({
  MemberWithFriendGetDetailApi: (...a: unknown[]) => getDetail(...a),
}))
vi.mock('@/constants/api/api-v2-matching', () => ({ V2MatchingWorkCreateApi: (...a: unknown[]) => workCreate(...a) }))
vi.mock('@/features/v2-service/components/CompatSelectFriendModal', () => ({
  CompatSelectFriendModal: ({ onSelect }: { onSelect: (input: unknown) => void }) => (
    <>
      <button type="button" data-testid="pick-a"
        onClick={() => onSelect({ id: 'f-1', name: 'กัสสรนาดี', surname: '', picture_url: '', dob: '1990-01-01', time: '08:00' })} />
      <button type="button" data-testid="pick-b"
        onClick={() => onSelect({ id: 'f-9', name: 'ปินหยก', surname: '', picture_url: '', dob: '1991-02-02', time: '09:00' })} />
    </>
  ),
}))

import { CompatibilityScreen } from '@/features/v2-service/components/CompatibilityScreen'
import { resolveCompatibilityKind } from '@/features/v2-service/compatibility'

const COLLEAGUE = resolveCompatibilityKind('colleague')!
const PERSON1 = { id: 'u-1', name: 'ฟีม', dob: '1990-01-01', time: '08:00', gender: 'MALE' }

function mount() {
  useCompatibility.mockReturnValue({
    person1: PERSON1, person2: null, matchingType: 'FRIEND', canViewResult: false,
    loadingPerson1: false, loadingPerson2: false,
    selectFriend: vi.fn(), clearFriend: vi.fn(), createFriend: vi.fn(),
    updateFriendProfile: vi.fn(), title: 'ดูดวงเพื่อนร่วมงาน',
  })
  render(<CompatibilityScreen config={COLLEAGUE} />)
}

/**
 * choose one co-worker so the button is live, then press it.
 *
 * ⚠️ CLEARS localStorage FIRST. #265's one-minute cooldown is keyed by user id and lives there, and the
 * press below starts it — so a second mount inside the same case finds the button disabled for a REAL
 * reason that has nothing to do with what that case is testing. Clearing here rather than only in
 * `beforeEach` is what lets a case mount twice and compare two answers.
 */
async function pickOneAndPress() {
  window.localStorage.clear()
  screen.getByTestId('compat-candidate-0').click()
  ;(await screen.findByTestId('pick-a')).click()
  const btn = () => screen.getByTestId('compat-view-result') as HTMLButtonElement
  await waitFor(() => expect(btn().disabled).toBe(false))
  fireEvent.click(btn())
}

const http = (status: number, data: unknown = {}) => ({ ok: false, kind: 'http' as const, status, data })

/** the two sentences the screen is showing right now, or null when no failure is up */
function shownLines(): string | null {
  const el = document.querySelector('[data-testid="compat-result-error"]')
  return el ? (el.textContent ?? '') : null
}

beforeEach(() => {
  window.localStorage.clear()
  getDetail.mockResolvedValue(null)
  push.mockResolvedValue(true)
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })))
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('#585 ก้อน 4 — the press, the wait and the five sentences', () => {
  it('กดปุ่มแล้วยิง POST พร้อม friend_ids ของคนที่เลือกจริง', async () => {
    workCreate.mockResolvedValue({ ok: true, status: 200, data: { ok: true, matching_id: 'm-7' } })
    mount()
    await pickOneAndPress()
    await waitFor(() => expect(workCreate).toHaveBeenCalledTimes(1))
    // the ARGUMENT, not just that something fired: sending the wrong ids is a screen that looks fine
    expect(workCreate).toHaveBeenCalledWith(['f-1'])
  })

  it('สำเร็จแล้วพาไปจอผลเพื่อนร่วมงาน ❌ ไม่ใช่จอคู่รัก', async () => {
    workCreate.mockResolvedValue({ ok: true, status: 200, data: { ok: true, matching_id: 'm-7' } })
    mount()
    await pickOneAndPress()
    await waitFor(() => expect(push).toHaveBeenCalledWith('/v2/service/compatibility/work/m-7'))
    // the pair lane's destination would 404 the colleague result — assert it is NOT where we went
    expect(push).not.toHaveBeenCalledWith('/v2/service/compatibility/result/m-7')
  })

  it('ระหว่างรอ จอบอกว่ากำลังคำนวณ ❌ ไม่ค้างเฉย ๆ และคำของฟีมถูกใช้ต่อคำต่อคำ', async () => {
    let release: (v: unknown) => void = () => {}
    workCreate.mockReturnValue(new Promise((r) => { release = r }))
    mount()
    await pickOneAndPress()
    expect((await screen.findByTestId('loading-title')).textContent).toContain('เพื่อนร่วมงาน')
    // ฟีม's line is reused, not reworded — compat-loading-copy.ts says so in as many words
    expect(screen.getByTestId('loading-sub').textContent).toContain('กรุณาอย่าปิดหน้าจอ')
    // and the form is GONE while it waits — a wait behind a live button invites a second press
    expect(screen.queryByTestId('compat-view-result')).toBeNull()
    release({ ok: true, status: 200, data: { ok: true, matching_id: 'm-7' } })
  })

  it('เลือกหลายคน จอบอกจำนวนคนระหว่างรอ ⇒ อธิบายว่าทำไมนาน ❌ ไม่ใช่พิมพ์จำนวนวินาที', async () => {
    let release: (v: unknown) => void = () => {}
    workCreate.mockReturnValue(new Promise((r) => { release = r }))
    mount()
    screen.getByTestId('compat-candidate-0').click()
    ;(await screen.findByTestId('pick-a')).click()
    await waitFor(() => expect((screen.getByTestId('compat-view-result') as HTMLButtonElement).disabled).toBe(false))
    screen.getByTestId('compat-candidate-1').click()
    ;(await screen.findByTestId('pick-b')).click()
    await waitFor(() => expect(screen.queryAllByTestId(/^compat-candidate-\d+-name$/).length).toBeGreaterThan(1))
    fireEvent.click(screen.getByTestId('compat-view-result'))
    const title = await screen.findByTestId('loading-title')
    expect(title.textContent).toContain('2 คน')
    // 🔴 a printed number of SECONDS is a promise the screen cannot keep on a slow network; the count is
    // a fact we hold. This asserts we did not quietly switch to one.
    expect(title.textContent).not.toMatch(/วินาที/)
    release({ ok: true, status: 200, data: { ok: true, matching_id: 'm-7' } })
  })

  it('🔴 เครื่องคำนวณล่ม ต้องไม่พูดประโยคเดียวกับสิทธิ์หมด', async () => {
    // mootech-fe#593 at the screen's layer. Two mounts, two answers, two readings compared directly.
    workCreate.mockResolvedValue(http(503))
    mount()
    await pickOneAndPress()
    const down = await waitFor(() => { const t = shownLines(); expect(t).toBeTruthy(); return t })
    cleanup()

    workCreate.mockResolvedValue(http(410, { error: 'quota' }))
    mount()
    await pickOneAndPress()
    const quota = await waitFor(() => { const t = shownLines(); expect(t).toBeTruthy(); return t })

    expect(down).not.toBe(quota)
    // 🔴 NOT a ban on the word "สิทธิ์". The first version of this line banned it and went red against
    // copy that is exactly right: engine-down says "ยังไม่ถูกตัดสิทธิ์", which DENIES the quota reading
    // rather than borrowing it — the direct opposite of mootech-fe#593's symptom. A word ban cannot tell
    // "you are out of allowance" from "you were not charged". Neither sentence may contain the other, and
    // engine-down must actively say the user is not at fault, because "ลองใหม่ภายหลัง" on its own is the
    // wording both failures would happily share.
    expect(down).not.toContain(quota as string)
    expect(quota).not.toContain(down as string)
    expect(down).toContain('ไม่ใช่ข้อมูลของคุณผิด')
    expect(quota).not.toContain('ไม่ใช่ข้อมูลของคุณผิด')
  })

  it('ห้าสาเหตุอ่านออกมาเป็นห้าประโยค ไม่ซ้ำกันเลย', async () => {
    const answers = [http(410, { error: 'q' }), http(404), http(422), http(400, { max: 3 }), http(503)]
    const seen: string[] = []
    for (const a of answers) {
      workCreate.mockResolvedValue(a)
      mount()
      await pickOneAndPress()
      seen.push(await waitFor(() => { const t = shownLines(); expect(t).toBeTruthy(); return t as string }))
      cleanup()
    }
    // surface size first, then distinctness — five slots that collapsed to one still fill the array
    expect(seen).toHaveLength(5)
    expect(new Set(seen).size).toBe(5)
  })
})
