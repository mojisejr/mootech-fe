// สไลด์ 9 (ฟีม 2026-09-07) — จอเพื่อนร่วมงานต้องเลือกบทบาทได้ก่อนกดดูผลลัพธ์ และหน้าผลลัพธ์ชูมุมมองนั้นขึ้นก่อน.
// ไม่แตะคำขอไป engine (#585 ยังได้ 3 มุมมองต่อคน) — สิ่งที่วัดคือ (1) chip 3 อัน เฉพาะจอเพื่อนร่วมงาน
// (2) ค่าเริ่มต้น = หุ้นส่วน/เพื่อน (3) roleOrderWithChosen ดันมุมมองที่เลือกขึ้นก่อนโดยไม่ทิ้งอีกสอง
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(), query: {}, pathname: '/v2/service/compatibility' }) }))
vi.mock('@/features/v2-service/hooks/useCompatibilityResult', () => ({ calculateCompatibility: vi.fn() }))
vi.mock('@/features/auth/hooks/useV2Logout', () => ({ useV2Logout: () => ({ logout: vi.fn() }) }))
vi.mock('@/features/v2-shell/components/Menubar', () => ({ Menubar: () => null }))
vi.mock('@/features/v2-shell/components/MateAIButton', () => ({ MateAIButton: () => null }))
vi.mock('@/features/v2-shell/components/TopBarBell', () => ({ TopBarBell: () => null }))
vi.mock('@/features/v2-shell/components/TopBarAvatar', () => ({ TopBarAvatar: () => null }))
vi.mock('@/features/v2-shell/components/LoadingScreen', () => ({ LoadingScreen: () => <div data-testid="loading" /> }))
vi.mock('react-cookie', () => ({ useCookies: () => [{ 'cookie-mumate-id': 'u-1' }] }))
const hook = vi.fn()
vi.mock('@/features/v2-service/hooks/useCompatibility', () => ({ useCompatibility: () => hook() }))
vi.mock('@/constants/api/api-member-with-friend-get-detail', () => ({ MemberWithFriendGetDetailApi: vi.fn(async () => null) }))
vi.mock('@/features/v2-service/components/CompatSelectFriendModal', () => ({ CompatSelectFriendModal: () => null }))

import { CompatibilityScreen } from '@/features/v2-service/components/CompatibilityScreen'
import { resolveCompatibilityKind, COLLEAGUE_ROLES, DEFAULT_COLLEAGUE_ROLE, parseColleagueRole, colleagueRoleOfRelationship } from '@/features/v2-service/compatibility'
import { roleOrderWithChosen } from '@/features/v2-service/components/WorkResultScreen'

const base = {
  person1: { id: 'u-1', name: 'ฟีม', dob: '1990-01-01', time: '08:00', gender: 'MALE' },
  person2: null, canViewResult: false, loadingPerson1: false, loadingPerson2: false,
  selectFriend: vi.fn(), clearFriend: vi.fn(), createFriend: vi.fn(), updateFriendProfile: vi.fn(),
}

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals() })

describe('สไลด์ 9 — เลือกบทบาทก่อนดูผลลัพธ์', () => {
  it('จอเพื่อนร่วมงานมี chip เจ้านาย / หุ้นส่วน-เพื่อน / ลูกน้อง ครบ 3 และเริ่มที่หุ้นส่วน/เพื่อน', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })))
    hook.mockReturnValue({ ...base, matchingType: 'FRIEND' })
    render(<CompatibilityScreen config={resolveCompatibilityKind('colleague')!} />)
    const chips = COLLEAGUE_ROLES.map((r) => screen.getByTestId(`compat-role-${r.value}`))
    expect(chips).toHaveLength(3)
    expect(chips.map((c) => c.textContent)).toEqual(['เจ้านาย', 'หุ้นส่วน', 'ลูกน้อง'])
    expect(screen.getByTestId(`compat-role-${DEFAULT_COLLEAGUE_ROLE}`).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByTestId('compat-role-BOSS'))
    expect(screen.getByTestId('compat-role-BOSS').getAttribute('aria-checked')).toBe('true')
    expect(screen.getByTestId('compat-role-FRIEND').getAttribute('aria-checked')).toBe('false')
  })

  it('ป้ายช่องเปลี่ยนตามบทบาทที่เลือก: หุ้นส่วน → "เลือกหุ้นส่วน", กดเจ้านาย → "เลือกเจ้านาย" ทั้ง 3 ช่อง', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })))
    hook.mockReturnValue({ ...base, matchingType: 'FRIEND' })
    render(<CompatibilityScreen config={resolveCompatibilityKind('colleague')!} />)
    const labels = () => [0, 1, 2].map((i) => screen.getByTestId(`compat-candidate-${i}-empty`).textContent)
    expect(labels()).toEqual(['เลือกหุ้นส่วน', 'เลือกหุ้นส่วน', 'เลือกหุ้นส่วน'])
    fireEvent.click(screen.getByTestId('compat-role-BOSS'))
    expect(labels()).toEqual(['เลือกเจ้านาย', 'เลือกเจ้านาย', 'เลือกเจ้านาย'])
    fireEvent.click(screen.getByTestId('compat-role-EMPLOYEE'))
    expect(labels()).toEqual(['เลือกลูกน้อง', 'เลือกลูกน้อง', 'เลือกลูกน้อง'])
  })

  it('colleagueRoleOfRelationship: อ่านบทบาทจาก relationship ที่ engine เก็บมากับผลลัพธ์', () => {
    expect(colleagueRoleOfRelationship('boss')?.value).toBe('BOSS')
    expect(colleagueRoleOfRelationship('partner')?.value).toBe('FRIEND')
    expect(colleagueRoleOfRelationship('subordinate')?.value).toBe('EMPLOYEE')
    expect(colleagueRoleOfRelationship(null)).toBeNull()
  })

  it('จอคู่รักไม่มี chip บทบาท (ตัวเลือกนี้เป็นของเพื่อนร่วมงานเท่านั้น)', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })))
    hook.mockReturnValue({ ...base, matchingType: 'LOVE' })
    render(<CompatibilityScreen config={resolveCompatibilityKind('love')!} />)
    expect(screen.queryByTestId('compat-role-picker')).toBeNull()
  })

  it('parseColleagueRole: รับเฉพาะค่าที่รู้จัก (string หรือ array ตัวแรก) นอกนั้น null', () => {
    expect(parseColleagueRole('BOSS')?.perspective).toBe('ตัวเรา → เจ้านาย')
    expect(parseColleagueRole(['EMPLOYEE'])?.perspective).toBe('ลูกน้อง → ตัวเรา')
    expect(parseColleagueRole('LOVE')).toBeNull()
    expect(parseColleagueRole(undefined)).toBeNull()
  })

  it('roleOrderWithChosen: มุมมองที่เลือกขึ้นก่อน อีกสองยังอยู่ครบ; ไม่เลือก/ไม่ตรง = ลำดับเดิม', () => {
    const BOSS = { perspective: 'ตัวเรา → เจ้านาย' }
    const SUB = { perspective: 'ลูกน้อง → ตัวเรา' }
    const PARTNER = { perspective: 'หุ้นส่วน/เพื่อนร่วมงาน' }
    expect(roleOrderWithChosen([BOSS, SUB, PARTNER], PARTNER.perspective)).toEqual([PARTNER, BOSS, SUB])
    expect(roleOrderWithChosen([BOSS, SUB, PARTNER], undefined)).toEqual([BOSS, SUB, PARTNER])
    expect(roleOrderWithChosen([BOSS, SUB], PARTNER.perspective)).toEqual([BOSS, SUB])
  })
})
