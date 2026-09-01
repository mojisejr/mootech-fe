// #585 ก้อน 5 — teeth on the colleague result screen, through the real component.
//
// 🔴 THE FIXTURE IS DELIBERATELY NOT SORTED THE SAME WAY TWICE. Every entry below has `rank` and `slot`
// DISAGREE (rank 1,2,3 ↔ slot 0,2,1) — the shape บอง measured on the real end-to-end run. A fixture where
// the two happen to line up cannot tell "ordered by ranking" from "ordered by the order the user typed
// the names", and that is exactly the mistake the Figma frame makes: its mock has the same person first
// under both readings, so the frame is blind to the difference. A test built on that mock would certify
// either behaviour.
//
// MUTANT CONTRACT — each flips real behaviour, each must go RED here:
//   R1  sort entries by `slot` before rendering the list  → the list-order case RED
//   R2  feed the tabs from a slot-sorted copy             → the tabs-match-list case RED
//   R3  collapse 404 and 5xx into one message             → the two-failures-differ case RED
//   R4  drop the rolesComplete branch                     → the missing-roles case RED
//   R5  render the tab bar from entries[0] only           → the tab-count case RED
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const { getWork } = vi.hoisted(() => ({ getWork: vi.fn() }))

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(), query: {}, pathname: '/v2/service/compatibility/work/[id]' }) }))
vi.mock('@/features/v2-shell/components/Menubar', () => ({ Menubar: () => null }))
vi.mock('@/features/v2-shell/components/TopBarBell', () => ({ TopBarBell: () => null }))
vi.mock('@/features/v2-shell/components/TopBarAvatar', () => ({ TopBarAvatar: () => null }))
vi.mock('@/features/v2-shell/components/LoadingScreen', () => ({ LoadingScreen: () => <div data-testid="loading" /> }))
vi.mock('@/constants/api/api-v2-matching', () => ({ V2MatchingWorkGetDetailApi: (...a: unknown[]) => getWork(...a) }))

import { WorkResultScreen } from '@/features/v2-service/components/WorkResultScreen'

/** rank and slot disagree on purpose — see the header. */
const ENTRIES = [
  { rank: 1, slot: 0, person: { slot: 0, friendId: 'f-a', name: 'กัสสรนาดี', surname: '', pictureUrl: '' }, rankScore: 63.33, grade: 'B', ratingText: 'เข้ากันดี', roles: [{}, {}, {}], rolesComplete: true, rolesMissing: 0 },
  { rank: 2, slot: 2, person: { slot: 2, friendId: 'f-b', name: 'ปินหยก', surname: '', pictureUrl: '' }, rankScore: 51.67, grade: 'C+', ratingText: 'พอไปได้', roles: [{}, {}, {}], rolesComplete: true, rolesMissing: 0 },
  { rank: 3, slot: 1, person: { slot: 1, friendId: 'f-c', name: 'สมชาย', surname: '', pictureUrl: '' }, rankScore: 18.33, grade: 'F', ratingText: 'ยาก', roles: [{}, {}], rolesComplete: false, rolesMissing: 1 },
] as never[]

function answerOk(entries: unknown = ENTRIES) {
  getWork.mockResolvedValue({ ok: true, status: 200, data: { ok: true, matching_id: 'm-1', create_at: '2026-09-02', entries } })
}

