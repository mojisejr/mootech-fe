// #263 — the UI half. goo's scripts/compat-calc-error-reasons.test.tsx guards the CLASSIFICATION
// (410 → 'quota' …); this file guards the only thing the user can actually perceive: that the four
// causes put FOUR DIFFERENT SENTENCES on the screen, and that none of them moves the user off it.
//
// Why it renders the real CompatibilityScreen instead of testing the copy map directly: a map test is
// true-by-construction — it reads back the literal it was given and would stay green if the screen
// stopped rendering the map at all. The claim worth defending is "the person who is out of quota READS
// that they are out of quota", so the assertions read textContent out of the rendered DOM. There is
// deliberately no data-reason attribute to assert against: the whole point of the ticket is that the
// cases are told apart BY THE WORDS, and an attribute would let a tooth pass while the words were wrong.
//
// .tsx so ci.yml's legacy `for f in scripts/*.test.ts` lane never sees it (that lane runs plain
// node:assert scripts under tsx and would throw on `import … from 'vitest'`). Registered in
// vitest.config.mts `include` — APPENDED to the existing lines, never replacing them (that list carries
// its own "UNION, never pick a side" warning; #214 and #218 already ate each other there once).
//
// MUTANT CONTRACT — each flips real behaviour in CompatibilityScreen.tsx, each goes RED here:
//   U1  setCalcError(res.reason) → setCalcError('system')     → quota + network cases RED
//       (this is the regression the whole ticket exists to prevent: causes collapsing back into one)
//   U2  quota copy gains "ลองอีกครั้ง"                          → "โควตาเต็มต้องไม่ชวนกดซ้ำ" RED
//   U3  the catch sets 'system' instead of 'navigate'          → "นำทางพลาดต้องไม่ชวนคำนวณใหม่" RED
//   U4  quota tone 'blocked' → 'retry'                         → tone/role case RED
//   U5  navigate on !res.ok (drop the early return)            → every "อยู่หน้าเดิม" case RED
//   U6  render a single shared string again                    → the all-different case RED
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

// vi.hoisted: the mock factories below are lifted above the imports, so the spies they close over must
// be created up there too (a plain `const` would be in the temporal dead zone when the factory runs).
const { push, calculateCompatibility, useCompatibility } = vi.hoisted(() => ({
  push: vi.fn(),
  calculateCompatibility: vi.fn(),
  useCompatibility: vi.fn(),
}))

// endpoint.ts (reached transitively through CompatSelectFriendModal → api-member-with-friend-get) calls
// next/config's getConfig() at module load, which is undefined under vitest. Same stub as goo's spec.
vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))

vi.mock('next/router', () => ({ useRouter: () => ({ push, query: {}, pathname: '/v2/service/compatibility' }) }))

// The calc seam is goo's and is unit-tested on his side; here it is the INPUT — each test drives one of
// his reasons through the real screen. Mocked at the module boundary he published in the ใบ.
vi.mock('@/features/v2-service/hooks/useCompatibilityResult', () => ({ calculateCompatibility }))

// Everything below is scaffolding the screen needs to mount; none of it is under test.
vi.mock('@/features/auth/hooks/useV2Logout', () => ({ useV2Logout: () => ({ logout: vi.fn() }) }))
vi.mock('@/features/v2-shell/components/Menubar', () => ({ Menubar: () => null }))
vi.mock('@/features/v2-shell/components/TopBarBell', () => ({ TopBarBell: () => null }))
vi.mock('@/features/v2-shell/components/TopBarAvatar', () => ({ TopBarAvatar: () => null }))
vi.mock('@/features/v2-shell/components/LoadingScreen', () => ({ LoadingScreen: () => <div data-testid="loading" /> }))
// #264 added a cookie read to this screen (the identity the quota indicator asks about). In the app the
// provider comes from _app; under vitest the bare hook throws "Missing <CookiesProvider>", which would
// take THIS spec down for a reason that has nothing to do with the copy it guards.
vi.mock('react-cookie', () => ({ useCookies: () => [{ 'cookie-mumate-id': 'u-1' }] }))
// …and with an identity present the screen now fetches /api/quota on mount. Stubbed as unavailable so no
// indicator renders and the copy assertions below see exactly what they saw before #264.
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })))

vi.mock('@/features/v2-service/hooks/useCompatibility', () => ({ useCompatibility: () => useCompatibility() }))

import { CompatibilityScreen } from '@/features/v2-service/components/CompatibilityScreen'

const PERSON1 = { id: 'u-1', name: 'ฟีม', dob: '1990-01-01', time: '08:00', gender: 'MALE' }
const PERSON2 = { id: 'f-1', name: 'เพื่อน', dob: '1992-02-02', time: '09:00', gender: 'FEMALE' }

const CONFIG = { matchingType: 'LOVE', title: 'เช็คความสมพงศ์', tagline: 'ด้านความรัก' } as never

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/** Render the screen with both people chosen (button live), then tap "ดูผลลัพธ์เลย". */
async function tapViewResult() {
  useCompatibility.mockReturnValue({
    person1: PERSON1,
    person2: PERSON2,
    matchingType: 'LOVE',
    canViewResult: true,
    loadingPerson2: false,
    selectFriend: vi.fn(),
    createFriend: vi.fn(),
  })
  render(<CompatibilityScreen config={CONFIG} />)
  screen.getByTestId('compat-view-result').click()
  await waitFor(() => expect(screen.getByTestId('compat-result-error')).toBeTruthy())
  return screen.getByTestId('compat-result-error')
}

