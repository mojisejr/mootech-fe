// #439 — teeth for "the bank can send the cardholder back to us". MAIN lane.
//
// The incident: a real card was refused on 2026-08-25 with
//   failure_message: "3d secure is requested but return_uri is not set"
// The card was Omise's own "successful" test card. It was never judged — enrollment failed first.
//
// 🔴 MUTANT CONTRACT (each line must redden a DIFFERENT test):
//   MZ1  drop `...cardReturnUriFields(...)` from createCardCharge   → "card sends return_uri" reddens
//   MZ2  point the PromptPay lane at the card's env too             → "the two lanes stay apart" reddens
//   MZ3  make cardReturnUri fall back to a constant when unset      → "unset changes nothing" reddens
//   MZ4  drop authorize_uri from readOutcome                        → "the bank's page reaches the caller" reddens
//   MZ5  accept http:// or localhost as the origin                  → the validation tests redden
import { describe, it, expect, vi, afterEach } from 'vitest'
import { omiseGateway } from '@/lib/payment/omise-gateway'
import { cardReturnUri, cardReturnUriFields, ReturnUriConfigError, CARD_RETURN_ORIGIN_ENV } from '@/lib/payment/return-uri'

const ORIGIN = 'https://mumate.example.com'
const WEBHOOK = 'https://mumate.example.com/api/v2/payment/webhook'

function mockOmise(responses: Record<string, unknown>[]) {
  const calls: Array<{ path: string; form: URLSearchParams }> = []
  let i = 0
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: { body?: string }) => {
    calls.push({ path: String(url), form: new URLSearchParams(init?.body ?? '') })
    const body = responses[Math.min(i++, responses.length - 1)]
    return { ok: true, status: 200, json: async () => body } as unknown as Response
  }))
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('#439 the URL we hand the bank', () => {
  it('carries OUR orderId — the only id that exists before Omise mints one', () => {
    const uri = cardReturnUri({ orderId: '0123456789', packageCode: 'V2_PRO_YEARLY' }, { [CARD_RETURN_ORIGIN_ENV]: ORIGIN })
    const u = new URL(uri as string)
    expect(u.origin).toBe(ORIGIN)
    expect(u.pathname).toBe('/v2/shop/result')
    expect(u.searchParams.get('order')).toBe('0123456789')
    // #438's road back out, in case the bank declines after authentication
    expect(u.searchParams.get('package_code')).toBe('V2_PRO_YEARLY')
    expect(u.searchParams.get('state')).toBe('PAYING')
    // 🔴 never a charge id: it does not exist yet at the moment this URL is built
    expect(uri).not.toContain('charge=')
  })

  it('🔴 MZ3 — unset env changes NOTHING (this is what makes code-before-env safe)', () => {
    expect(cardReturnUri({ orderId: 'o', packageCode: 'p' }, {})).toBeNull()
    expect(cardReturnUriFields({ orderId: 'o', packageCode: 'p' }, {})).toEqual({})
    expect(cardReturnUri({ orderId: 'o', packageCode: 'p' }, { [CARD_RETURN_ORIGIN_ENV]: '   ' })).toBeNull()
  })

  it('🔴 MZ5 — an origin the bank cannot redirect a real browser to is refused, not patched', () => {
    // the BANK redirects the CUSTOMER'S browser — localhost is this machine, not theirs
    for (const bad of ['http://mumate.example.com', 'https://localhost:3000', 'https://127.0.0.1']) {
      expect(() => cardReturnUri({ orderId: 'o', packageCode: 'p' }, { [CARD_RETURN_ORIGIN_ENV]: bad }), bad).toThrow(ReturnUriConfigError)
    }
    expect(() => cardReturnUri({ orderId: 'o', packageCode: 'p' }, { [CARD_RETURN_ORIGIN_ENV]: 'not a url' })).toThrow(ReturnUriConfigError)
  })
})