beforeEach(() => { getWork.mockReset() })
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('#585 ก้อน 5 — the colleague result screen', () => {
  it('รายการเรียงตาม ranking ❌ ไม่ใช่ตามลำดับที่ผู้ใช้กรอก', async () => {
    answerOk()
    render(<WorkResultScreen matchingId="m-1" />)
    const list = await screen.findByTestId('work-ranked-list')
    const rows = Array.from(list.querySelectorAll('li'))
    // surface size first — every ordering claim below is vacuous over an empty list
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual(['work-ranked-1', 'work-ranked-2', 'work-ranked-3'])
    // 🔴 the discriminator: slot order would be 0,1,2 → กัสสรนาดี, สมชาย, ปินหยก
    expect(rows.map((r) => r.getAttribute('data-slot'))).toEqual(['0', '2', '1'])
  })

  it('แถบแท็บเรียงเหมือนรายการเป๊ะ ⇒ จอมีลำดับเดียว ไม่ใช่สองลำดับ', async () => {
    answerOk()
    render(<WorkResultScreen matchingId="m-1" />)
    const tabs = await screen.findByTestId('work-tabs')
    const ranks = Array.from(tabs.querySelectorAll('button')).map((b) => b.getAttribute('data-rank'))
    expect(ranks).toHaveLength(3)
    expect(ranks).toEqual(['1', '2', '3'])
    const list = screen.getByTestId('work-ranked-list')
    const listRanks = Array.from(list.querySelectorAll('li')).map((r) => r.getAttribute('data-testid')?.replace('work-ranked-', ''))
    // the claim is not "both are 1,2,3" — it is that they are the SAME sequence, from one array
    expect(ranks).toEqual(listRanks)
  })

  it('กดแท็บที่สาม แล้วบล็อกล่างเปลี่ยนเป็นคนนั้นจริง', async () => {
    answerOk()
    render(<WorkResultScreen matchingId="m-1" />)
    expect((await screen.findByTestId('work-person-name')).textContent).toBe('กัสสรนาดี')
    screen.getByTestId('work-tab-3').click()
    await waitFor(() => expect(screen.getByTestId('work-person-name').textContent).toBe('สมชาย'))
    expect(screen.getByTestId('work-person').getAttribute('data-open-rank')).toBe('3')
  })

  it('คนที่คำทำนายมาไม่ครบ จอบอกว่าขาดกี่มุมมอง ❌ ไม่ใช่โชว์เท่าที่มีเฉย ๆ', async () => {
    answerOk()
    render(<WorkResultScreen matchingId="m-1" />)
    await screen.findByTestId('work-tabs')
    // rank 1 มาครบ ⇒ ต้องไม่มีคำเตือน
    expect(screen.queryByTestId('work-roles-incomplete')).toBeNull()
    screen.getByTestId('work-tab-3').click()
    const note = await screen.findByTestId('work-roles-incomplete')
    expect(note.textContent).toContain('1')
    expect(note.textContent).toContain('3')
  })

  it('ไม่พบผลลัพธ์ กับ เปิดไม่ได้ พูดคนละประโยค', async () => {
    getWork.mockResolvedValue({ ok: false, kind: 'http', status: 404, data: {} })
    const a = render(<WorkResultScreen matchingId="m-1" />)
    const missing = await screen.findByTestId('work-result-missing')
    const missingText = missing.textContent ?? ''
    expect(screen.queryByTestId('work-result-failed')).toBeNull()
    a.unmount()

    getWork.mockResolvedValue({ ok: false, kind: 'http', status: 500, data: {} })
    render(<WorkResultScreen matchingId="m-1" />)
    const failed = await screen.findByTestId('work-result-failed')
    expect(screen.queryByTestId('work-result-missing')).toBeNull()
    // 🔴 the point is not that each renders — it is that they are DIFFERENT sentences. One tells the user
    // their link is stale; the other tells them the fault is ours. A shared blob would pass every
    // "an error is shown" assertion ever written.
    expect(failed.textContent).not.toBe(missingText)
  })

  it('เครือข่ายล่ม นับเป็นความผิดของเรา ❌ ไม่ใช่ ไม่พบ', async () => {
    getWork.mockResolvedValue({ ok: false, kind: 'network', error: new Error('offline') })
    render(<WorkResultScreen matchingId="m-1" />)
    await screen.findByTestId('work-result-failed')
    expect(screen.queryByTestId('work-result-missing')).toBeNull()
  })

  it('ตอบ 200 มาแต่ไม่มีใครให้เทียบ ไม่ถูกแต่งให้ดูเหมือนผลลัพธ์', async () => {
    answerOk([])
    render(<WorkResultScreen matchingId="m-1" />)
    await screen.findByTestId('work-result-empty')
    expect(screen.queryByTestId('work-ranked-list')).toBeNull()
  })

  it('entries ที่ไม่ใช่อาเรย์ = ล้มเหลว ❌ ไม่ใช่ว่าง', async () => {
    getWork.mockResolvedValue({ ok: true, status: 200, data: { ok: true, entries: 'nope' } })
    render(<WorkResultScreen matchingId="m-1" />)
    // an unreadable body is OUR failure; treating it as "empty" would tell the user they compared nobody
    await screen.findByTestId('work-result-failed')
  })

  it('ปุ่ม บันทึก PDF กับ แชร์ ไม่ถูกวาด ตามที่ฟีมเคาะข้อ ④', async () => {
    answerOk()
    render(<WorkResultScreen matchingId="m-1" />)
    await screen.findByTestId('work-tabs')
    // they ARE in Figma 720:29221. Not drawing them is a decision, so it gets a test — otherwise the next
    // person comparing screen to frame reads it as an omission and adds two buttons that do nothing.
    expect(screen.queryByText('บันทึก PDF')).toBeNull()
    expect(screen.queryByText('แชร์')).toBeNull()
  })
})
