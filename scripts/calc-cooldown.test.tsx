// #265 — one minute between calculations, asserted in the lane CI actually runs.
//
// 🔴 EVERY claim this ticket makes is asserted HERE, in vitest. The e2e companion
// (e2e/v2-compat-cooldown.spec.ts) exists to capture the frames and to corroborate in a real browser —
// it is NOT where any guarantee lives. Lesson from #271: the only proof that "เหลือน้อย" looked
// different from "เหลือเยอะ" was a colour assertion parked in e2e, and CI has no lane for e2e yet
// (#270), so a token repoint would have shipped green. A gate nobody runs reads exactly like a gate
// that passed.
//
// Time is driven with fake timers rather than by waiting: a test that really slept 60s would be skipped
// by the first person in a hurry, and one that shortened COOLDOWN_MS to make itself fast would be
// testing a constant that does not ship.
//
// MUTANT CONTRACT — each flips real behaviour, each goes RED here… except one, said out loud:
//   U1  drop `if (cooldown.active) return` from onViewResult          → 🔴 SURVIVES. See below.
//   U2  cooldown.start() moved AFTER the await (cool down on answer, not on press)       → burst RED
//   U3  start() only on success (skip cooling down a failed calc)                        → "ล้มก็ยัง cooldown" RED
//   U4  store remaining seconds instead of the deadline / clear on mount                 → "remount ยังนับต่อ" RED
//   U5  button label stays 'ดูผลลัพธ์เลย' while cooling                                    → "ต้องบอกเหตุผล" RED
//   U6  readLastAt trusts a future timestamp                                             → "ค่าพังต้องไม่ล็อกปุ่ม" RED
//
// 🔴 U1 SURVIVES, AND NO TEST HERE KILLS IT — recorded rather than papered over.
// Deleting the in-handler cooldown check leaves this whole file green. The reason is not a missing case:
// React decides whether to deliver a click by reading `disabled` off ITS OWN fiber props, not off the DOM
// node, so no amount of removeAttribute/`.disabled = false` in a test reaches the handler while the button
// renders disabled. (Tried it; the test passed for a reason unrelated to its name, so it was deleted
// instead of shipped — a green check aimed at nothing is the thing this ticket's own review warned about.)
// The line stays because `disabled` is a RENDERING of the state, and the moment a SECOND caller appears —
// an Enter-key handler, a "ลองอีกครั้ง" link inside #263's message, a div styled as a button — it is the
// only thing left holding. What would kill U1 is a test that invokes that second caller; there isn't one
// yet because there isn't a second caller yet. If you add one, add the test with it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { COOLDOWN_MS, cooldownKey } from '@/features/v2-service/hooks/useCalcCooldown'

const { push, calculateCompatibility, useCompatibility } = vi.hoisted(() => ({
  push: vi.fn(),
  calculateCompatibility: vi.fn(),
  useCompatibility: vi.fn(),
}))

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({ useRouter: () => ({ push, query: {}, pathname: '/v2/service/compatibility' }) }))
vi.mock('@/features/v2-service/hooks/useCompatibilityResult', () => ({ calculateCompatibility }))
vi.mock('@/features/v2-service/hooks/useCompatibility', () => ({ useCompatibility: () => useCompatibility() }))
vi.mock('@/features/auth/hooks/useV2Logout', () => ({ useV2Logout: () => ({ logout: vi.fn() }) }))
vi.mock('@/features/v2-shell/components/Menubar', () => ({ Menubar: () => null }))
vi.mock('@/features/v2-shell/components/TopBarBell', () => ({ TopBarBell: () => null }))
vi.mock('@/features/v2-shell/components/TopBarAvatar', () => ({ TopBarAvatar: () => null }))
vi.mock('@/features/v2-shell/components/LoadingScreen', () => ({ LoadingScreen: () => <div data-testid="loading" /> }))
vi.mock('react-cookie', () => ({ useCookies: () => [{ 'cookie-mumate-id': USER }] }))

import { CompatibilityScreen } from '@/features/v2-service/components/CompatibilityScreen'

