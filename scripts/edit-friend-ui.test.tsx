// #266 — the UI half of "edit a friend you already added", asserted in the lane CI runs.
//
// goo's scripts/compatibility.test.ts guards the seam (prefill mapping, positional args, reason
// classification). This file guards what the person on the screen can do and — the part with teeth —
// what the screen refuses to do when it does not have the friend's real data.
//
// 🔴 The one claim NOT in here: the two row-2 controls being ≥44px tap targets. jsdom has no layout, so
// every rect is 0 and an assertion about it would pass identically whether the rule held or not. It is
// measured in a real browser instead and reported with the numbers in the ใบ — an unmeasurable assertion
// in the fast lane is worse than an honest gap (the #271 lesson, pointed the other way).
//
// MUTANT CONTRACT — each flips real behaviour, each goes RED here:
//   U1  edit sends surname: '' instead of the carried value          → "นามสกุลต้องไม่หาย" RED
//   U2  "เปลี่ยน" wired to openEditFriend (the two collapse again)     → "สองปุ่มไปคนละที่" RED
//   U3  open the sheet even when the detail read failed              → "อ่านไม่ได้ต้องไม่เปิดฟอร์มเปล่า" RED
//   U4  skip c.selectFriend after a successful save                  → "แถวต้องไม่ค้างของเก่า" RED
//   U5  noTime prefill inverted (!isRememberTime → isRememberTime)   → "เติมเวลาย้อนหลัง" RED
//   U6  save failure closes the sheet / drops the typed values       → "ล้มแล้วต้องไม่กินสิ่งที่พิมพ์" RED
//   U7  save failure shows one generic line for both reasons         → "แยกเหตุ" RED
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { push, calculateCompatibility, useCompatibility, getDetail, updateFriendProfile, selectFriend } = vi.hoisted(() => ({
  push: vi.fn(),
  calculateCompatibility: vi.fn(),
  useCompatibility: vi.fn(),
  getDetail: vi.fn(),
  updateFriendProfile: vi.fn(),
  selectFriend: vi.fn(),
}))

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({ useRouter: () => ({ push, query: {}, pathname: '/v2/service/compatibility' }) }))
vi.mock('@/features/v2-service/hooks/useCompatibilityResult', () => ({ calculateCompatibility }))
vi.mock('@/features/v2-service/hooks/useCompatibility', () => ({ useCompatibility: () => useCompatibility() }))
vi.mock('@/constants/api/api-member-with-friend-get-detail', () => ({ MemberWithFriendGetDetailApi: getDetail }))
vi.mock('@/features/auth/hooks/useV2Logout', () => ({ useV2Logout: () => ({ logout: vi.fn() }) }))
vi.mock('@/features/v2-shell/components/Menubar', () => ({ Menubar: () => null }))
vi.mock('@/features/v2-shell/components/TopBarBell', () => ({ TopBarBell: () => null }))
vi.mock('@/features/v2-shell/components/TopBarAvatar', () => ({ TopBarAvatar: () => null }))
vi.mock('@/features/v2-shell/components/LoadingScreen', () => ({ LoadingScreen: () => <div data-testid="loading" /> }))
vi.mock('react-cookie', () => ({ useCookies: () => [{ 'cookie-mumate-id': 'u-1' }] }))

import { CompatibilityScreen } from '@/features/v2-service/components/CompatibilityScreen'

const PERSON1 = { id: 'u-1', name: 'ฟีม', dob: '1990-01-01', time: '08:00', gender: 'MALE' }
const PERSON2 = { id: 'f-1', name: 'ปาล์ม', dob: '1994-05-12', time: '07:30', gender: 'FEMALE' }
const CONFIG = { matchingType: 'LOVE', title: 'เช็คความสมพงศ์', tagline: 'ด้านความรัก' } as never

/** What the detail route returns. `surname` is the field the form never shows and must never destroy. */
const DETAIL = {
  name: 'ปาล์ม', surname: 'ศรีสุข', dob: '1994-05-12', time: '07:30',
  gender: 'FEMALE', is_remember_time: true,
}

