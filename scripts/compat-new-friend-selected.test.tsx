// #570 — WIRING teeth: the friend you just created IS the friend the screen now holds.
//
// WHY THIS FILE EXISTS. ฟีม hit this by hand: "เพิ่มดวงคนใหม่แล้วไม่ผูกดวงเลย ต้องกดดูที่เลือกเพื่อน/คู่รัก
// อีกที แล้วจะเจอรายชื่อที่พึ่งเพิ่มไป". The value needed to fix it was already in hand — v1's create echoes
// the saved row back — and the screen simply dropped it (CompatibilityScreen.tsx `onCreate` refetched quota
// and returned). Every pure test in scripts/compatibility.test.ts stayed green through that whole bug,
// because a mapper nobody calls maps correctly. So the assertion that cannot be faked is made on the hook's
// OBSERVABLE STATE after createFriend resolves: person2, and the value canViewResult reads.
//
// 🔴 MUTANT CONTRACT (each turns a named test below red):
//   M1  drop `if (input) selectFriend(input)` from createFriend     → "คนที่เพิ่งสร้างกลายเป็น person2" reddens
//   M2  select with the FORM's data instead of the created row's id → "id ที่วางคือ id ที่ฐานข้อมูลคืนมา" reddens
//   M3  createdFriendToSelectInput returns an input when id is ''   → "ไม่มี id แปลว่าไม่ได้เลือก" reddens
//   M4  friendInputToPerson ignores input.dob/input.time            → "วันเกิดมาทันทีไม่ต้องรอ detail" reddens
//   M5  create failure still selects                                → "สร้างไม่สำเร็จห้ามแตะ person2" reddens
//
// .tsx = invisible to the pre-push tsx lane by extension; registered in vitest.config.mts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, act, cleanup } from '@testing-library/react'

const cookies: Record<string, string> = {}
vi.mock('react-cookie', () => ({ useCookies: () => [cookies] }))

const userGet = vi.fn()
const createApi = vi.fn()
const detailApi = vi.fn()
const updateProfileApi = vi.fn()
vi.mock('@/constants/api/api-user-get', () => ({ UserGetById: (...a: unknown[]) => userGet(...a) }))
vi.mock('@/constants/api/api-member-with-friend-create', () => ({
  MemberWithFriendCreateApi: (...a: unknown[]) => createApi(...a),
}))
vi.mock('@/constants/api/api-member-with-friend-get-detail', () => ({
  MemberWithFriendGetDetailApi: (...a: unknown[]) => detailApi(...a),
}))
vi.mock('@/constants/api/api-member-with-friend-update-profile', () => ({
  MemberWithFriendUpdateProfileWithStatusApi: (...a: unknown[]) => updateProfileApi(...a),
}))

import { useCompatibility } from '@/features/v2-service/hooks/useCompatibility'
import { resolveCompatibilityKind } from '@/features/v2-service/compatibility'
import { createdFriendToSelectInput, friendInputToPerson } from '@/features/v2-service/compatibility-api'

const CONFIG = resolveCompatibilityKind('love')!

const FORM = {
  name: 'โปเตโต้',
  birthDay: '1992-02-02',
  time: '09:30',
  isRememberTime: true,
  imageProfile: 'https://x/f.png',
  gender: 'FEMALE' as const,
}

// ✓ SHAPE TRACED, NOT GUESSED. mootech-be member-with-friend.service.ts:127-143 builds a MemberWithFriend
// entity and returns `repository.save(entity)`, so the resolved value is the saved ROW — the generated key
// included (member-with-friend-entity.model.ts:5-6 `@PrimaryGeneratedColumn('uuid') id`). These are that
// row's fields, snake_case as the entity declares them.
const CREATED_ROW = {
  id: 'friend-uuid-1',
  user_id: 'u-1',
  name: 'โปเตโต้',
  surname: '',
  picture_url: 'https://x/f.png',
  dob: '1992-02-02',
  time: '09:30',
  is_remember_time: true,
  gender: 'FEMALE',
}

