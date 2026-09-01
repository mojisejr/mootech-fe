// #569 — WIRING teeth: the role the user picks is the role the calculation is asked for.
//
// Why this file exists. scripts/compatibility.test.ts proves COLLEAGUE_ROLES is a correct list, and every
// one of those cases stays GREEN if the screen ignores the selection and keeps sending its config default.
// A list nobody reads is the "green that passes without the real thing" shape, so the assertion that
// cannot be faked is made on the ARGUMENT that reaches calculateCompatibility, through the real screen.
//
// 🔴 MUTANT CONTRACT (each turns a named test below red):
//   M1  the screen sends `config.matchingType` instead of `c.matchingType`  → "ส่งบทบาทที่เลือก" reddens
//   M2  BOSS and EMPLOYEE swapped in COLLEAGUE_ROLES                        → "ทิศทางไม่กลับด้าน" reddens
//   M3  the love screen renders the role picker too                        → "จอคู่รักไม่มีตัวเลือก" reddens
//   M4  pickLabel replaced by the old shared string                        → "คำในช่องเลือก" reddens
//
// .tsx = invisible to the pre-push tsx lane by extension; registered in vitest.config.mts.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const { push, calculateCompatibility, useCompatibility } = vi.hoisted(() => ({
  push: vi.fn(),
  calculateCompatibility: vi.fn(),
  useCompatibility: vi.fn(),
}))

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({ useRouter: () => ({ push, query: {}, pathname: '/v2/service/compatibility' }) }))
vi.mock('@/features/v2-service/hooks/useCompatibilityResult', () => ({ calculateCompatibility }))
vi.mock('@/features/auth/hooks/useV2Logout', () => ({ useV2Logout: () => ({ logout: vi.fn() }) }))
vi.mock('@/features/v2-shell/components/Menubar', () => ({ Menubar: () => null }))
vi.mock('@/features/v2-shell/components/TopBarBell', () => ({ TopBarBell: () => null }))
vi.mock('@/features/v2-shell/components/TopBarAvatar', () => ({ TopBarAvatar: () => null }))
vi.mock('@/features/v2-shell/components/LoadingScreen', () => ({ LoadingScreen: () => <div data-testid="loading" /> }))
vi.mock('react-cookie', () => ({ useCookies: () => [{ 'cookie-mumate-id': 'u-1' }] }))
vi.mock('@/features/v2-service/hooks/useCompatibility', () => ({ useCompatibility: () => useCompatibility() }))

import { CompatibilityScreen } from '@/features/v2-service/components/CompatibilityScreen'
import { resolveCompatibilityKind, COLLEAGUE_ROLES } from '@/features/v2-service/compatibility'

const PERSON1 = { id: 'u-1', name: 'ฟีม', dob: '1990-01-01', time: '08:00', gender: 'MALE' }
const PERSON2 = { id: 'f-1', name: 'เพื่อน', dob: '1992-02-02', time: '09:00', gender: 'FEMALE' }

/**
 * Mount the screen with the hook mocked but its ROLE STATE real: `setRole` writes the variable and asks
 * React to re-render, and the mock is a FUNCTION so every render reads the current value. An earlier
 * version returned a frozen object and rendered twice — the click landed on one tree while the state lived
 * in the other, and the button never fired. Worth the note: that failure looked exactly like "the screen
 * ignores the selection", which is the bug this file exists to detect.
 */
function mountWith(kind: 'love' | 'colleague', person2: unknown = PERSON2) {
  // #265 — the calc cooldown persists in localStorage BY DESIGN (it must survive navigating away and back),
  // and jsdom keeps that storage across cases in one file. Clearing it here, BEFORE the mount, is what makes
  // each case start from "has not calculated yet"; clearing it after the mount is too late because the hook
  // has already read the stored deadline and disabled the button.
  window.localStorage.clear()
  const config = resolveCompatibilityKind(kind)!
  let role = config.matchingType
  let rerender: ((ui: React.ReactElement) => void) | null = null
  const setRole = vi.fn((r: typeof role) => {
    role = r
    rerender?.(<CompatibilityScreen config={config} />)
  })
  useCompatibility.mockImplementation(() => ({
    kind: config.kind, title: config.title, matchingType: role, role, setRole,
    person1: PERSON1, person2, canViewResult: person2 !== null, loadingPerson2: false,
    selectFriend: vi.fn(), createFriend: vi.fn(), updateFriendProfile: vi.fn(),
  }))
  const r = render(<CompatibilityScreen config={config} />)
  rerender = r.rerender
  return { config }
}

const fire = async () => {
  screen.getByTestId('compat-view-result').click()
  await waitFor(() => expect(calculateCompatibility).toHaveBeenCalled())
  return calculateCompatibility.mock.calls.at(-1)![2]
}

beforeEach(() => {
  window.localStorage.clear()
  // the screen reads /api/v2/quota on mount; answer "unreadable" so no indicator renders and nothing here
  // depends on a quota number — this file is about the role argument, not about the counter.
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })))
  calculateCompatibility.mockReset()
  calculateCompatibility.mockResolvedValue({ ok: true, matchingId: 'm-1' })
})
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals() })

describe('#569 the role the user picks is the role the engine is asked for', () => {
  it('🔴 ส่งบทบาทที่เลือก ❌ ไม่ใช่ค่าเริ่มต้นของหน้าจอ — ทั้งสามค่า', async () => {
    for (const r of COLLEAGUE_ROLES) {
      cleanup()
      calculateCompatibility.mockReset()
      calculateCompatibility.mockResolvedValue({ ok: true, matchingId: 'm-1' })
      mountWith('colleague')
      screen.getByTestId(`compat-role-${r.value}`).click()
      expect(await fire(), `เลือก ${r.label} แล้วต้องส่ง ${r.value}`).toBe(r.value)
    }
  })

  it('ไม่แตะอะไรเลย → ส่งค่าเริ่มต้น ซึ่งคือค่าที่เคยส่งอยู่ก่อน #569', async () => {
    mountWith('colleague')
    expect(await fire()).toBe('FRIEND')
  })

  it('🔴 ทิศทางไม่กลับด้าน — ปุ่ม "เจ้านาย" ต้องส่ง BOSS ❌ ไม่ใช่ EMPLOYEE', async () => {
    mountWith('colleague')
    screen.getByText('เจ้านาย').click()
    expect(await fire()).toBe('BOSS')
    cleanup(); calculateCompatibility.mockReset()
    calculateCompatibility.mockResolvedValue({ ok: true, matchingId: 'm-1' })
    mountWith('colleague')
    screen.getByText('ลูกน้อง').click()
    expect(await fire()).toBe('EMPLOYEE')
  })

  it('🔴 CONTROL — จอคู่รักไม่มีตัวเลือกบทบาท และยังส่ง LOVE', async () => {
    mountWith('love')
    expect(screen.queryByTestId('compat-role-picker')).toBeNull()
    expect(await fire()).toBe('LOVE')
  })

  it('🔴 คำในช่องเลือกคน ต่างกันตามจอ — จอคู่รักไม่พูดถึงเพื่อน', () => {
    mountWith('love', null) // the picker's empty label only renders when no person is chosen yet
    expect(screen.getByText('เลือกคู่รัก')).toBeTruthy()
    expect(screen.queryByText('เลือกเพื่อน / คู่รัก')).toBeNull()
    cleanup()
    mountWith('colleague', null)
    expect(screen.getByText('เลือกเพื่อนร่วมงาน')).toBeTruthy()
  })
})
