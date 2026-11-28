// scripts/friends-list-screen.test.tsx — จอ "เพื่อนของฉัน" /v2/friends (ประชุม 24 พ.ย. ข้อ 3)
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   FL1 รายชื่อมาจาก GET /api/member-with-friend เท่านั้น ❌ จากจำนวนชวนมา / ปั้นแถว
//   FL2 "โหลดไม่สำเร็จ" ต้องไม่หน้าตาเหมือน "ยังไม่มีเพื่อน" (ตู๋ ② กฎเดียวกับประวัติการซื้อ) + ลองใหม่ยิงใหม่จริง
//   FL3 เป้า 5 ธาตุ/จำนวนชวนมาล้ม → รายชื่อยังต้องยืน (ของประดับห้ามทำให้รายชื่อหาย)
//   FL4 ไม่ยิง DELETE ก่อนกดยืนยัน · ยิงที่ id แถวที่เลือก · ลบสำเร็จแถวหาย · ล้มแถวยังอยู่ + บอกผู้ใช้
//   FL5 ค้นหากรองจากชื่อ/นามสกุล ไม่ค้นจาก id · ไม่พบ → บอกว่าไม่พบ ไม่ใช่ "ยังไม่มีเพื่อน"
//   FL6 ไม่ปั้นตัวเลขที่ไม่มีที่มา: แถวไม่มี "%"; วันเกิด parse ไม่ได้ → ไม่โชว์บรรทัดวันเกิด
//   FL7 accountFriendsCard: รายชื่อโหลดไม่ได้ ≠ ไม่มีเพื่อน (ถอยไปนับชวนมา) · รายชื่อว่างแต่ชวนมา > 0 ไม่พูดว่า "ชวนเพื่อนคนแรก"
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/friends', asPath: '/v2/friends', isReady: true }),
}))

import FriendsListScreen, { FRIENDS_REFERRAL_HREF, FRIENDS_COMPAT_HREF } from '@/features/v2-friends/components/FriendsListScreen'
import { accountFriendsCard, filterFriends, friendBirthText, friendName, parseFriendRows, type FriendRow } from '@/features/v2-friends/friends-model'

const row = (over: Partial<FriendRow> & { id: string }): Record<string, unknown> => ({
  user_id: 'u-1', name: 'เพื่อน', surname: '', picture_url: null, create_at: '2026-01-01T00:00:00.000Z', update_at: null,
  dob: '1995-06-15', time: '09:30', is_remember_time: true, gender: 'MALE', place_name: null, is_member: false, member_id: '', is_disable: false,
  ...over,
})

const LIST = [
  row({ id: 'f1', name: 'สมศรี', surname: 'ใจดี', dob: '1995-06-15', time: '09:30', is_remember_time: true }),
  row({ id: 'f2', name: 'มานพ', surname: '', dob: '1988-02-29', time: '', is_remember_time: false, is_member: true }),
  row({ id: 'f3', name: 'วิไล', surname: '', dob: 'not-a-date', time: '' }),
]

const GOALS = {
  referral: { invited: 2, rewardPerInviteQi: 50, earnedQi: 100 },
  element: { target: 5, collected: 2, bonusQi: 1000, elements: [
    { key: 'wood', collected: true }, { key: 'metal', collected: false }, { key: 'fire', collected: true },
    { key: 'earth', collected: false }, { key: 'water', collected: false } ] },
}

type Opt = { list?: unknown[] | 'fail' | 'bad'; missions?: unknown; referral?: unknown; deleteOk?: boolean }
const OK = (body: unknown) => ({ ok: true, status: 200, json: async () => body })
const FAIL = { ok: false, status: 500, json: async () => ({ error: 'boom' }) }

