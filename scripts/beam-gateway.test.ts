// Beam lane slice 2 — the Beam adapter's HTTP contract with `fetch` stubbed: what we SEND to Beam and how
// we READ what comes back. Field names are Beam's (docs v1.24.0). No network, no env leakage between tests.
//
// 🔴 MUTANT CONTRACT (each reddens this spec):
//   MR1  amount sent in baht instead of satang                      → request case fails
//   MR2  idempotency header dropped                                 → request case fails
//   MR3  expiresAt we ASKED for stored instead of encodedImage.expiry → response case fails
//   MR4  create response read as paid                               → 'no verdict' case fails
//   MR5  404 on GET turned into "not paid" instead of null          → retrieve 404 case fails
//   MR6  createCardCharge reaches the network                        → 'no card yet' case fails
//   MR7  a missing secret reaches the network                        → fail-loud case fails
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { beamGateway, BeamApiError, BeamCardNotAvailableError, BeamConfigError, BEAM_PRODUCTION_API, beamApiBase, mapBeamStatus } from '../lib/payment/beam-gateway'

type Call = { url: string; init: RequestInit }
let calls: Call[]
let respond: (c: Call) => { status: number; body: unknown; headers?: Record<string, string> }

const SAVED = { ...process.env }
beforeEach(() => {
  calls = []
  process.env.BEAM_MERCHANT_ID = 'm_test'
  process.env.BEAM_API_KEY = 'k_test'
  process.env.BEAM_WEBHOOK_HMAC_KEY = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64')
  process.env.BEAM_API_BASE = 'https://playground.api.beamcheckout.com'
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const c = { url, init }
      calls.push(c)
      const r = respond(c)
      return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json', ...(r.headers ?? {}) } })
    }),
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  for (const k of Object.keys(process.env)) if (!(k in SAVED)) delete process.env[k]
  Object.assign(process.env, SAVED)
})

const okCreate = () => ({
  status: 201,
  body: {
    chargeId: 'ch_2xTsz7Qit55pahSvKfJG3UMkpFQ',
    actionRequired: 'ENCODED_IMAGE',
    paymentMethodType: 'QR_PROMPT_PAY',
    encodedImage: { expiry: '2026-09-13T12:30:00Z', imageBase64Encoded: 'iVBORw0KGgoAAAANSUhEUg==', rawData: '00020101021229370016A000000677010111' },
  },
  headers: { 'x-beam-request-id': 'req_1' },
})

describe('createPromptPayCharge — request', () => {
  it('POSTs /api/v1/charges with Basic merchant:apiKey, satang amount, THB, QR_PROMPT_PAY, referenceId=orderId, idempotency key', async () => {
    respond = okCreate
    const before = Date.now()
    await beamGateway.createPromptPayCharge({ amountSatang: 79000, email: 'u@example.com', orderId: '1234567890' })
    expect(calls).toHaveLength(1)
    const [c] = calls
    expect(c.url).toBe('https://playground.api.beamcheckout.com/api/v1/charges')
    expect(c.init.method).toBe('POST')
    const h = c.init.headers as Record<string, string>
    expect(h.Authorization).toBe('Basic ' + Buffer.from('m_test:k_test').toString('base64'))
    expect(h['Content-Type']).toBe('application/json')
    expect(h['x-beam-idempotency-key']).toBe('promptpay:1234567890')
    const body = JSON.parse(String(c.init.body))
    expect(body).toMatchObject({
      amount: 79000, // satang, the unit the row stores — never divided
      currency: 'THB',
      referenceId: '1234567890',
      paymentMethod: { paymentMethodType: 'QR_PROMPT_PAY' },
      customer: { email: 'u@example.com' },
    })
    // expiresAt (the spec's field name — not the prose's expiryTime) ≈ now + 15 min
    const exp = Date.parse(body.paymentMethod.qrPromptPay.expiresAt)
    expect(exp - before).toBeGreaterThan(14 * 60_000)
    expect(exp - before).toBeLessThan(16 * 60_000)
    expect(body.paymentMethod.qrPromptPay.expiryTime).toBeUndefined()
  })

  it('omits customer when there is no email (Beam validates the shape; an empty email is a 400)', async () => {
    respond = okCreate
    await beamGateway.createPromptPayCharge({ amountSatang: 100, email: '', orderId: '1' })
    expect(JSON.parse(String(calls[0].init.body)).customer).toBeUndefined()
  })
})

