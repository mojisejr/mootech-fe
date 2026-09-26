// mumate-login-identity-001 slice 4 — the merge ticket's anti-forgery rules.
//
// ANCHOR: scripts/merge-ticket.test.ts#a-ticket-is-proof-or-it-is-nothing
// Bug-class this owns: the confirm step trusting a value the browser can shape. The
// ticket carries a subject the provider attested, and moving a credential on the
// strength of an unverified one is account takeover — set another member's subject,
// confirm, and their login method lands on your account.
//
// The last case in the first block is the one that would be easiest to leave out:
// this module and lib/auth/link-state.ts sign with the SAME secret, so a value
// minted by one must not be spendable at the other.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import {
  MERGE_TICKET_TTL_MS,
  clearMergeTicketCookie,
  issueMergeTicket,
  mergeTicketCookie,
  mergeTicketCookieName,
  verifyMergeTicket,
  type MergeTicketClaims,
} from '@/lib/auth/merge-ticket'
import { issueLinkState } from '@/lib/auth/link-state'

const SECRET = 'merge-ticket-test-secret'
const NOW = 1_800_000_000_000

const CLAIMS: MergeTicketClaims = {
  signedInUserId: 'signed-in-user',
  provider: 'google',
  subject: '104081630471234567890',
  survivorUserId: 'signed-in-user',
  loserUserId: 'other-user',
}

const EXPECTED = { provider: 'google', signedInUserId: 'signed-in-user' }

let saved: string | undefined
beforeAll(() => {
  saved = process.env.LINK_STATE_SECRET
  process.env.LINK_STATE_SECRET = SECRET
})
afterAll(() => {
  if (saved === undefined) delete process.env.LINK_STATE_SECRET
  else process.env.LINK_STATE_SECRET = saved
})

describe('a ticket is proof, or it is nothing', () => {
  it('round-trips the claims it was issued with', () => {
    const cookie = issueMergeTicket(CLAIMS, NOW)

    const result = verifyMergeTicket(cookie, EXPECTED, NOW + 1_000)

    expect(result).toEqual({ ok: true, value: CLAIMS })
  })

  it('refuses a ticket whose payload was edited, even by one character', () => {
    const cookie = issueMergeTicket(CLAIMS, NOW)
    const [encoded, mac] = cookie.split('.')
    const decoded = JSON.parse(Buffer.from(encoded!, 'base64url').toString('utf8'))
    decoded.l = 'some-other-victim'
    const forged = `${Buffer.from(JSON.stringify(decoded)).toString('base64url')}.${mac}`

    expect(verifyMergeTicket(forged, EXPECTED, NOW)).toEqual({ ok: false, reason: 'bad-signature' })
  })

  it('refuses a ticket signed with a different secret', () => {
    const cookie = issueMergeTicket(CLAIMS, NOW)
    process.env.LINK_STATE_SECRET = 'a-different-secret'
    try {
      expect(verifyMergeTicket(cookie, EXPECTED, NOW)).toEqual({ ok: false, reason: 'bad-signature' })
    } finally {
      process.env.LINK_STATE_SECRET = SECRET
    }
  })

  it('cannot be satisfied by a LINK-STATE cookie, though both are signed with the same secret', () => {
    // The domain prefix is what makes this structurally impossible rather than
    // relying on the field checks to reject it.
    const linkState = issueLinkState(
      { userId: 'signed-in-user', provider: 'google', returnTo: '/v2/settings/connected' },
      NOW,
    ).cookieValue

    expect(verifyMergeTicket(linkState, EXPECTED, NOW)).toEqual({ ok: false, reason: 'bad-signature' })
  })

  it('throws rather than signing with a fallback when LINK_STATE_SECRET is unset', () => {
    delete process.env.LINK_STATE_SECRET
    try {
      expect(() => issueMergeTicket(CLAIMS, NOW)).toThrow(/LINK_STATE_SECRET/)
    } finally {
      process.env.LINK_STATE_SECRET = SECRET
    }
  })
})

