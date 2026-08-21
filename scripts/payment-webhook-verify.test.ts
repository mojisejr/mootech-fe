// #355 — teeth for the Omise webhook signature verify. PURE crypto, MAIN lane (lesson ②: a money gate must
// redden in npm test, not only in a DB suite).
//
// 🔴 MUTANT CONTRACT (each reddens npm test):
//   MV1  verify stops failing closed on a missing secret/signature/timestamp  → the fail-closed test reddens
//   MV2  verify accepts a wrong signature (drops the compare)                 → the wrong-sig test reddens
//   MV3  verify hashes something other than `${ts}.` + the RAW body           → the tampered-body test reddens
import { describe, it, expect } from 'vitest'
import { verifyOmiseSignature, signOmisePayload } from '@/lib/payment/webhook-verify'

// a base64 secret (Omise's webhook secret is base64-decoded before use)
const SECRET = Buffer.from('whsec_test_super_secret_value').toString('base64')
const TS = '1755766800'
const body = (o: unknown) => Buffer.from(JSON.stringify(o), 'utf8')

describe('verifyOmiseSignature', () => {
  const raw = body({ key: 'charge.complete', data: { id: 'chrg_test_1', status: 'successful', paid: true } })
  const good = signOmisePayload(raw, TS, SECRET)

  it('a signature made with the same secret + timestamp + raw body VERIFIES', () => {
    expect(verifyOmiseSignature(raw, good, TS, SECRET)).toBe(true)
  })

  it('MV2 — a wrong signature is rejected', () => {
    expect(verifyOmiseSignature(raw, 'deadbeef'.repeat(8), TS, SECRET)).toBe(false)
    expect(verifyOmiseSignature(raw, signOmisePayload(raw, TS, Buffer.from('other').toString('base64')), TS, SECRET)).toBe(false)
  })

  it('MV3 — a body tampered AFTER signing is rejected (hash is over the raw bytes)', () => {
    const tampered = body({ key: 'charge.complete', data: { id: 'chrg_test_1', status: 'successful', paid: true, amount: 1 } })
    expect(verifyOmiseSignature(tampered, good, TS, SECRET)).toBe(false)
  })

  it('a different timestamp with the same body is rejected (timestamp is in the payload)', () => {
    expect(verifyOmiseSignature(raw, good, '1755766801', SECRET)).toBe(false)
  })

  it('MV1 — fails CLOSED on a missing secret / signature / timestamp / empty body', () => {
    expect(verifyOmiseSignature(raw, good, TS, '')).toBe(false)
    expect(verifyOmiseSignature(raw, good, TS, null)).toBe(false)
    expect(verifyOmiseSignature(raw, '', TS, SECRET)).toBe(false)
    expect(verifyOmiseSignature(raw, good, '', SECRET)).toBe(false)
    expect(verifyOmiseSignature(Buffer.alloc(0), good, TS, SECRET)).toBe(false)
  })

  it('a signature of the wrong length is rejected without throwing (length guard before timingSafeEqual)', () => {
    expect(verifyOmiseSignature(raw, 'abc', TS, SECRET)).toBe(false)
  })
})