function stub({ list = LIST, missions = { missions: [], goals: GOALS }, referral = { invitedCount: 2 }, deleteOk = true }: Opt = {}) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: { method?: string }) => {
    const u = String(url)
    const method = init?.method ?? 'GET'
    if (u.includes('/api/member-with-friend') && method === 'DELETE') return deleteOk ? OK({ ok: true, id: 'f2' }) : FAIL
    if (u.includes('/api/member-with-friend')) return list === 'fail' ? FAIL : OK(list === 'bad' ? { error: 'x' } : list)
    if (u.includes('/api/missions')) return OK(missions)
    if (u.includes('/api/referral')) return OK(referral)
    return OK({})
  }))
}
const callsTo = (method: string) =>
  (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.filter((c) => ((c[1] as { method?: string } | undefined)?.method ?? 'GET') === method).map((c) => String(c[0]))

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('รายชื่อเพื่อน — แหล่งข้อมูลและข้อความ', () => {
  beforeEach(() => stub())

  it('FL1 แถวมาจาก GET /api/member-with-friend: ชื่อ+นามสกุล · วันเกิด พ.ศ. · ไม่ทราบเวลาต่อท้าย · นับ 3 คน', async () => {
    render(<FriendsListScreen />)
    const first = await waitFor(() => screen.getByTestId('friends-row-f1'))
    expect(screen.getByTestId('friends-count').textContent).toBe('3 คน')
    expect(first.textContent).toContain('สมศรี ใจดี')
    expect(first.textContent).toContain('15 มิ.ย. 2538')
    expect(first.textContent).not.toContain('ไม่ทราบเวลาเกิด')
    const second = screen.getByTestId('friends-row-f2')
    expect(second.textContent).toContain('29 ก.พ. 2531 · ไม่ทราบเวลาเกิด')
    expect(fetch).toHaveBeenCalledWith('/api/member-with-friend')
  })

  it('แตะตัวแถว → หน้าดูดวงเพื่อนคนนั้น (ข้อ 2) · ปุ่ม ··· แยกกัน', async () => {
    render(<FriendsListScreen />)
    const first = await waitFor(() => screen.getByTestId('friends-row-f1'))
    expect(first.tagName).toBe('A')
    expect(first.getAttribute('href')).toBe('/v2/friends/f1')
    expect(screen.getByTestId('friends-manage-open-f1').tagName).toBe('BUTTON')
    // กดแถวต้องไม่เปิดชีต (ไปหน้าดูดวง) — ชีตเปิดจากปุ่ม ··· เท่านั้น
    expect(screen.queryByTestId('friends-manage')).toBeNull()
  })

  it('FL6 ไม่ปั้นตัวเลข: ไม่มี "%" ในแถว · วันเกิด parse ไม่ได้ → ไม่มีบรรทัดวันเกิด', async () => {
    render(<FriendsListScreen />)
    const third = await waitFor(() => screen.getByTestId('friends-row-f3'))
    expect(third.textContent).toContain('วิไล')
    expect(third.textContent).not.toContain('25')
    for (const id of ['f1', 'f2', 'f3']) expect(screen.getByTestId(`friends-row-${id}`).textContent).not.toContain('%')
  })

  it('ลิงก์ชวนเพื่อนพาไปหน้าชวนเพื่อน พร้อมจำนวนชวนมาจาก /api/referral', async () => {
    render(<FriendsListScreen />)
    const invite = await waitFor(() => screen.getByTestId('friends-invite'))
    expect(invite.getAttribute('href')).toBe(FRIENDS_REFERRAL_HREF)
    expect(FRIENDS_REFERRAL_HREF).toBe('/v2/qi/referral')
    expect(invite.textContent).toContain('ชวนมาแล้ว 2 คน')
  })

  it('เป้า 5 ธาตุมาจาก /api/missions: ได้ 2 ธาตุ → ป้ายสำเร็จ 2 ชิ้น + "ยังขาดธาตุทอง และ ธาตุดิน และ ธาตุน้ำ"', async () => {
    render(<FriendsListScreen />)
    const card = await waitFor(() => screen.getByTestId('friends-element-goal'))
    expect(card.textContent).toContain('สะสมเพื่อนครบ 5 ธาตุ')
    expect(card.querySelectorAll('img[src*="success-mark"]').length).toBe(2)
    expect(screen.getByTestId('friends-element-goal-wood').querySelector('img[src*="success-mark"]')).toBeTruthy()
    expect(screen.getByTestId('friends-element-goal-metal').querySelector('img[src*="success-mark"]')).toBeNull()
    expect(card.textContent).toContain('ตอนนี้ยังขาดธาตุทอง และ ธาตุดิน และ ธาตุน้ำ')
  })
})

describe('FL2/FL3 ความล้มเหลวกับความว่างคนละเรื่อง', () => {
  it('🔴 FL2 รายการ 500 → "โหลดรายชื่อไม่สำเร็จ" ไม่มีคำว่ายังไม่มีเพื่อน · กดลองใหม่ยิง GET อีกรอบแล้วโชว์รายชื่อ', async () => {
    let n = 0
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/api/member-with-friend')) {
        n += 1
        return n === 1 ? FAIL : OK(LIST)
      }
      if (String(url).includes('/api/missions')) return OK({ missions: [], goals: GOALS })
      return OK({ invitedCount: 0 })
    }))
    render(<FriendsListScreen />)
    await waitFor(() => expect(screen.getByTestId('friends-error').textContent).toContain('โหลดรายชื่อไม่สำเร็จ'))
    expect(screen.queryByTestId('friends-empty')).toBeNull()
    expect(screen.queryByTestId('friends-list')).toBeNull()
    fireEvent.click(screen.getByTestId('friends-retry'))
    await waitFor(() => expect(screen.getByTestId('friends-row-f1')).toBeTruthy())
    expect(n).toBe(2)
  })

  it('🔴 FL2 body ไม่ใช่ array ({error}) → ก็คือล้มเหลว ไม่ใช่รายชื่อว่าง', async () => {
    stub({ list: 'bad' })
    render(<FriendsListScreen />)
    await waitFor(() => expect(screen.getByTestId('friends-error')).toBeTruthy())
    expect(screen.queryByTestId('friends-empty')).toBeNull()
  })

  it('🔴 FL3 เป้า 5 ธาตุ + จำนวนชวนมาล้มทั้งคู่ → รายชื่อยังอยู่ครบ ไม่มีการ์ดเป้า ไม่มีตัวเลขชวนมา', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url)
      if (u.includes('/api/member-with-friend')) return OK(LIST)
      if (u.includes('/api/missions') || u.includes('/api/referral')) return FAIL
      return OK({})
    }))
    render(<FriendsListScreen />)
    await waitFor(() => expect(screen.getByTestId('friends-row-f3')).toBeTruthy())
    expect(screen.getByTestId('friends-count').textContent).toBe('3 คน')
    expect(screen.queryByTestId('friends-element-goal')).toBeNull()
    expect(screen.getByTestId('friends-invite').textContent).not.toContain('ชวนมาแล้ว')
    expect(screen.getByTestId('friends-invite').textContent).toContain('รับ QI ทุกคนที่กรอกโค้ดของคุณ')
  })

  it('รายชื่อว่างจริง (array เปล่า) → สถานะว่าง + ทางไปหน้าดูดวงคู่ ไม่มีช่องค้นหา', async () => {
    stub({ list: [] })
    render(<FriendsListScreen />)
    const empty = await waitFor(() => screen.getByTestId('friends-empty'))
    expect(empty.textContent).toContain('ยังไม่มีเพื่อนในรายชื่อ')
    expect(screen.getByTestId('friends-empty-compat').getAttribute('href')).toBe(FRIENDS_COMPAT_HREF)
    expect(screen.queryByTestId('friends-search')).toBeNull()
    expect(screen.queryByTestId('friends-error')).toBeNull()
  })
})