describe('createPromptPayCharge — response', () => {
  it('returns the charge id, the QR as a data: URI, and the expiry BEAM set (not the one we asked for)', async () => {
    respond = okCreate
    const r = await beamGateway.createPromptPayCharge({ amountSatang: 100, email: '', orderId: '1' })
    expect(r.chargeId).toBe('ch_2xTsz7Qit55pahSvKfJG3UMkpFQ')
    expect(r.qrDownloadUri).toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==')
    expect(r.expiresAt).toBe('2026-09-13T12:30:00Z')
  })

  it('🔴 carries NO verdict: paid:false status:pending, so charge-flow keeps the row PENDING (201 ≠ paid)', async () => {
    respond = okCreate
    const r = await beamGateway.createPromptPayCharge({ amountSatang: 100, email: '', orderId: '1' })
    expect(r.paid).toBe(false)
    expect(r.status).toBe('pending')
    expect(r.failureCode).toBeNull()
    expect(r.authorizeUri).toBeNull()
  })

  it('a rejected request (4xx) throws BeamApiError naming Beam’s errorCode and request id — charge-flow releases the hold', async () => {
    respond = () => ({ status: 400, body: { code: 400, message: 'bad', error: { errorCode: 'API_VALIDATION_ERROR', errorMessage: 'amount' } }, headers: { 'x-beam-request-id': 'req_9' } })
    await expect(beamGateway.createPromptPayCharge({ amountSatang: 0, email: '', orderId: '1' })).rejects.toMatchObject({
      name: 'BeamApiError',
      errorCode: 'API_VALIDATION_ERROR',
      httpStatus: 400,
      requestId: 'req_9',
    })
  })
})

describe('retrieveCharge — the reconciler’s read', () => {
  const charge = (status: string, failureCode = '') => ({ status: 200, body: { chargeId: 'ch_1', status, failureCode, referenceId: '1', amount: 100, currency: 'THB' } })

  it('SUCCEEDED ⇒ paid/successful (the same words gatewaySaysPaid judges)', async () => {
    respond = () => charge('SUCCEEDED')
    expect(await beamGateway.retrieveCharge('ch_1')).toMatchObject({ chargeId: 'ch_1', paid: true, status: 'successful' })
    expect(calls[0].url).toBe('https://playground.api.beamcheckout.com/api/v1/charges/ch_1')
    expect(calls[0].init.method ?? 'GET').toBe('GET')
  })

  it('FAILED ⇒ failed + Beam’s failureCode (the reconciler abandons with the gateway’s own reason)', async () => {
    respond = () => charge('FAILED', 'CH_CARD_DECLINED')
    expect(await beamGateway.retrieveCharge('ch_1')).toMatchObject({ paid: false, status: 'failed', failureCode: 'CH_CARD_DECLINED' })
  })

  it('PENDING ⇒ pending (not terminal: the row waits; our own expiry decides when to give up)', async () => {
    respond = () => charge('PENDING')
    expect(await beamGateway.retrieveCharge('ch_1')).toMatchObject({ paid: false, status: 'pending', failureCode: null })
  })

  it('🔴 404 ⇒ null ("Beam does not know this charge"), never "not paid"', async () => {
    respond = () => ({ status: 404, body: { code: 404, error: { errorCode: 'NOT_FOUND_ERROR' } } })
    expect(await beamGateway.retrieveCharge('ch_nope')).toBeNull()
  })

  it('429 / 5xx ⇒ throws (runReconcile counts it unreachable and tries next run)', async () => {
    respond = () => ({ status: 429, body: { code: 429, error: { errorCode: 'TOO_MANY_REQUESTS_ERROR' } } })
    await expect(beamGateway.retrieveCharge('ch_1')).rejects.toBeInstanceOf(BeamApiError)
  })

  it('mapBeamStatus: the three words, and an unknown word passes through lower-cased and unpaid', () => {
    expect(mapBeamStatus('SUCCEEDED')).toEqual({ paid: true, status: 'successful' })
    expect(mapBeamStatus('FAILED')).toEqual({ paid: false, status: 'failed' })
    expect(mapBeamStatus('PENDING')).toEqual({ paid: false, status: 'pending' })
    expect(mapBeamStatus('SOMETHING_NEW')).toEqual({ paid: false, status: 'something_new' })
    expect(mapBeamStatus(undefined)).toEqual({ paid: false, status: '' })
  })
})

describe('fail loud, before the network', () => {
  it('🔴 no card through Beam yet (slice 3 = Payment Links): throws BeamCardNotAvailableError, zero fetches', async () => {
    respond = okCreate
    await expect(beamGateway.createCardCharge({ amountSatang: 100, token: 't', email: '', orderId: '1' })).rejects.toBeInstanceOf(BeamCardNotAvailableError)
    expect(calls).toHaveLength(0)
  })

  it('🔴 a missing BEAM_API_KEY throws BeamConfigError naming the variable, zero fetches', async () => {
    respond = okCreate
    delete process.env.BEAM_API_KEY
    await expect(beamGateway.createPromptPayCharge({ amountSatang: 100, email: '', orderId: '1' })).rejects.toMatchObject({ name: 'BeamConfigError', message: 'BEAM_API_KEY is not configured' })
    expect(calls).toHaveLength(0)
  })

  it('BEAM_API_BASE unset ⇒ production host; a trailing slash is tolerated', () => {
    delete process.env.BEAM_API_BASE
    expect(beamApiBase()).toBe(BEAM_PRODUCTION_API)
    process.env.BEAM_API_BASE = 'https://playground.api.beamcheckout.com/'
    expect(beamApiBase()).toBe('https://playground.api.beamcheckout.com')
  })

  it('verifyWebhook fails closed when BEAM_WEBHOOK_HMAC_KEY is unset', () => {
    delete process.env.BEAM_WEBHOOK_HMAC_KEY
    expect(beamGateway.verifyWebhook(Buffer.from('{}'), 'AAAA', null)).toBe(false)
  })
})
