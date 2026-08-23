// #363 — teeth for the checkout state machine. MAIN lane.
//
// 🔴 MUTANT CONTRACT:
//   MU1  clearCode subtracts locally instead of re-pricing   → "✕ asks the server" reddens
//   MU2  a refused code blanks the quote                     → "a typo is not an outage" reddens
//   MU3  a refused code sets `fatal`                         → same test, different assertion
//   MU4  leak the server's enum onto the screen              → "no enum reaches the user" reddens
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCheckout } from '@/features/v2-shop/useCheckout'

const QUOTE = { quoteId: 'q1', listSatang: 159000, discountSatang: 0, amountSatang: 159000, vatSatang: 10402, vatPercent: 7, codeApplied: null }
const WITH_CODE = { ...QUOTE, quoteId: 'q2', discountSatang: 15900, amountSatang: 143100, codeApplied: 'SAVE10' }

const reply = (fn: (body: Record<string, unknown>) => { ok: boolean; json: unknown }) =>
  vi.stubGlobal('fetch', vi.fn(async (_u: string, init?: { body?: string }) => {
    const body = JSON.parse(init?.body ?? '{}') as Record<string, unknown>
    const r = fn(body)
    return { ok: r.ok, json: async () => r.json }
  }))

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => vi.unstubAllGlobals())

describe('#363 pricing is the server\'s job, every single time', () => {
  it('prices on mount from the package alone', async () => {
    reply(() => ({ ok: true, json: QUOTE }))
    const { result } = renderHook(() => useCheckout('V2_PRO_YEARLY'))
    await waitFor(() => expect(result.current.quote?.amountSatang).toBe(159000))
    expect(result.current.loading).toBe(false)
  })

  it('🔴 ✕ RE-PRICES — it never subtracts the discount on screen', async () => {
    reply((b) => (b.code ? { ok: true, json: WITH_CODE } : { ok: true, json: QUOTE }))
    const { result } = renderHook(() => useCheckout('V2_PRO_YEARLY'))
    await waitFor(() => expect(result.current.quote).toBeTruthy())
    act(() => result.current.setCode('SAVE10'))
    act(() => result.current.applyCode())
    await waitFor(() => expect(result.current.codeState).toBe('success'))
    expect(result.current.quote?.amountSatang).toBe(143100)

    const before = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length
    act(() => result.current.clearCode())
    await waitFor(() => expect(result.current.quote?.amountSatang).toBe(159000))
    // The proof it asked rather than computed: another request went out, and the code went with it.
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBeGreaterThan(before)
    expect(result.current.codeState).toBe('default')
  })

  it('🔴 a refused code leaves the PRICE on screen — a typo must not look like an outage', async () => {
    reply((b) => (b.code ? { ok: false, json: { error: 'nope', codeError: 'INVALID' } } : { ok: true, json: QUOTE }))
    const { result } = renderHook(() => useCheckout('V2_PRO_YEARLY'))
    await waitFor(() => expect(result.current.quote?.amountSatang).toBe(159000))
    act(() => result.current.setCode('NOPE'))
    act(() => result.current.applyCode())
    await waitFor(() => expect(result.current.codeState).toBe('error'))
    // The three things a naive handler destroys.
    expect(result.current.quote?.amountSatang).toBe(159000)
    expect(result.current.fatal).toBe(false)
    expect(result.current.loading).toBe(false)
  })

  it('the server\'s enum never reaches the reader', async () => {
    reply((b) => (b.code ? { ok: false, json: { codeError: 'BELOW_MIN' } } : { ok: true, json: QUOTE }))
    const { result } = renderHook(() => useCheckout('V2_PRO_YEARLY'))
    await waitFor(() => expect(result.current.quote).toBeTruthy())
    act(() => result.current.setCode('X'))
    act(() => result.current.applyCode())
    await waitFor(() => expect(result.current.codeState).toBe('error'))
    expect(result.current.codeError).toBe('ยอดยังไม่ถึงขั้นต่ำของโค้ดนี้')
    expect(result.current.codeError).not.toMatch(/[A-Z_]{4,}/)
  })

  it('an UNKNOWN reason falls back to the design copy rather than showing nothing', async () => {
    reply((b) => (b.code ? { ok: false, json: { codeError: 'SOMETHING_NEW' } } : { ok: true, json: QUOTE }))
    const { result } = renderHook(() => useCheckout('V2_PRO_YEARLY'))
    await waitFor(() => expect(result.current.quote).toBeTruthy())
    act(() => result.current.setCode('X'))
    act(() => result.current.applyCode())
    await waitFor(() => expect(result.current.codeState).toBe('error'))
    // undefined here means DiscountCodeField renders DISCOUNT_ERROR_FALLBACK — never a blank helper row.
    expect(result.current.codeError).toBeUndefined()
  })

  it('typing again clears the error so the user is not shouted at while fixing it', async () => {
    reply((b) => (b.code ? { ok: false, json: { codeError: 'INVALID' } } : { ok: true, json: QUOTE }))
    const { result } = renderHook(() => useCheckout('V2_PRO_YEARLY'))
    await waitFor(() => expect(result.current.quote).toBeTruthy())
    act(() => result.current.setCode('NOPE'))
    act(() => result.current.applyCode())
    await waitFor(() => expect(result.current.codeState).toBe('error'))
    act(() => result.current.setCode('NOPE2'))
    expect(result.current.codeState).toBe('default')
  })

  it('failing to price the PACKAGE is fatal — that one the user cannot work around', async () => {
    reply(() => ({ ok: false, json: { error: 'unknown package_code' } }))
    const { result } = renderHook(() => useCheckout('BOGUS'))
    await waitFor(() => expect(result.current.fatal).toBe(true))
    expect(result.current.quote).toBeNull()
  })
})