describe('FL5 ค้นหา', () => {
  beforeEach(() => stub())

  it('พิมพ์ "ใจ" → เหลือแถวที่นามสกุลมีคำนี้ · นับจำนวนรวมยังอยู่ แต่หัวข้อเป็นผลการค้นหา', async () => {
    render(<FriendsListScreen />)
    await waitFor(() => screen.getByTestId('friends-row-f1'))
    fireEvent.change(screen.getByTestId('friends-search'), { target: { value: 'ใจ' } })
    expect(screen.getByTestId('friends-row-f1')).toBeTruthy()
    expect(screen.queryByTestId('friends-row-f2')).toBeNull()
    expect(screen.queryByTestId('friends-row-f3')).toBeNull()
    expect(screen.queryByTestId('friends-count')).toBeNull()
    fireEvent.click(screen.getByTestId('friends-search-clear'))
    expect(screen.getByTestId('friends-count').textContent).toBe('3 คน')
  })

  it('🔴 FL5 ไม่พบ → "ไม่พบเพื่อนที่ชื่อ …" ไม่ใช่สถานะ "ยังไม่มีเพื่อน" + ล้างคำค้นกลับมาเห็นทั้งหมด', async () => {
    render(<FriendsListScreen />)
    await waitFor(() => screen.getByTestId('friends-row-f1'))
    fireEvent.change(screen.getByTestId('friends-search'), { target: { value: 'น้ำตาล' } })
    expect(screen.getByTestId('friends-no-match').textContent).toContain('ไม่พบเพื่อนที่ชื่อ น้ำตาล')
    expect(screen.queryByTestId('friends-empty')).toBeNull()
    fireEvent.click(screen.getByTestId('friends-no-match-clear'))
    expect(screen.getAllByTestId(/^friends-row-/).length).toBe(3)
  })
})

