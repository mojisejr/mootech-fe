// #463 — teeth for "a PromptPay QR is scannable for 5 minutes, then it is not".
//
// 🔴 MUTANT CONTRACT. The bar is a DISTINCT FAILURE SIGNATURE per mutant — the set of reddened tests must
// differ — and the test named for a mutant must be inside that mutant's set. It is NOT "exactly one test
// reddens": removing the field entirely (MU1) necessarily breaks every test that reads its value, and a
// contract written to pretend otherwise would be false on its first run. Signatures fired 2026-08-26:
//   MU1 → {charge-carries, starts-when-QR-exists}      MU2 → {charge-carries, source-has-none, starts-when}
//   MU3 → {starts-when-QR-exists}                      MU4 → {ceiling}
//   MU5 → {zero-or-negative}                           MU6 → {charge-carries, starts-when-QR-exists}
// ⚠️ MU1 and MU6 share a signature: both are "the value on the charge is not now+5min". That is honest —
// this file cannot tell a missing field from a wrong duration, and it does not claim to.
//
// (each mutant, and the test that must be in its set):
//   MU1  drop `...promptPayExpiryFields(new Date())` from createPromptPayCharge
//          → "the charge carries expires_at" reddens
//   MU2  move the spread onto the /sources POST instead of /charges
//          → "the source carries no lifetime of its own" reddens
//   MU3  hoist the spread above the /sources await (compute before the QR exists)
//          → "the 5 minutes start when the QR exists" reddens
//   MU4  raise PROMPTPAY_QR_TTL_MS above Omise's 24h ceiling / drop that guard
//          → "refuses a TTL past Omise's ceiling" reddens
//   MU5  drop the non-positive guard
//          → "refuses a TTL that is zero or negative" reddens
//   MU6  change 5 minutes to any other duration
//          → "exactly five minutes" reddens
//
// 🔑 WHY THESE ASSERT ON A PARSED TIMESTAMP AND NOT ON THE PRESENCE OF A FIELD. ตู๋ killed three
// mutant tests on 2026-08-26 for checking spelling instead of behaviour — a spec that only asks
// `form.get('expires_at') !== null` stays green when the value is yesterday.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { omiseGateway } from '@/lib/payment/omise-gateway'
import {
  promptPayExpiryFields,
  PROMPTPAY_QR_TTL_MS,
  OMISE_MAX_EXPIRY_MS,
  QrExpiryConfigError,
} from '@/lib/payment/qr-expiry'
import { OMISE_WEBHOOK_URL_ENV } from '@/lib/payment/webhook-endpoint'

const GOOD_WEBHOOK = 'https://mumate.example.com/api/v2/payment/webhook'

/** Records every POST. `onCall` runs before the response is produced, so a stage can move the clock. */
function mockOmise(responses: Record<string, unknown>[], onCall?: (path: string) => void) {
  const calls: Array<{ path: string; form: URLSearchParams }> = []
  let i = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: { body?: string }) => {
      calls.push({ path: String(url), form: new URLSearchParams(init?.body ?? '') })
      onCall?.(String(url))
      const body = responses[Math.min(i++, responses.length - 1)]
      return { ok: true, status: 200, json: async () => body } as unknown as Response
    }),
  )
  return calls
}

function withKeys() {
  vi.stubEnv('OMISE_SECRET_KEY', 'skey_test_x')
  vi.stubEnv(OMISE_WEBHOOK_URL_ENV, GOOD_WEBHOOK)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('#463 the QR we hand out stops working', () => {
  it('🔴 the charge carries expires_at, and it is exactly five minutes out (MU1, MU6)', async () => {
    withKeys()
    vi.useFakeTimers()
    const t0 = new Date('2026-08-26T18:00:00.000Z')
    vi.setSystemTime(t0)
    const calls = mockOmise([{ id: 'src_1' }, { id: 'chrg_1', source: {} }])

    await omiseGateway.createPromptPayCharge({ amountSatang: 79000, email: 'a@b.co', orderId: 'ord_1' })

    const charge = calls[1]
    expect(charge.path).toContain('/charges')
    const raw = charge.form.get('expires_at')
    expect(raw).toBeTruthy()
    // Behaviour, not spelling: parse it and measure the distance from the clock we pinned.
    const delta = new Date(String(raw)).getTime() - t0.getTime()
    expect(delta).toBe(5 * 60 * 1000)
  })

  it('🔴 the source carries no lifetime of its own (MU2)', async () => {
    withKeys()
    const calls = mockOmise([{ id: 'src_1' }, { id: 'chrg_1', source: {} }])

    await omiseGateway.createPromptPayCharge({ amountSatang: 79000, email: 'a@b.co', orderId: 'ord_1' })

    const [source] = calls
    expect(source.path).toContain('/sources')
    // 🔴 ONLY the source is asserted here. An added `expect(charge...)` line would make this test redden
    // for MU1 too, and then MU1 and MU2 have the same failure signature — which is how a mutant contract
    // starts lying. Whether the CHARGE carries the field is the first test's job, not this one's.
    expect(source.form.get('expires_at')).toBeNull()
  })

  it('🔴 the 5 minutes start when the QR exists, not when we began asking (MU3)', async () => {
    withKeys()
    vi.useFakeTimers()
    const t0 = new Date('2026-08-26T18:00:00.000Z')
    vi.setSystemTime(t0)
    // /sources is slow: 30s of wall clock passes before the QR is real.
    const calls = mockOmise([{ id: 'src_1' }, { id: 'chrg_1', source: {} }], (path) => {
      if (path.includes('/sources')) vi.advanceTimersByTime(30_000)
    })

    await omiseGateway.createPromptPayCharge({ amountSatang: 79000, email: 'a@b.co', orderId: 'ord_1' })

    const raw = String(calls[1].form.get('expires_at'))
    const delta = new Date(raw).getTime() - t0.getTime()
    // Computed after the source: 30s of latency + the 5 minute lifetime. Hoisting the call gives 5 min flat.
    expect(delta).toBe(30_000 + 5 * 60 * 1000)
  })

  it('🔴 a charge whose QR already expired cannot be produced by this code path', async () => {
    // The whole point of the ticket: the window we send is always in the FUTURE relative to the charge.
    const now = new Date('2026-08-26T18:00:00.000Z')
    const { expires_at } = promptPayExpiryFields(now)
    expect(new Date(expires_at).getTime()).toBeGreaterThan(now.getTime())
  })
})

describe('#463 guards — a wrong lifetime fails at our door, not at the till', () => {
  it('🔴 refuses a TTL past Omise documented 24h ceiling (MU4)', () => {
    const now = new Date('2026-08-26T18:00:00.000Z')
    expect(() => promptPayExpiryFields(now, OMISE_MAX_EXPIRY_MS + 1)).toThrow(QrExpiryConfigError)
    // and the boundary itself is allowed
    expect(() => promptPayExpiryFields(now, OMISE_MAX_EXPIRY_MS)).not.toThrow()
  })

  it('🔴 refuses a TTL that is zero, negative, or not a number (MU5)', () => {
    const now = new Date('2026-08-26T18:00:00.000Z')
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => promptPayExpiryFields(now, bad)).toThrow(QrExpiryConfigError)
    }
  })

  it('the shipped constant is inside the range the guards allow', () => {
    expect(PROMPTPAY_QR_TTL_MS).toBeGreaterThan(0)
    expect(PROMPTPAY_QR_TTL_MS).toBeLessThanOrEqual(OMISE_MAX_EXPIRY_MS)
  })
})
