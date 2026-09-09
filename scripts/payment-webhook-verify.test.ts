// #355 — teeth for the Omise webhook signature verify. PURE crypto, MAIN lane (lesson ②: a money gate must
// redden in npm test, not only in a DB suite).
//
// 🔴 MUTANT CONTRACT (each reddens npm test):
//   MV1  verify stops failing closed on a missing secret/signature/timestamp  → the fail-closed test reddens
//   MV2  verify accepts a wrong signature (drops the compare)                 → the wrong-sig test reddens
//   MV3  verify hashes something other than `${ts}.` + the RAW body           → the tampered-body test reddens
//   MV4  verify stops SPLITTING Omise-Signature on commas                     → 4 of the 5 accept-tests redden
//
// 🔴 MV4 is the one that reached production. Every test above it builds a SINGLE-signature header, which is
// the shape Omise stops sending the moment a secret is rolled — so the whole suite stayed green while the
// live endpoint answered 401 to seven consecutive deliveries on 2026-09-09. A green suite is what let the
// defect ship. The tests below carry the shape the vendor actually sends during a roll.
import { describe, it, expect } from 'vitest'
import { verifyOmiseSignature, signOmisePayload, describeSignatureHeader } from '@/lib/payment/webhook-verify'

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

// 🔴 #355 — the rolled-secret shape. Omise keeps the PREVIOUS webhook secret valid for 24 hours after a
// roll and signs every delivery in that window with BOTH, delivered as comma-separated hex digests in one
// Omise-Signature header. The old verifier compared the whole header against one 64-character digest behind
// a length check, so a ~129-character header was refused before any comparison happened.
describe('verifyOmiseSignature — a rolled secret sends more than one signature (MV4)', () => {
  const raw = body({ key: 'charge.complete', data: { id: 'chrg_test_1', status: 'successful', paid: true } })
  // OTHER is the secret we do NOT hold — the other half of the pair during a roll. Only `good` can match.
  const OTHER = Buffer.from('whsec_test_the_other_half_of_the_roll').toString('base64')
  const good = signOmisePayload(raw, TS, SECRET)
  const other = signOmisePayload(raw, TS, OTHER)

  // 🔴 This one does NOT redden under MV4, and the reason is worth knowing rather than hiding: with the
  // comparison on decoded bytes, `Buffer.from('<ours>,<theirs>', 'hex')` stops at the comma and hands back
  // exactly our 32 bytes, so an unsplit verifier accepts this header by accident. It survives only while
  // ours happens to come FIRST — which is why the next test, not this one, is the tooth. Kept because it
  // is the shape production actually received, and a reader deserves to see it asserted.
  it('accepts when OURS is the first of two (passes the unsplit mutant too — see the note above)', () => {
    expect(verifyOmiseSignature(raw, `${good},${other}`, TS, SECRET)).toBe(true)
  })

  // 🔴 THE tooth for MV4. Nothing but a real comma split makes this pass.
  it('accepts when OURS is the second of two — order is not assumed', () => {
    expect(verifyOmiseSignature(raw, `${other},${good}`, TS, SECRET)).toBe(true)
  })

  it('accepts with whitespace after the comma — the specification never promised there is none', () => {
    expect(verifyOmiseSignature(raw, `${other}, ${good}`, TS, SECRET)).toBe(true)
  })

  it('accepts UPPER-CASE hex — bytes are compared, not hex text, because no case is promised', () => {
    expect(verifyOmiseSignature(raw, good.toUpperCase(), TS, SECRET)).toBe(true)
    expect(verifyOmiseSignature(raw, `${other},${good.toUpperCase()}`, TS, SECRET)).toBe(true)
  })

  it('accepts when ours is third of three — two is what a roll sends today, not a documented maximum', () => {
    expect(verifyOmiseSignature(raw, `${other},${'ab'.repeat(32)},${good}`, TS, SECRET)).toBe(true)
  })

  it('🔴 REJECTS a two-signature header where NEITHER is ours — splitting must not become accepting', () => {
    expect(verifyOmiseSignature(raw, `${other},${'ab'.repeat(32)}`, TS, SECRET)).toBe(false)
  })

  it('rejects, without throwing, a header of empty and junk parts', () => {
    expect(verifyOmiseSignature(raw, ',,', TS, SECRET)).toBe(false)
    expect(verifyOmiseSignature(raw, `nothex,${'zz'.repeat(32)}`, TS, SECRET)).toBe(false)
    expect(verifyOmiseSignature(raw, `${good},`, TS, SECRET)).toBe(true) // a trailing comma must not lose ours
  })

  it('a tampered body is still rejected even when the header carries two signatures', () => {
    const tampered = body({ key: 'charge.complete', data: { id: 'chrg_test_1', status: 'successful', paid: true, amount: 1 } })
    expect(verifyOmiseSignature(tampered, `${good},${other}`, TS, SECRET)).toBe(false)
  })
})

// The 401 branch's log line. It exists because on 2026-09-09 nobody could answer "how many signatures did
// that header carry?" — two hours went into keys, modes and timelines instead. It must never print a
// signature, a secret, or anything about the payer.
describe('describeSignatureHeader', () => {
  const raw = body({ key: 'charge.complete' })
  const good = signOmisePayload(raw, TS, SECRET)

  it('names the shape and nothing else', () => {
    expect(describeSignatureHeader(good)).toBe('len=64 parts=1')
    expect(describeSignatureHeader(`${good},${good}`)).toBe('len=129 parts=2')
    expect(describeSignatureHeader(null)).toBe('absent')
    expect(describeSignatureHeader('')).toBe('absent')
  })

  it('🔴 leaks no part of the signature itself', () => {
    const described = describeSignatureHeader(good)
    expect(described).not.toContain(good)
    expect(described).not.toContain(good.slice(0, 8))
  })
})