describe('FL4 ลบเพื่อน (ชีตจัดการ)', () => {
  beforeEach(() => stub())

  it('🔴 กดแถว → ชีต · ยังไม่ยิง DELETE จนกว่าจะกดยืนยัน · ยืนยัน → DELETE id ของแถวนั้น · แถวหาย + toast', async () => {
    render(<FriendsListScreen />)
    fireEvent.click(await waitFor(() => screen.getByTestId('friends-manage-open-f2')))
    expect(screen.getByTestId('friends-manage-name').textContent).toBe('มานพ')
    // 🔴 ชีตต้องอยู่นอกคอลัมน์เนื้อหา (portal ไป body): อยู่ข้างในแล้ว z-50 ถูกตีค่าในกล่อง z-10 → แถบเมนูล่างทับปุ่ม
    //    (บั๊กจริงที่เจอตอนไล่บนเบราว์เซอร์: กด "ลบเพื่อน" ไม่ได้เพราะแถบ "ปฏิทิน" ครอบอยู่)
    // (SheetShell: dialog อยู่ใน div ฉากหลัง 1 ชั้น — ฉากหลังนั่นเองที่ต้องเป็นลูกตรงของ body)
    const dlg = screen.getByRole('dialog', { name: 'จัดการเพื่อน' })
    expect(dlg.parentElement).toBeTruthy()
    expect(dlg.parentElement?.parentElement).toBe(document.body)
    fireEvent.click(screen.getByTestId('friends-manage-delete'))
    expect(screen.getByTestId('friends-manage-confirm')).toBeTruthy()
    expect(callsTo('DELETE')).toEqual([]) // ยังไม่ยิง — ต้องมีการยืนยันก่อนเสมอ
    fireEvent.click(screen.getByTestId('friends-manage-confirm-delete'))
    await waitFor(() => expect(screen.queryByTestId('friends-row-f2')).toBeNull())
    expect(callsTo('DELETE')).toEqual(['/api/member-with-friend?id=f2'])
    expect(screen.getByTestId('friends-count').textContent).toBe('2 คน')
    expect(screen.queryByTestId('friends-manage')).toBeNull()
    expect(screen.getByTestId('friends-toast').textContent).toBe('ลบเพื่อนแล้ว')
    expect(screen.getByTestId('friends-row-f1')).toBeTruthy()
  })

  it('กดยกเลิกในขั้นยืนยัน → ไม่ยิง DELETE · ชีตยังเปิด', async () => {
    render(<FriendsListScreen />)
    fireEvent.click(await waitFor(() => screen.getByTestId('friends-manage-open-f1')))
    fireEvent.click(screen.getByTestId('friends-manage-delete'))
    fireEvent.click(screen.getByTestId('friends-manage-cancel'))
    expect(screen.queryByTestId('friends-manage-confirm')).toBeNull()
    expect(screen.getByTestId('friends-manage-delete')).toBeTruthy()
    expect(callsTo('DELETE')).toEqual([])
  })

  it('🔴 DELETE ล้ม (500) → บอก "ลบไม่สำเร็จ" ชีตยังเปิด แถวยังอยู่ ไม่มี toast สำเร็จ', async () => {
    stub({ deleteOk: false })
    render(<FriendsListScreen />)
    fireEvent.click(await waitFor(() => screen.getByTestId('friends-manage-open-f1')))
    fireEvent.click(screen.getByTestId('friends-manage-delete'))
    fireEvent.click(screen.getByTestId('friends-manage-confirm-delete'))
    await waitFor(() => expect(screen.getByTestId('friends-manage-error').textContent).toContain('ลบไม่สำเร็จ'))
    expect(screen.getByTestId('friends-row-f1')).toBeTruthy()
    expect(screen.queryByTestId('friends-toast')).toBeNull()
  })
})