/** Drive one failure through the screen and hand back what the user can actually see. */
async function messageFor(failure: { reason: string } | { navigateFails: true }) {
  if ('navigateFails' in failure) {
    calculateCompatibility.mockResolvedValue({ ok: true, matchingId: 'm-1' })
    push.mockResolvedValue(false) // navigation cancelled — the screen's own catch/throw path
  } else {
    calculateCompatibility.mockResolvedValue({ ok: false, reason: failure.reason })
  }
  const el = await tapViewResult()
  return { text: el.textContent ?? '', role: el.getAttribute('role'), className: el.className }
}

describe('#263 ดวงสมพงศ์ — คำต่างกันตามสาเหตุที่กดไม่ได้', () => {
  it('โควตาเต็ม: บอกตรงว่าใช้สิทธิ์ครบ ไม่ใช่ "คำนวณไม่สำเร็จ"', async () => {
    const { text } = await messageFor({ reason: 'quota' })
    expect(text).toContain('ใช้สิทธิ์ดูดวงสมพงศ์ครบแล้ว')
    expect(text).not.toContain('คำนวณไม่สำเร็จ')
  })

  it('🔴 โควตาเต็มต้องไม่ชวนกดซ้ำ — การกดซ้ำคือสิ่งที่กินโควตาเพิ่ม (454 คนบน prod)', async () => {
    const { text } = await messageFor({ reason: 'quota' })
    expect(text).not.toContain('ลองอีกครั้ง')
    expect(text).not.toContain('ลองใหม่')
  })

  it('โควตาเต็ม: ชี้ทางออกไปที่ "ดูดวงสมพงศ์ล่าสุด" ที่มีอยู่แล้วบนจอ', async () => {
    const { text } = await messageFor({ reason: 'quota' })
    expect(text).toContain('ดูดวงสมพงศ์ล่าสุด')
    // and that link really is on this screen — otherwise the copy points at nothing
    expect(screen.getByText('ดูดวงสมพงศ์ล่าสุด')).toBeTruthy()
  })

  it('ระบบขัดข้อง: บอกว่าไม่ใช่ความผิดผู้ใช้ และกดซ้ำได้ (5xx ไม่กินโควตา)', async () => {
    const { text } = await messageFor({ reason: 'system' })
    expect(text).toContain('ระบบขัดข้อง')
    expect(text).toContain('ไม่ใช่ข้อมูลของคุณผิด')
    expect(text).toContain('ลองอีกครั้ง')
  })

  it('เชื่อมต่อไม่ได้: บอกให้ไปดูสัญญาณ ไม่ใช่ให้ไปแก้ข้อมูล', async () => {
    const { text } = await messageFor({ reason: 'network' })
    expect(text).toContain('เชื่อมต่อไม่ได้')
    expect(text).toContain('อินเทอร์เน็ต')
  })

  it('🔴 นำทางพลาดหลังคำนวณสำเร็จ: ห้ามชวนคำนวณใหม่ — โควตาถูกใช้ไปแล้วและผลมีอยู่จริง', async () => {
    const { text } = await messageFor({ navigateFails: true })
    expect(text).toContain('คำนวณเสร็จแล้ว')
    expect(text).toContain('ดูดวงสมพงศ์ล่าสุด')
    expect(text).not.toContain('ลองอีกครั้ง')
  })

  it('🔴 ทั้ง 4 สาเหตุต้องอ่านได้ต่างกันจริง — ไม่ใช่ข้อความเดียวกันคนละที่มา', async () => {
    const seen: string[] = []
    for (const reason of ['quota', 'system', 'network']) {
      seen.push((await messageFor({ reason })).text)
      cleanup()
    }
    seen.push((await messageFor({ navigateFails: true })).text)
    expect(new Set(seen).size).toBe(4)
    expect(seen.every((s) => s.trim().length > 0)).toBe(true)
  })

  it('โควตาเต็มไม่ใช่ความผิดพลาด: โทนแจ้ง (navy/status) ไม่ใช่โทนเตือน (แดง/alert)', async () => {
    const quota = await messageFor({ reason: 'quota' })
    expect(quota.role).toBe('status')
    expect(quota.className).toContain('text-v3-navy')
    expect(quota.className).not.toContain('text-v3-error')
    cleanup()
    const system = await messageFor({ reason: 'system' })
    expect(system.role).toBe('alert')
    expect(system.className).toContain('text-v3-error')
  })

  it('🔴 ทุกสาเหตุอยู่หน้าเดิม — ไม่พาไปหน้าผลลัพธ์เปล่า', async () => {
    for (const reason of ['quota', 'system', 'network']) {
      await messageFor({ reason })
      expect(push).not.toHaveBeenCalled()
      cleanup()
      vi.clearAllMocks()
    }
  })

  it('สำเร็จจริงยังไปหน้าผลตามเดิม — ด่านนี้ไม่ได้ห้ามการนำทางทั้งหมด', async () => {
    // negative control: without this, "ไม่พาไปหน้าผล" would also pass on a screen that never navigates.
    calculateCompatibility.mockResolvedValue({ ok: true, matchingId: 'm-9' })
    push.mockResolvedValue(true)
    useCompatibility.mockReturnValue({
      person1: PERSON1, person2: PERSON2, matchingType: 'LOVE', canViewResult: true,
      loadingPerson2: false, selectFriend: vi.fn(), createFriend: vi.fn(),
    })
    render(<CompatibilityScreen config={CONFIG} />)
    screen.getByTestId('compat-view-result').click()
    await waitFor(() => expect(push).toHaveBeenCalledWith('/v2/service/compatibility/result/m-9'))
    expect(screen.queryByTestId('compat-result-error')).toBeNull()
  })
})