beforeEach(() => {
  cookies['cookie-mumate-id'] = 'u-1'
  cookies['cookie-mumate-name'] = 'ฟีม'
  userGet.mockReset().mockResolvedValue({ user_id: 'u-1', name: 'ฟีม', dob: '1990-01-01', time: '08:00' })
  createApi.mockReset().mockResolvedValue(CREATED_ROW)
  detailApi.mockReset().mockResolvedValue({ dob: '1992-02-02', time: '09:30' })
  updateProfileApi.mockReset()
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/** Mount the hook and wait until person1 has resolved, which is where every case below starts. */
async function mounted() {
  const r = renderHook(() => useCompatibility(CONFIG))
  await waitFor(() => expect(r.result.current.loadingPerson1).toBe(false))
  return r
}

describe('#570 — บันทึกเพื่อนใหม่แล้วชื่อต้องอยู่ในช่องเลือกทันที', () => {
  it('คนที่เพิ่งสร้างกลายเป็น person2 โดยไม่ต้องเปิดชีทเลือกอีกรอบ', async () => {
    const r = await mounted()
    expect(r.result.current.person2).toBeNull() // control: nothing selected before the create

    await act(async () => {
      const res = await r.result.current.createFriend(FORM)
      expect(res).toMatchObject({ ok: true, selected: true })
    })

    // The assertion is on STATE, not on "a function was called": a call that places the wrong person, or
    // places nobody, passes a toHaveBeenCalled check and fails this one.
    expect(r.result.current.person2).not.toBeNull()
    expect(r.result.current.person2!.name).toBe('โปเตโต้')
    // and the button the user presses next is live — DoD row 2. canViewResult is the real hook value here,
    // never a stand-in (useCompatibility.ts returns `person1 !== null && person2 !== null`).
    expect(r.result.current.canViewResult).toBe(true)
  })

  it('id ที่วางคือ id ที่ฐานข้อมูลคืนมา ไม่ใช่ค่าที่ประกอบจากฟอร์ม', async () => {
    const r = await mounted()
    await act(async () => {
      await r.result.current.createFriend(FORM)
    })
    // This is the value the result slice sends to calculate. The form has no id at all, so an implementation
    // that echoes the form cannot produce this string by accident.
    expect(r.result.current.person2!.id).toBe('friend-uuid-1')
    // and the detail read that enriches person2 was asked for THAT id, not for anything else
    await waitFor(() => expect(detailApi).toHaveBeenCalledWith('friend-uuid-1'))
  })

  it('วันเกิดมาทันทีไม่ต้องรอ detail — จอไม่เคยแสดงแถวว่าง', async () => {
    // The detail GET never resolves in this case. Before #570 that left dob/time blank until it did; the
    // created row already carries them, so the row is complete the moment the sheet closes.
    detailApi.mockReset().mockReturnValue(new Promise(() => {}))
    const r = await mounted()
    await act(async () => {
      await r.result.current.createFriend(FORM)
    })
    expect(r.result.current.person2!.dob).toBe('1992-02-02')
    expect(r.result.current.person2!.time).toBe('09:30')
  })

  it('ไม่มี id แปลว่าไม่ได้เลือก และผลลัพธ์ต้องบอกออกมา ไม่ใช่เงียบ', async () => {
    createApi.mockReset().mockResolvedValue({ ...CREATED_ROW, id: '' })
    const r = await mounted()
    let res: unknown
    await act(async () => {
      res = await r.result.current.createFriend(FORM)
    })
    // the create itself still succeeded — the friend EXISTS, we just cannot address them
    expect(res).toMatchObject({ ok: true, selected: false })
    expect(r.result.current.person2).toBeNull()
    expect(r.result.current.canViewResult).toBe(false)
    expect(detailApi).not.toHaveBeenCalled() // no id ⇒ nothing to read a detail for
  })

  it('สร้างไม่สำเร็จห้ามแตะ person2', async () => {
    createApi.mockReset().mockResolvedValue({ error: 'quota' })
    const r = await mounted()
    let res: unknown
    await act(async () => {
      res = await r.result.current.createFriend(FORM)
    })
    expect(res).toMatchObject({ ok: false })
    expect(r.result.current.person2).toBeNull()
    expect(detailApi).not.toHaveBeenCalled()
  })

  it('เลือกจากลิสต์ยังเป็นเหมือนเดิม — createFriend ไม่ได้เปลี่ยนเส้นเดิม', async () => {
    // Negative control for M4: the v1 modal gives no dob/time, and it must still yield a blank birthdate
    // that the detail fills in. If friendInputToPerson started inventing values this would go red.
    const fromModal = friendInputToPerson({ id: 'f-9', name: 'เพื่อนเก่า', picture_url: 'p' })
    expect(fromModal.dob).toBe('')
    expect(fromModal.time).toBe('')

    const r = await mounted()
    act(() => {
      r.result.current.selectFriend({ id: 'f-9', name: 'เพื่อนเก่า' })
    })
    await waitFor(() => expect(r.result.current.person2!.dob).toBe('1992-02-02')) // enriched by the detail
  })
})

describe('#570 — createdFriendToSelectInput (pure)', () => {
  it('แถวที่ครบ → input ที่ selectFriend ใช้ได้', () => {
    expect(createdFriendToSelectInput(CREATED_ROW, 'ชื่อจากฟอร์ม')).toEqual({
      id: 'friend-uuid-1',
      name: 'โปเตโต้',
      surname: '',
      picture_url: 'https://x/f.png',
      dob: '1992-02-02',
      time: '09:30',
    })
  })

  it('ไม่มี id ทุกรูปแบบ → null', () => {
    expect(createdFriendToSelectInput(null, 'ก')).toBeNull()
    expect(createdFriendToSelectInput(undefined, 'ก')).toBeNull()
    expect(createdFriendToSelectInput({}, 'ก')).toBeNull()
    expect(createdFriendToSelectInput({ id: '' }, 'ก')).toBeNull()
    expect(createdFriendToSelectInput({ id: '   ' }, 'ก')).toBeNull() // whitespace is not an id
    expect(createdFriendToSelectInput({ id: 123 as unknown as string }, 'ก')).toBeNull()
    expect(createdFriendToSelectInput({ id: 'x', error: 'boom' }, 'ก')).toBeNull()
  })

  it('แถวไม่มีชื่อ → ใช้ชื่อที่ผู้ใช้พิมพ์ ไม่ใช่ช่องว่าง', () => {
    expect(createdFriendToSelectInput({ id: 'x', name: null }, 'ชื่อจากฟอร์ม')?.name).toBe('ชื่อจากฟอร์ม')
  })
})