describe('friends-model (pure)', () => {
  const f = (over: Partial<FriendRow>): FriendRow => ({ id: 'x', name: 'a', ...over })

  it('parseFriendRows: array → แถว · ไม่ใช่ array → null · แถวไม่มี id ถูกตัด', () => {
    expect(parseFriendRows({ error: 'x' })).toBeNull()
    expect(parseFriendRows(null)).toBeNull()
    expect(parseFriendRows('[]')).toBeNull()
    const out = parseFriendRows([row({ id: 'ok' }), { name: 'ไม่มี id' }, null, 7])
    expect(out?.map((r) => r.id)).toEqual(['ok'])
    expect(out?.[0]).toMatchObject({ is_member: false, is_disable: false, is_remember_time: true, dob: '1995-06-15' })
  })

  it('friendBirthText: พ.ศ. · ไม่ทราบเวลาต่อท้าย · วันเกิดเสีย/ไม่มี → ว่าง (ไม่เดา)', () => {
    expect(friendBirthText(f({ dob: '1995-06-15' }))).toBe('15 มิ.ย. 2538')
    expect(friendBirthText(f({ dob: '1995-06-15', is_remember_time: false }))).toBe('15 มิ.ย. 2538 · ไม่ทราบเวลาเกิด')
    expect(friendBirthText(f({ dob: 'not-a-date' }))).toBe('')
    expect(friendBirthText(f({ dob: null }))).toBe('')
  })

  it('friendName: ชื่อ+นามสกุล ปรับช่องว่าง · ว่างทั้งแถว → "ไม่ระบุชื่อ"', () => {
    expect(friendName(f({ name: ' สมศรี ', surname: ' ใจดี ' }))).toBe('สมศรี ใจดี')
    expect(friendName(f({ name: '', surname: null }))).toBe('ไม่ระบุชื่อ')
  })

  it('🔴 FL5 filterFriends: ค้นชื่อ/นามสกุล (ไม่สนตัวพิมพ์/ช่องว่าง/สระอำที่พิมพ์มาแบบแยกส่วน) · ไม่ค้นจาก id', () => {
    const composed = '\u0E19\u0E49\u0E33\u0E17\u0E23\u0E07' // น้ำทรง (สระอำตัวเดียว)
    const decomposed = '\u0E19\u0E49\u0E4D\u0E32\u0E17\u0E23\u0E07' // น้ำทรง แบบ ํ + า แยกกัน
    const rows = [
      f({ id: 'abc', name: 'Somchai', surname: 'Rak' }),
      f({ id: 'z9', name: 'สมหญิง', surname: null }),
      f({ id: 'q', name: 'แพรว', surname: '' }),
      f({ id: 'nam', name: composed, surname: null }),
    ]
    expect(filterFriends(rows, '').length).toBe(4)
    expect(filterFriends(rows, '   ').length).toBe(4)
    expect(filterFriends(rows, 'somchai').map((r) => r.id)).toEqual(['abc'])
    expect(filterFriends(rows, 'RAK').map((r) => r.id)).toEqual(['abc'])
    expect(filterFriends(rows, 'หญิง').map((r) => r.id)).toEqual(['z9'])
    expect(filterFriends(rows, ' สมหญิง  ').map((r) => r.id)).toEqual(['z9'])
    expect(filterFriends(rows, decomposed).map((r) => r.id)).toEqual(['nam'])
    expect(filterFriends(rows, 'z9')).toEqual([]) // id ไม่ใช่ข้อมูลที่ผู้ใช้ค้น
  })

  it('🔴 FL7 accountFriendsCard: รายชื่อว่าง + ชวนมา 4 → "เพื่อนที่ชวนมา 4 คน" ไม่พูดว่าชวนเพื่อนคนแรก', () => {
    const v = accountFriendsCard([], 4, ['ไฟ'])
    expect(v.title).toBe('เพื่อนที่ชวนมา 4 คน')
    expect(v.sub).toContain('เก็บครบ 5 ธาตุรับ 1,000 QI · ยังขาดไฟ')
    expect(v.sub).not.toContain('ชวนเพื่อนคนแรก')
    expect(v.has).toBe(true)
    expect(v.stack).toEqual(['ธ', 'ธ', 'ธ'])
    expect(v.extra).toBe(1)
  })

  it('🔴 FL7 accountFriendsCard: รายชื่อโหลดไม่ได้ (null) ≠ ไม่มีเพื่อน — ถอยไปนับชวนมาแบบเดิม', () => {
    const v = accountFriendsCard(null, 8, ['ไฟ', 'ทอง'])
    expect(v.has).toBe(true)
    expect(v.title).toBe('เพื่อนของคุณ 8 คน')
    expect(v.stack).toEqual(['ธ', 'ธ', 'ธ'])
    expect(v.extra).toBe(5)
    const none = accountFriendsCard(null, 0, [])
    expect(none.has).toBe(false)
    expect(none.title).toBe('สะสมเพื่อนให้ครบ 5 ธาตุ')
  })

  it('accountFriendsCard: มีรายชื่อ 5 คน ชวนมา 80 → นับ 5 ตามรายชื่อ วงเป็นอักษรแรกของชื่อจริง', () => {
    const saved = [f({ id: '1', name: 'แพร' }), f({ id: '2', name: 'โอม' }), f({ id: '3', name: '' }), f({ id: '4', name: 'ดี' }), f({ id: '5', name: 'เอ' })]
    const v = accountFriendsCard(saved, 80, [])
    expect(v.title).toBe('เพื่อนของคุณ 5 คน')
    expect(v.stack).toEqual(['แ', 'โ', '?'])
    expect(v.extra).toBe(2)
    expect(v.sub).toBe('เก็บครบ 5 ธาตุรับ 1,000 QI')
    expect(accountFriendsCard([], 0, []).has).toBe(false)
  })
})

describe('หน้า /v2/friends (glue)', () => {
  const code = (rel: string) =>
    readFileSync(join(process.cwd(), rel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

  it('ผ่านด่าน v2 เหมือนจอพี่น้อง และ render FriendsListScreen', () => {
    const page = code('pages/v2/friends.tsx')
    expect(page).toMatch(/v2RedirectIfUnauthed/)
    expect(page).toMatch(/<FriendsListScreen/)
  })

  it('การ์ดเพื่อนบนโปรไฟล์ต้องพาไป /v2/friends (ไม่ใช่หน้าชวนเพื่อน)', () => {
    const src = code('features/v2-account/components/AccountScreen.tsx')
    const link = /<Link href="([^"]+)" data-testid="account-friends"/.exec(src)
    expect(link?.[1]).toBe('/v2/friends')
  })
})
