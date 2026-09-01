// #571 — where does ย้อนกลับ go, and does the value that decides it actually travel?
//
// ฟีม: "คำนวณดวงสมพงศ์แล้วกดย้อนกลับ มันจะไปที่หน้าบริการรวมเลย — แก้เป็น ไปที่หน้าเช็คดวงสมพงศ์หน้าเดิม
// ทั้งของคู่รักและเพื่อนร่วมงาน". `pages/api/v2/matching/[id].ts:43,68` had been sending `matching_type` as
// `type` the whole time and nothing on the client read it — the same shape as #554, where the route sent the
// account photos and no one attached them.
//
// TWO LAYERS, because either one alone is the "green that passes without the real thing" shape:
//   pure    — the map answers correctly for every value, including ones it does not know
//   wiring  — the value reaches the screen THROUGH useCompatibilityResult, so a correct map that nobody
//             calls cannot pass. That is exactly the state the bug was in.
//
// 🔴 MUTANT CONTRACT (each turns a named test below red):
//   M1  applyMatchingKind dropped from the hook's parse chain     → "เข้าจากคู่รัก" + "เข้าจากเพื่อนร่วมงาน" redden
//   M2  an unknown matching_type guessed as 'love'                → "ค่าที่ไม่รู้จักกลับไป hub" reddens
//   M3  BOSS/EMPLOYEE mapped to 'love'                            → "สามบทบาทของเพื่อนร่วมงาน" reddens
//   M4  compatibilityBackHref ignores the kind                    → "หน้าปลายทางของแต่ละจอ" reddens
//   M5  the screen goes back to reading a hardcoded '/v2/service' → "ปุ่มบนจอจริง" reddens
//
// .tsx = invisible to the pre-push tsx lane by extension; registered in vitest.config.mts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, render, screen, waitFor, cleanup } from '@testing-library/react'

const getDetail = vi.fn()
vi.mock('@/constants/api/api-v2-matching', () => ({
  V2MatchingGetDetailApi: (...a: unknown[]) => getDetail(...a),
  V2MatchingCalculateApi: vi.fn(),
}))
vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))

import { useCompatibilityResult } from '@/features/v2-service/hooks/useCompatibilityResult'
import { CompatibilityResultScreen } from '@/features/v2-service/components/CompatibilityResultScreen'
import {
  applyMatchingKind,
  compatibilityBackHref,
  COMPAT_HUB_HREF,
} from '@/features/v2-service/compatibility-result'
import { compatibilityKindOfMatchingType, COLLEAGUE_ROLES } from '@/features/v2-service/compatibility'

// ✓ SHAPE TRACED. pages/api/v2/matching/[id].ts:64-69 answers { user, friend, result, type } where `result`
// is the JSON STRING stored in log_matching.result and the rich fields live under `.pairMatch`
// (compatibility-result.ts:104-108). A blob with a usable pairMatch is what makes the screen render `ready`.
const BLOB = JSON.stringify({
  pairMatch: {
    overall: { ratingText: 'เข้ากันได้ดี', scorePercent: 82 },
    dimensions: [{ key: 'a', labelTh: 'ด้าน ก', scorePercent: 80 }],
    persons: { a: { name: 'ฟีม' }, b: { name: 'โปเตโต้' } },
  },
})
const respFor = (type: unknown) => ({ user: {}, friend: {}, result: BLOB, type })

