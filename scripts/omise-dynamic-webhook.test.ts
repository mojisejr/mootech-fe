// #374 — teeth for "every v2 charge carries its OWN webhook endpoint". MAIN lane.
//
// 🔴 MUTANT CONTRACT (each line must redden a DIFFERENT test):
//   MU1  drop `...webhook` from createCardCharge      → "card charge sends webhook_endpoints[]" reddens
//   MU2  drop `...webhook` from createPromptPayCharge → "promptpay charge sends webhook_endpoints[]" reddens
//   MU3  fall back to '' / skip the field when the env is unset → "refuses to charge" reddens
//   MU4  move webhookEndpointFields() below the /sources POST   → "no orphan source" reddens
//   MU5  accept http:// or localhost                            → the validation tests redden
//
// 🔑 WHY A MISSING ENV MUST STOP THE CHARGE. Omise delivers a charge's events to `webhook_endpoints` if
// present and otherwise to the ACCOUNT's static webhook — which v1 owns and which points at mootech-be.
// A silent fallback therefore means: money moves, mootech-be receives an event for a charge it has no row
// for, and nobody is provisioned. Every transaction, not a race. Refusing is the safe direction.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { omiseGateway } from '@/lib/payment/omise-gateway'
import {
  v2WebhookUrl,
  webhookEndpointFields,
  WebhookEndpointConfigError,
  OMISE_WEBHOOK_URL_ENV,
} from '@/lib/payment/webhook-endpoint'

const GOOD = 'https://mumate.example.com/api/v2/payment/webhook'

/** Records every POST the adapter makes: [path, decoded form fields]. */
function mockOmise(responses: Record<string, unknown>[]) {
  const calls: Array<{ path: string; form: URLSearchParams }> = []
  let i = 0
  const fetchMock = vi.fn(async (url: string, init: { body?: string }) => {
    calls.push({ path: String(url), form: new URLSearchParams(init?.body ?? '') })
    const body = responses[Math.min(i++, responses.length - 1)]
    return { ok: true, status: 200, json: async () => body } as unknown as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('#374 dynamic webhook — the field actually goes out', () => {
  it('🔴 card charge sends webhook_endpoints[] with the configured URL', async () => {
    vi.stubEnv('OMISE_SECRET_KEY', 'skey_test_x')
    vi.stubEnv(OMISE_WEBHOOK_URL_ENV, GOOD)
    const calls = mockOmise([{ id: 'chrg_1' }])

    await omiseGateway.createCardCharge({ amountSatang: 79000, token: 'tokn_1', email: 'a@b.co', orderId: 'ord_1' })

    expect(calls).toHaveLength(1)
    expect(calls[0].path).toContain('/charges')
    expect(calls[0].form.get('webhook_endpoints[]')).toBe(GOOD)
  })

  it('🔴 promptpay charge sends webhook_endpoints[] on the CHARGE (not on the source)', async () => {
    vi.stubEnv('OMISE_SECRET_KEY', 'skey_test_x')
    vi.stubEnv(OMISE_WEBHOOK_URL_ENV, GOOD)
    const calls = mockOmise([{ id: 'src_1' }, { id: 'chrg_2', source: {} }])

    await omiseGateway.createPromptPayCharge({ amountSatang: 79000, email: 'a@b.co', orderId: 'ord_2' })

    expect(calls).toHaveLength(2)
    const [source, charge] = calls
    expect(source.path).toContain('/sources')
    expect(charge.path).toContain('/charges')
    expect(charge.form.get('webhook_endpoints[]')).toBe(GOOD)
    // The source carries no events of its own; sending it there would be cargo-culting the field.
    expect(source.form.get('webhook_endpoints[]')).toBeNull()
  })
})

describe('#374 a missing endpoint REFUSES to charge — it never falls back to v1\'s static webhook', () => {
  it('🔴 card: throws, and NO request reaches Omise', async () => {
    vi.stubEnv('OMISE_SECRET_KEY', 'skey_test_x')
    vi.stubEnv(OMISE_WEBHOOK_URL_ENV, '')
    const calls = mockOmise([{ id: 'chrg_never' }])

    await expect(
      omiseGateway.createCardCharge({ amountSatang: 1, token: 't', email: 'a@b.co', orderId: 'o' }),
    ).rejects.toBeInstanceOf(WebhookEndpointConfigError)
    expect(calls).toHaveLength(0)
  })

  it('🔴 promptpay: throws BEFORE /sources — no orphan source is left behind', async () => {
    vi.stubEnv('OMISE_SECRET_KEY', 'skey_test_x')
    vi.stubEnv(OMISE_WEBHOOK_URL_ENV, '')
    const calls = mockOmise([{ id: 'src_never' }])

    await expect(
      omiseGateway.createPromptPayCharge({ amountSatang: 1, email: 'a@b.co', orderId: 'o' }),
    ).rejects.toBeInstanceOf(WebhookEndpointConfigError)
    expect(calls).toHaveLength(0)
  })
})

describe('#374 validation mirrors what Omise rejects — so it fails at deploy, not at the till', () => {
  it('accepts a plain https URL', () => {
    expect(v2WebhookUrl({ [OMISE_WEBHOOK_URL_ENV]: GOOD })).toBe(GOOD)
    expect(webhookEndpointFields({ [OMISE_WEBHOOK_URL_ENV]: GOOD })).toEqual({ 'webhook_endpoints[]': GOOD })
  })

  it('🔴 rejects every form Omise rejects', () => {
    const bad = [
      'http://mumate.example.com/hook', // not https
      'https://localhost/hook',
      'https://api.localhost/hook',
      'https://127.0.0.1/hook', // IPv4
      'https://[::1]/hook', // IPv6
      'https://12345/hook', // hostname with only numbers
      'not-a-url',
      '   ',
    ]
    for (const value of bad) {
      expect(() => v2WebhookUrl({ [OMISE_WEBHOOK_URL_ENV]: value })).toThrow(WebhookEndpointConfigError)
    }
  })

  it('🔴 an unset variable is not the same as an empty one — both refuse', () => {
    expect(() => v2WebhookUrl({})).toThrow(WebhookEndpointConfigError)
    expect(() => v2WebhookUrl({ [OMISE_WEBHOOK_URL_ENV]: undefined })).toThrow(WebhookEndpointConfigError)
  })
})