beforeEach(() => {
  window.localStorage.clear() // #265 cooldown persists on purpose; each case starts fresh
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })))
  getDetail.mockResolvedValue(DETAIL)
  updateFriendProfile.mockResolvedValue({ ok: true })
  useCompatibility.mockReturnValue({
    person1: PERSON1, person2: PERSON2, matchingType: 'LOVE', canViewResult: true,
    loadingPerson2: false, selectFriend, createFriend: vi.fn(), updateFriendProfile,
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

const openEdit = async () => {
  render(<CompatibilityScreen config={CONFIG} />)
  fireEvent.click(screen.getByTestId('compat-person2-edit'))
  await waitFor(() => expect(screen.getByTestId('add-friend-sheet')).toBeTruthy())
}
const save = () => fireEvent.click(screen.getByTestId('add-friend-save'))
const sentForm = () => updateFriendProfile.mock.calls[0][1]

describe('#266 แก้ไขข้อมูลเพื่อน — ป้ายตรงกับสิ่งที่ปุ่มทำ', () => {
  it('🔴 สองปุ่มบนแถวเพื่อนไปคนละที่: "เปลี่ยน" = เลือกคนอื่น · "แก้ไข" = แก้คนนี้', async () => {
    render(<CompatibilityScreen config={CONFIG} />)
    fireEvent.click(screen.getByTestId('compat-person2-change'))
    await waitFor(() => expect(screen.getByTestId('compat-select-modal')).toBeTruthy())
    expect(screen.queryByTestId('add-friend-sheet')).toBeNull()
    expect(getDetail).not.toHaveBeenCalled() // "เปลี่ยนคน" must not go reading this friend's data

    cleanup()
    render(<CompatibilityScreen config={CONFIG} />)
    fireEvent.click(screen.getByTestId('compat-person2-edit'))
    await waitFor(() => expect(screen.getByTestId('add-friend-sheet')).toBeTruthy())
    expect(screen.queryByTestId('compat-select-modal')).toBeNull()
    expect(getDetail).toHaveBeenCalledWith('f-1')
  })

  it('แถวบน (ข้อมูลตัวเอง) ไม่ถูกต่อสาย — ยังเป็น "เร็วๆ นี้" ตามที่ใบสั่ง', async () => {
    render(<CompatibilityScreen config={CONFIG} />)
    fireEvent.click(screen.getByTestId('compat-person1-edit'))
    await waitFor(() => expect(screen.getByTestId('coming-soon-label').textContent).toBe('แก้ไขข้อมูลของคุณ'))
    expect(screen.queryByTestId('add-friend-sheet')).toBeNull()
    expect(updateFriendProfile).not.toHaveBeenCalled()
  })

  it('เปิดมาเห็นค่าเดิมครบ ไม่ใช่ฟอร์มเปล่า', async () => {
    await openEdit()
    expect((screen.getByTestId('add-friend-name') as HTMLInputElement).value).toBe('ปาล์ม')
    expect((screen.getByTestId('add-friend-day') as HTMLSelectElement).value).toBe('12')
    expect((screen.getByTestId('add-friend-month') as HTMLSelectElement).value).toBe('5')
    expect((screen.getByTestId('add-friend-year') as HTMLInputElement).value).toBe('2537') // 1994 + 543
    expect((screen.getByTestId('add-friend-time') as HTMLInputElement).value).toBe('07:30')
    expect(screen.getByTestId('add-friend-gender-FEMALE').getAttribute('aria-pressed')).toBe('true')
  })

  it('🔴 นามสกุลที่ฟอร์มไม่แสดง ต้องไม่หายไปตอนบันทึก', async () => {
    // The data-loss case: the form has never collected a surname, so anything that rebuilds the payload
    // from the visible fields alone silently blanks a friend's real surname on every save.
    await openEdit()
    fireEvent.change(screen.getByTestId('add-friend-time'), { target: { value: '09:45' } })
    await act(async () => { save() })
    await waitFor(() => expect(updateFriendProfile).toHaveBeenCalled())
    expect(sentForm().surname).toBe('ศรีสุข')
    expect(sentForm().time).toBe('09:45')
  })

  it('🔴 เพื่อนที่ไม่เคยกรอกเวลา → เติมย้อนหลังได้ และค่าที่ "ส่งออก" ต้องเปลี่ยนจริง', async () => {
    getDetail.mockResolvedValue({ ...DETAIL, time: '', is_remember_time: false })
    await openEdit()
    // opens with "จำไม่ได้" on and the time field disabled
    expect((screen.getByTestId('add-friend-time') as HTMLInputElement).disabled).toBe(true)

    fireEvent.click(screen.getByTestId('add-friend-notime')) // untick
    fireEvent.change(screen.getByTestId('add-friend-time'), { target: { value: '06:15' } })
    await act(async () => { save() })
    await waitFor(() => expect(updateFriendProfile).toHaveBeenCalled())
    // asserted on what leaves the screen, not on the checkbox's own state
    expect(sentForm().isRememberTime).toBe(true)
    expect(sentForm().time).toBe('06:15')
  })

  it('🔴 อ่านข้อมูลเพื่อนไม่ได้ → ไม่เปิดฟอร์มเปล่า และบอกว่ายังไม่ได้แก้อะไร', async () => {
    // An empty form here reads as "this friend has no data", and saving it would overwrite the real
    // values with blanks — the same silent erase as the surname case, but for every field at once.
    getDetail.mockResolvedValue({ error: 'boom' })
    render(<CompatibilityScreen config={CONFIG} />)
    fireEvent.click(screen.getByTestId('compat-person2-edit'))
    await waitFor(() => expect(screen.getByTestId('compat-edit-load-error')).toBeTruthy())
    expect(screen.queryByTestId('add-friend-sheet')).toBeNull()
    expect(screen.getByTestId('compat-edit-load-error').textContent).toContain('ยังไม่ได้แก้อะไร')
    expect(updateFriendProfile).not.toHaveBeenCalled()
  })

  it('🔴 บันทึกสำเร็จ → ปิด sheet และอ่านเพื่อนใหม่ (แถวต้องไม่ค้างวันเกิดเดิม)', async () => {
    await openEdit()
    fireEvent.change(screen.getByTestId('add-friend-name'), { target: { value: 'ปาล์มใหม่' } })
    await act(async () => { save() })
    await waitFor(() => expect(screen.queryByTestId('add-friend-sheet')).toBeNull())
    expect(selectFriend).toHaveBeenCalledWith(expect.objectContaining({ id: 'f-1' }))
  })

  it('🔴 บันทึกล้มเหลว → sheet ยังเปิด ค่าที่พิมพ์ยังอยู่ ไม่ต้องกรอกใหม่', async () => {
    updateFriendProfile.mockResolvedValue({ ok: false, reason: 'system' })
    await openEdit()
    fireEvent.change(screen.getByTestId('add-friend-name'), { target: { value: 'ชื่อที่เพิ่งพิมพ์' } })
    await act(async () => { save() })
    await waitFor(() => expect(screen.getByTestId('add-friend-error')).toBeTruthy())
    expect(screen.getByTestId('add-friend-sheet')).toBeTruthy()
    expect((screen.getByTestId('add-friend-name') as HTMLInputElement).value).toBe('ชื่อที่เพิ่งพิมพ์')
    expect(selectFriend).not.toHaveBeenCalled() // nothing was saved, so nothing should be re-read
  })

  it('🔴 ล้มเหลวคนละเหตุ อ่านได้คนละแบบ (ภาษาโทนเดียวกับ #263)', async () => {
    updateFriendProfile.mockResolvedValue({ ok: false, reason: 'network' })
    await openEdit()
    await act(async () => { save() })
    await waitFor(() => expect(screen.getByTestId('add-friend-error')).toBeTruthy())
    const network = screen.getByTestId('add-friend-error').textContent ?? ''
    expect(network).toContain('เชื่อมต่อไม่ได้')
    cleanup()

    updateFriendProfile.mockResolvedValue({ ok: false, reason: 'system' })
    await openEdit()
    await act(async () => { save() })
    await waitFor(() => expect(screen.getByTestId('add-friend-error')).toBeTruthy())
    const system = screen.getByTestId('add-friend-error').textContent ?? ''
    expect(system).toContain('ไม่ใช่ข้อมูลของคุณผิด')
    expect(system).not.toBe(network)
  })

  it('หัวเรื่องกับปุ่มบอกว่ากำลังแก้ ไม่ใช่กำลังเพิ่ม', async () => {
    await openEdit()
    expect(screen.getByTestId('add-friend-sheet').getAttribute('aria-label')).toBe('แก้ไขข้อมูลเพื่อน')
    expect(screen.getByTestId('add-friend-save').textContent).toBe('บันทึกการแก้ไข')
    expect(screen.queryByText('หรือเชื่อมต่อบัญชี')).toBeNull() // adding accounts is meaningless while editing
    // …and the sheet says whose data this is. "ของคุณ" here would point at the exact confusion the
    // ticket removes (which row edits whom).
    expect(screen.getByText('เพศดั้งเดิมของเพื่อน')).toBeTruthy()
  })

  it('เพิ่มเพื่อนใหม่ยังทำงานเหมือนเดิม — โหมด edit ไม่ได้กลืนโหมด create', async () => {
    // negative control: every assertion above would also hold if the sheet had stopped being able to create.
    render(<CompatibilityScreen config={CONFIG} />)
    fireEvent.click(screen.getByTestId('compat-person2-change'))
    await waitFor(() => expect(screen.getByTestId('compat-select-modal')).toBeTruthy())
    fireEvent.click(screen.getByTestId('compat-select-add-new'))
    await waitFor(() => expect(screen.getByTestId('add-friend-sheet')).toBeTruthy())
    expect(screen.getByTestId('add-friend-sheet').getAttribute('aria-label')).toBe('เพิ่มเพื่อน')
    expect(screen.getByTestId('add-friend-save').textContent).toBe('บันทึก')
    expect((screen.getByTestId('add-friend-name') as HTMLInputElement).value).toBe('') // create starts empty
    expect(screen.getByText('หรือเชื่อมต่อบัญชี')).toBeTruthy()
    // #277 — this line used to assert 'เพศดั้งเดิมของคุณ', pinning the bug on purpose as a record that #266
    // touched edit only. That report became #277, so the assertion is REWRITTEN, not deleted: the fact it
    // pins (create and edit must address the same person) outlived the wording it was written against.
    expect(screen.getByText('เพศดั้งเดิมของเพื่อน')).toBeTruthy()
    expect(screen.queryByText('เพศดั้งเดิมของคุณ')).toBeNull()
  })
})