describe('#439 the field actually goes out — and only on the card lane', () => {
  it('🔴 MZ1 — a card charge sends return_uri', async () => {
    vi.stubEnv('OMISE_SECRET_KEY', 'skey_test_x')
    vi.stubEnv('OMISE_WEBHOOK_URL_V2', WEBHOOK)
    vi.stubEnv(CARD_RETURN_ORIGIN_ENV, ORIGIN)
    const calls = mockOmise([{ id: 'chrg_1' }])

    await omiseGateway.createCardCharge({ amountSatang: 79000, token: 'tokn_1', email: 'a@b.co', orderId: 'ord_1', packageCode: 'PKG' })

    const sent = calls[0].form.get('return_uri')
    expect(sent).toBeTruthy()
    expect(new URL(sent as string).searchParams.get('order')).toBe('ord_1')
  })

  // 🔴 MZ2 — THE TOOTH ฟีม ASKED FOR. ฟีม เคาะทาง B: touch the card lane, leave PromptPay exactly where it
  // is (a PromptPay charge is sitting PENDING and unexplained; moving its variables mid-investigation makes
  // the investigation worthless). The two lanes shared ONE env before this ticket, so "we only changed the
  // card" was a promise, not a fact. This test makes it a fact.
  it('🔴 MZ2 — configuring the CARD lane does not put return_uri on a PromptPay charge', async () => {
    vi.stubEnv('OMISE_SECRET_KEY', 'skey_test_x')
    vi.stubEnv('OMISE_WEBHOOK_URL_V2', WEBHOOK)
    vi.stubEnv(CARD_RETURN_ORIGIN_ENV, ORIGIN) // card lane ON
    // OMISE_RETURN_URI (the PromptPay one) deliberately left unset — as it is on prod
    const calls = mockOmise([{ id: 'src_1' }, { id: 'chrg_2', source: {} }])

    await omiseGateway.createPromptPayCharge({ amountSatang: 79000, email: 'a@b.co', orderId: 'ord_2' })

    const chargePost = calls.find((c) => c.path.endsWith('/charges'))
    expect(chargePost, 'the /charges POST must exist').toBeTruthy()
    expect(chargePost?.form.get('return_uri'), 'PromptPay must not inherit the card lane config').toBeNull()
  })

  it('🔴 MZ2 (other direction) — configuring PromptPay does not put ITS url on a card charge', async () => {
    vi.stubEnv('OMISE_SECRET_KEY', 'skey_test_x')
    vi.stubEnv('OMISE_WEBHOOK_URL_V2', WEBHOOK)
    vi.stubEnv('OMISE_RETURN_URI', 'https://old.example.com/legacy') // PromptPay lane ON
    // the card lane's own env left unset
    const calls = mockOmise([{ id: 'chrg_3' }])

    await omiseGateway.createCardCharge({ amountSatang: 100, token: 't', email: 'a@b.co', orderId: 'ord_3', packageCode: 'P' })

    expect(calls[0].form.get('return_uri'), 'the card lane must not read the PromptPay env').toBeNull()
  })
})

describe('#439 the bank page reaches the caller instead of being thrown away', () => {
  it('🔴 MZ4 — authorize_uri survives the adapter', async () => {
    vi.stubEnv('OMISE_SECRET_KEY', 'skey_test_x')
    vi.stubEnv('OMISE_WEBHOOK_URL_V2', WEBHOOK)
    vi.stubEnv(CARD_RETURN_ORIGIN_ENV, ORIGIN)
    mockOmise([{ id: 'chrg_4', status: 'pending', paid: false, authorize_uri: 'https://bank.example/3ds/abc' }])

    const out = await omiseGateway.createCardCharge({ amountSatang: 100, token: 't', email: 'a@b.co', orderId: 'o', packageCode: 'P' })

    expect(out.authorizeUri).toBe('https://bank.example/3ds/abc')
    // and the outcome fields #437 added are still intact alongside it
    expect(out.status).toBe('pending')
    expect(out.paid).toBe(false)
  })

  it('a charge that needs no authentication carries no authorizeUri', async () => {
    vi.stubEnv('OMISE_SECRET_KEY', 'skey_test_x')
    vi.stubEnv('OMISE_WEBHOOK_URL_V2', WEBHOOK)
    mockOmise([{ id: 'chrg_5', status: 'successful', paid: true }])
    const out = await omiseGateway.createCardCharge({ amountSatang: 100, token: 't', email: 'a@b.co', orderId: 'o', packageCode: 'P' })
    expect(out.authorizeUri).toBeNull()
  })
})
