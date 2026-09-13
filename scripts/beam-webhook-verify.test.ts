// Beam lane slice 2 — the Beam webhook signature against the vector Beam PUBLISHES
// (docs.beamcheckout.com/webhook-authentication): key, body and expected signature copied verbatim.
// If this spec is red, either the docs changed or our implementation drifted — in both cases the route
// would be answering 401 to every real delivery, which is the shape that cost two hours on 2026-09-09
// with Omise (#355). No env: pure function, fixed inputs.
//
// 🔴 MUTANT CONTRACT (each reddens this spec):
//   MR1  digest hex instead of base64            → vector case fails
//   MR2  key used as utf8 instead of base64-decoded → vector case fails
//   MR3  timestamp prepended (Omise habit)       → vector case fails
//   MR4  missing key/signature returns true      → fail-closed cases fail
//   MR5  compare with === on strings of unequal length without length guard → malformed case throws
import { describe, it, expect } from 'vitest'
import { verifyBeamSignature, signBeamPayload } from '../lib/payment/beam-webhook-verify'

// ── verbatim from Beam's docs ──
const KEY_B64 = 'KOFELguf5L1ltuDlkDHGUkPPnQhrgYYijTR4Fqh7APc='
const EXPECTED = '1XzWtJHZ9Y1tmjkA/XZUIn1ZHrUQp1d0Ms0oDQfJBto='
const BODY =
  '{"chargeId":"ch_30GtUweMWec7r2hHIsV5xxQeJKp","merchantId":"m_2sHxsByPwESKYM4nMwdEBdhubPS","referenceId":"order#10001","status":"SUCCEEDED","currency":"THB","amount":3000000,"source":"PAYMENT_LINK","sourceId":"57Iot6c11o","transactionTime":"2025-07-23T10:16:12Z","paymentMethod":{"paymentMethodType":"CARD","card":{"last4":"1111","brand":"VISA"},"cardInstallments":null,"cardNetworkToken":null,"qrPromptPay":null,"alipay":null,"weChatPay":null,"trueMoney":null,"linePay":null,"shopeePay":null,"bangkokBankApp":null,"kPlus":null,"scbEasy":null,"krungsriApp":null},"failureCode":"","customer":{"primaryPhone":{"countryCode":"+66","number":"0958051075"},"email":"","deliveryAddress":{"contactName":"","phone":{"countryCode":"","number":""},"address":{"streetAddress":"","city":"","country":"","postCode":""}}},"createdAt":"2025-07-23T10:15:56.102401Z","updatedAt":"2025-07-23T10:16:17.418991Z"}'
const raw = Buffer.from(BODY, 'utf8')

describe('verifyBeamSignature — Beam’s published vector', () => {
  it('🔴 the documented body + key produce the documented signature, and it verifies', () => {
    expect(signBeamPayload(raw, KEY_B64)).toBe(EXPECTED)
    expect(verifyBeamSignature(raw, EXPECTED, KEY_B64)).toBe(true)
  })

  it('one changed byte in the body fails (raw bytes are the message — never a re-serialised object)', () => {
    const tampered = Buffer.from(BODY.replace('"amount":3000000', '"amount":3000001'), 'utf8')
    expect(verifyBeamSignature(tampered, EXPECTED, KEY_B64)).toBe(false)
    // and JSON that is semantically identical but re-serialised (different whitespace) must ALSO fail —
    // that is why bodyParser is off on the route.
    const reserialised = Buffer.from(JSON.stringify(JSON.parse(BODY), null, 1), 'utf8')
    expect(verifyBeamSignature(reserialised, EXPECTED, KEY_B64)).toBe(false)
  })

  it('a different environment’s key fails (Playground and Production HMAC keys differ)', () => {
    const otherKey = Buffer.from('this is definitely not the key, 32b').toString('base64')
    expect(verifyBeamSignature(raw, EXPECTED, otherKey)).toBe(false)
  })

  it('🔴 fails CLOSED: missing signature, missing key, empty key', () => {
    expect(verifyBeamSignature(raw, null, KEY_B64)).toBe(false)
    expect(verifyBeamSignature(raw, undefined, KEY_B64)).toBe(false)
    expect(verifyBeamSignature(raw, '', KEY_B64)).toBe(false)
    expect(verifyBeamSignature(raw, EXPECTED, undefined)).toBe(false)
    expect(verifyBeamSignature(raw, EXPECTED, '')).toBe(false)
  })

  it('a malformed or wrong-length signature is false, not a throw (a bad header is a 401, not a 500)', () => {
    expect(verifyBeamSignature(raw, 'not base64!!', KEY_B64)).toBe(false)
    expect(verifyBeamSignature(raw, 'AAAA', KEY_B64)).toBe(false)
    expect(verifyBeamSignature(raw, EXPECTED.slice(0, -4) + 'AAAA', KEY_B64)).toBe(false)
  })

  it('tolerates surrounding whitespace in the header value', () => {
    expect(verifyBeamSignature(raw, `  ${EXPECTED}\n`, KEY_B64)).toBe(true)
  })
})