describe('the ticket is bound to a session, a provider, and a moment', () => {
  it('refuses a ticket presented by a different session', () => {
    const cookie = issueMergeTicket(CLAIMS, NOW)

    const result = verifyMergeTicket(cookie, { provider: 'google', signedInUserId: 'someone-else' }, NOW)

    expect(result).toEqual({ ok: false, reason: 'session-mismatch' })
  })

  it('refuses a ticket minted for one provider at another provider’s step', () => {
    const cookie = issueMergeTicket(CLAIMS, NOW)

    expect(verifyMergeTicket(cookie, { provider: 'line', signedInUserId: 'signed-in-user' }, NOW)).toEqual({
      ok: false,
      reason: 'provider-mismatch',
    })
  })

  it('expires, and expires exactly at the boundary rather than a moment late', () => {
    const cookie = issueMergeTicket(CLAIMS, NOW)

    expect(verifyMergeTicket(cookie, EXPECTED, NOW + MERGE_TICKET_TTL_MS)).toMatchObject({ ok: true })
    expect(verifyMergeTicket(cookie, EXPECTED, NOW + MERGE_TICKET_TTL_MS + 1)).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('refuses a ticket dated in the future, which a correct issuer never produces', () => {
    const cookie = issueMergeTicket(CLAIMS, NOW)

    expect(verifyMergeTicket(cookie, EXPECTED, NOW - 1)).toEqual({ ok: false, reason: 'expired' })
  })

  it('reports a missing or shapeless cookie without pretending to read it', () => {
    expect(verifyMergeTicket(undefined, EXPECTED, NOW)).toEqual({ ok: false, reason: 'missing' })
    expect(verifyMergeTicket('', EXPECTED, NOW)).toEqual({ ok: false, reason: 'missing' })
    expect(verifyMergeTicket('no-dot-here', EXPECTED, NOW)).toEqual({ ok: false, reason: 'malformed' })
    expect(verifyMergeTicket('.leading', EXPECTED, NOW)).toEqual({ ok: false, reason: 'malformed' })
    expect(verifyMergeTicket('trailing.', EXPECTED, NOW)).toEqual({ ok: false, reason: 'malformed' })
  })

  it('refuses a correctly signed blob that is not a ticket', () => {
    // Signed by us, so the signature passes; the shape must still be checked.
    const encoded = Buffer.from(JSON.stringify({ hello: 'world' })).toString('base64url')
    const { createHmac } = require('node:crypto') as typeof import('node:crypto')
    const mac = createHmac('sha256', SECRET).update(`mumate.merge-ticket.v1.${encoded}`).digest('base64url')

    expect(verifyMergeTicket(`${encoded}.${mac}`, EXPECTED, NOW)).toEqual({ ok: false, reason: 'malformed' })
  })
})

describe('the cookie carries the attributes that make it safe', () => {
  it('is HttpOnly and SameSite=Lax, and never SameSite=None', () => {
    const cookie = mergeTicketCookie('google', 'value', { secure: true })

    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).not.toContain('SameSite=None')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain(`Max-Age=${MERGE_TICKET_TTL_MS / 1000}`)
  })

  it('drops Secure only for plain-HTTP local development', () => {
    expect(mergeTicketCookie('google', 'value', { secure: false })).not.toContain('Secure')
  })

  it('names one cookie per provider so two tabs cannot clobber each other', () => {
    expect(mergeTicketCookieName('google')).toBe('mumate_merge_google')
    expect(mergeTicketCookieName('LINE')).toBe('mumate_merge_line')
  })

  it('clears with Max-Age=0 so one offer is spendable exactly once', () => {
    const cleared = clearMergeTicketCookie('google', { secure: true })

    expect(cleared).toContain('Max-Age=0')
    expect(cleared).toContain('HttpOnly')
    expect(cleared).toContain('mumate_merge_google=')
  })
})

describe('issuing refuses to make a ticket that means nothing', () => {
  it('requires every field the confirm step will rely on', () => {
    expect(() => issueMergeTicket({ ...CLAIMS, signedInUserId: ' ' }, NOW)).toThrow(/signedInUserId/)
    expect(() => issueMergeTicket({ ...CLAIMS, provider: '' }, NOW)).toThrow(/provider/)
    expect(() => issueMergeTicket({ ...CLAIMS, subject: '  ' }, NOW)).toThrow(/subject/)
    expect(() => issueMergeTicket({ ...CLAIMS, loserUserId: '' }, NOW)).toThrow(/both sides/)
  })
})