beforeEach(() => {
  getDetail.mockReset()
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ---------------------------------------------------------------- pure layer
describe('#571 pure — matching_type → หน้าที่ต้องกลับไป', () => {
  it('หน้าปลายทางของแต่ละจอ', () => {
    expect(compatibilityBackHref('love')).toBe('/v2/service/compatibility/love')
    expect(compatibilityBackHref('colleague')).toBe('/v2/service/compatibility/colleague')
    expect(compatibilityBackHref(undefined)).toBe(COMPAT_HUB_HREF)
    expect(COMPAT_HUB_HREF).toBe('/v2/service')
  })

  it('สามบทบาทของเพื่อนร่วมงาน กลับไปจอเพื่อนร่วมงานทุกค่า', () => {
    expect(compatibilityKindOfMatchingType('LOVE')).toBe('love')
    // Read from COLLEAGUE_ROLES itself, not from a list retyped here: adding a fourth role and forgetting
    // the map turns THIS red rather than shipping a role that falls through to the hub.
    for (const role of COLLEAGUE_ROLES) {
      expect(compatibilityKindOfMatchingType(role.value)).toBe('colleague')
    }
    expect(COLLEAGUE_ROLES.map((r) => r.value).sort()).toEqual(['BOSS', 'EMPLOYEE', 'FRIEND'])
  })

  it('ค่าที่ไม่รู้จักกลับไป hub ❌ ไม่ใช่เดาเป็น love', () => {
    for (const bad of ['', 'love', 'colleague', 'PARTNER', 'boss', null, undefined, 0, {}, [], 'constructor', '__proto__']) {
      expect(compatibilityKindOfMatchingType(bad as unknown)).toBeNull()
    }
    // and the href for every one of them is the hub
    expect(compatibilityBackHref(compatibilityKindOfMatchingType('PARTNER') ?? undefined)).toBe(COMPAT_HUB_HREF)
  })

  it('applyMatchingKind ไม่แตะผลลัพธ์เมื่อไม่มี kind และไม่สร้าง object ใหม่โดยเปล่าประโยชน์', () => {
    const base = { persons: {} }
    expect(applyMatchingKind(null, respFor('LOVE'))).toBeNull()
    expect(applyMatchingKind(base, respFor('NOPE'))).toBe(base) // same reference → no re-render
    expect(applyMatchingKind(base, respFor('LOVE'))).toEqual({ persons: {}, kind: 'love' })
  })
})

// -------------------------------------------------------------- wiring layer
describe('#571 wiring — ค่าเดินทางจาก route ถึงปุ่มจริงบนจอ', () => {
  it('เข้าจากคู่รัก แล้วปุ่มย้อนกลับชี้ที่จอคู่รัก', async () => {
    getDetail.mockResolvedValue(respFor('LOVE'))
    const { result } = renderHook(() => useCompatibilityResult('m-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.result!.kind).toBe('love')
  })

  it('เข้าจากเพื่อนร่วมงาน แล้วปุ่มย้อนกลับชี้ที่จอเพื่อนร่วมงาน — ทั้งสามบทบาท', async () => {
    for (const role of COLLEAGUE_ROLES) {
      getDetail.mockResolvedValue(respFor(role.value))
      const { result, unmount } = renderHook(() => useCompatibilityResult(`m-${role.value}`))
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.result!.kind).toBe('colleague')
      unmount()
    }
  })

  it('ค่าที่ map ไม่ได้ ⇒ ไม่มี kind ⇒ จอใช้ hub', async () => {
    getDetail.mockResolvedValue(respFor('SOMETHING_NEW'))
    const { result } = renderHook(() => useCompatibilityResult('m-2'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.result).not.toBeNull() // the result still renders — only the destination differs
    expect(result.current.result!.kind).toBeUndefined()
    expect(compatibilityBackHref(result.current.result!.kind)).toBe(COMPAT_HUB_HREF)
  })

  it('ปุ่มบนจอจริง — href ที่ render ออกมา ไม่ใช่ค่าที่ hook ถือไว้เฉย ๆ', async () => {
    // The assertion that cannot be faked: the anchor the user actually presses. A hook holding the right
    // kind while the screen keeps a hardcoded href passes every case above and fails this one.
    getDetail.mockResolvedValue(respFor('BOSS'))
    render(<CompatibilityResultScreen matchingId="m-3" />)
    const back = await screen.findByLabelText('ย้อนกลับ')
    expect(back.getAttribute('href')).toBe('/v2/service/compatibility/colleague')
  })

  it('เปิดจากลิงก์ตรง (ไม่มีค่าที่ carry มาจากฟอร์ม) ปุ่มยังถูก', async () => {
    // DoD row 3. Nothing is seeded into storage here, so the only source of the destination is the route's
    // response — which is the whole point of reading it from the row instead of from the referrer.
    getDetail.mockResolvedValue(respFor('LOVE'))
    render(<CompatibilityResultScreen matchingId="m-4" />)
    const back = await screen.findByLabelText('ย้อนกลับ')
    expect(back.getAttribute('href')).toBe('/v2/service/compatibility/love')
  })
})