const USER = 'u-1'
const PERSON1 = { id: USER, name: 'ฟีม', dob: '1990-01-01', time: '08:00', gender: 'MALE' }
const PERSON2 = { id: 'f-1', name: 'เพื่อน', dob: '1992-02-02', time: '09:00', gender: 'FEMALE' }
const CONFIG = { matchingType: 'LOVE', title: 'เช็คความสมพงศ์', tagline: 'ด้านความรัก' } as never

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  window.localStorage.clear()
  // The quota read is #264's; irrelevant here, so it is simply unavailable (renders no indicator).
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })))
  calculateCompatibility.mockResolvedValue({ ok: false, reason: 'system' })
  useCompatibility.mockReturnValue({
    person1: PERSON1, person2: PERSON2, matchingType: 'LOVE', canViewResult: true,
    loadingPerson2: false, selectFriend: vi.fn(), createFriend: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

const button = () => screen.getByTestId('compat-view-result') as HTMLButtonElement
const tap = () => act(() => { button().click() })
const advance = async (ms: number) => { await act(async () => { vi.advanceTimersByTime(ms) }) }

describe('#265 cooldown — กดรัวจากปุ่มเดียวกันไม่ได้', () => {
  it('🔴 กดรัว 10 ครั้ง → ยิงจริงครั้งเดียว', async () => {
    render(<CompatibilityScreen config={CONFIG} />)
    // All ten in the SAME tick, on the same element — no re-render in between, which is the actual
    // double-tap shape (and the case `disabled` cannot help with, because it has not re-rendered yet).
    const b = button()
    act(() => { for (let i = 0; i < 10; i++) b.click() })
    await waitFor(() => expect(calculateCompatibility).toHaveBeenCalledTimes(1))
    expect(calculateCompatibility).toHaveBeenCalledTimes(1)
  })

  it('🔴 กดรัวห่างกันเป็นวินาที (17 ครั้งใน 7 วิ แบบที่เจอบน prod) → ยังยิงครั้งเดียว', async () => {
    // The fire-once latch alone does NOT cover this: it releases the moment the request settles, so taps
    // spread across seconds each got their own shot. That is the shape of the prod incident (17 rows in
    // 7 seconds), and it is the one the cooldown — not the latch — has to stop.
    render(<CompatibilityScreen config={CONFIG} />)
    tap()
    // While the calculation is in flight the loader covers the form, so there is no button to hit; wait
    // for it to settle, which is exactly when the old code became tappable again.
    await waitFor(() => expect(screen.getByTestId('compat-result-error')).toBeTruthy())

    let realTaps = 0
    for (let i = 0; i < 16; i++) {
      const b = screen.queryByTestId('compat-view-result') as HTMLButtonElement | null
      if (b) { realTaps++; act(() => { b.click() }) }
      await advance(400)
    }
    // Guard against the test passing by never pressing anything (0/0 is not a pass).
    expect(realTaps).toBe(16)
    expect(calculateCompatibility).toHaveBeenCalledTimes(1)
  })

  it('🔴 ปุ่มบอกเหตุผลและเวลาที่เหลือ — ไม่ใช่ปุ่มเทาเงียบๆ (คลาสเดียวกับ #263)', async () => {
    render(<CompatibilityScreen config={CONFIG} />)
    tap()
    await waitFor(() => expect(button().disabled).toBe(true))
    expect(button().textContent).toMatch(/รออีก \d+ วินาที/)
    expect(button().textContent).not.toBe('ดูผลลัพธ์เลย')
    // …and readable. The frame caught this: the label was white on the #DDDDDD disabled fill (~1.4:1),
    // which is fine for decoration and useless for the one thing the user now needs to read off it.
    // Saying why in text nobody can make out is the same defect as not saying why.
    expect(button().className).toContain('text-v3-text-body')
    expect(button().className).not.toContain('text-white')
  })

  it('ตัวเลขเดินลงจริงตามเวลา', async () => {
    render(<CompatibilityScreen config={CONFIG} />)
    tap()
    await waitFor(() => expect(button().textContent).toContain('รออีก'))
    const first = Number(button().textContent!.match(/(\d+)/)![1])
    await advance(3_000)
    const later = Number(button().textContent!.match(/(\d+)/)![1])
    expect(later).toBeLessThan(first)
    expect(first).toBeLessThanOrEqual(COOLDOWN_MS / 1000)
  })

  it('ครบนาที → กดได้อีก และยิงจริงเป็นครั้งที่สอง', async () => {
    // negative control for every "ยิงครั้งเดียว" case above: without this they would also pass on a
    // button that was permanently dead.
    render(<CompatibilityScreen config={CONFIG} />)
    tap()
    await waitFor(() => expect(calculateCompatibility).toHaveBeenCalledTimes(1))
    await advance(COOLDOWN_MS + 500)
    await waitFor(() => expect(button().disabled).toBe(false))
    expect(button().textContent).toBe('ดูผลลัพธ์เลย')
    tap()
    await waitFor(() => expect(calculateCompatibility).toHaveBeenCalledTimes(2))
  })

  it('🔴 คำนวณล้มเหลว (โควตาเต็ม) ก็ยัง cooldown — คนที่โดนปฏิเสธคือคนที่กดรัวที่สุด', async () => {
    calculateCompatibility.mockResolvedValue({ ok: false, reason: 'quota' })
    render(<CompatibilityScreen config={CONFIG} />)
    tap()
    await waitFor(() => expect(screen.getByTestId('compat-result-error')).toBeTruthy())
    expect(button().disabled).toBe(true)
    expect(button().textContent).toMatch(/รออีก/)
    // …and #263's message is still the one explaining the failure; the button explains only the wait.
    expect(screen.getByTestId('compat-result-error').textContent).toContain('ใช้สิทธิ์ดูดวงสมพงศ์ครบแล้ว')
  })

  it('🔴 ถอยกลับมาหน้าเดิม (remount) → ยังนับต่อ ไม่รีเซ็ตเป็นนาทีใหม่', async () => {
    render(<CompatibilityScreen config={CONFIG} />)
    tap()
    await waitFor(() => expect(button().textContent).toContain('รออีก'))
    await advance(20_000)
    cleanup()

    render(<CompatibilityScreen config={CONFIG} />)
    await waitFor(() => expect(button().disabled).toBe(true))
    const left = Number(button().textContent!.match(/(\d+)/)![1])
    expect(left).toBeLessThanOrEqual(41) // ~40s of a 60s window, never a fresh 60
    expect(left).toBeGreaterThan(0)
  })

  it('remount หลังครบนาทีแล้ว → ปุ่มกลับมาปกติ', async () => {
    render(<CompatibilityScreen config={CONFIG} />)
    tap()
    await advance(COOLDOWN_MS + 1_000)
    cleanup()
    render(<CompatibilityScreen config={CONFIG} />)
    await waitFor(() => expect(button().disabled).toBe(false))
    expect(button().textContent).toBe('ดูผลลัพธ์เลย')
  })

  it('🔴 ค่าที่เก็บไว้พัง/อยู่ในอนาคต → ปุ่มต้องไม่ถูกล็อกค้าง', async () => {
    // A dead button with no way out would be a worse bug than the one being fixed.
    for (const bad of ['not-a-number', String(Date.now() + 10 * 60_000), '-1', '']) {
      window.localStorage.setItem(cooldownKey(USER), bad)
      render(<CompatibilityScreen config={CONFIG} />)
      await waitFor(() => expect(button().disabled).toBe(false))
      cleanup()
    }
  })

  it('cooldown ผูกกับผู้ใช้ — ไม่ตกทอดข้ามบัญชี', () => {
    window.localStorage.setItem(cooldownKey('someone-else'), String(Date.now()))
    render(<CompatibilityScreen config={CONFIG} />)
    expect(button().disabled).toBe(false)
    expect(cooldownKey(USER)).not.toBe(cooldownKey('someone-else'))
  })

  it('ไม่กลืนของเฟสก่อน: ข้อความ #263 ยังขึ้นตามสาเหตุเดิม', async () => {
    calculateCompatibility.mockResolvedValue({ ok: false, reason: 'network' })
    render(<CompatibilityScreen config={CONFIG} />)
    tap()
    await waitFor(() => expect(screen.getByTestId('compat-result-error')).toBeTruthy())
    expect(screen.getByTestId('compat-result-error').textContent).toContain('เชื่อมต่อไม่ได้')
  })
})
