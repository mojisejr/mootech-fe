// mumate-member-identity-hardening-001 slice 1 step 1 — the signed member cookie ("ตราสมาชิก").
//
// The #391 fallback used to trust `cookie-mumate-id` alone when the NextAuth session was missing.
// That cookie is set client-side and is not httpOnly, so it proved nothing. The seal is the server's
// own statement of who the member is: httpOnly, HMAC-signed with a key derived from NEXTAUTH_SECRET,
// issued only where a signed session has just been verified.
//
// 🔴 MUTANT CONTRACT — each must go RED on its own:
//   S1  verifyMemberSeal skips the signature compare           → the tampered-body test reddens
//   S2  verifyMemberSeal ignores exp                           → the expired test reddens
//   S3  verifyMemberSeal accepts a non-UUID subject            → the shape test reddens
//   S4  the key is NEXTAUTH_SECRET itself, not a derived one   → the key-separation test reddens
//   S5  the Set-Cookie line drops HttpOnly                     → the attributes test reddens
//   S6  register-login-fe stops issuing the seal on success    → the handler issue test reddens
//   S7  register-login-fe issues a seal on a refusal           → the handler refusal test reddens
import { createHmac } from 'node:crypto'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    session: null as null | Record<string, unknown>,
    result: null as null | Record<string, unknown>,
    error: null as null | Error,
  }
  return {
    state,
    getServerSession: vi.fn(async () => state.session),
    registerOrLoginInFe: vi.fn(async () => {
      if (state.error) throw state.error
      return state.result
    }),
  }
})

vi.mock('next-auth/next', () => ({ getServerSession: h.getServerSession }))
vi.mock('@/pages/api/auth/[...nextauth]', () => ({ authOptions: {}, default: () => undefined }))
vi.mock('@/lib/auth/register-login-fe-store', () => ({ postgresRegisterLoginStore: {} }))
vi.mock('@/lib/auth/register-login-fe', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/register-login-fe')>()),
  registerOrLoginInFe: h.registerOrLoginInFe,
}))

import {
  MEMBER_SEAL_TTL_SECONDS,
  issueMemberSeal,
  memberSealClearCookie,
  memberSealCookieName,
  memberSealSetCookie,
  readMemberSeal,
  signMemberSeal,
  verifyMemberSeal,
} from '@/lib/auth/member-seal'
import { RegisterLoginError } from '@/lib/auth/register-login-fe'
import registerLoginHandler from '@/pages/api/auth/register-login-fe'

const SECRET = 'test-secret-not-real'
const NOW = 1_800_000_000
const A = '11111111-2222-4333-8444-555555555555'
const B = '66666666-7777-4888-9999-aaaaaaaaaaaa'

function fakeRes() {
  const headers: Record<string, unknown> = {}
  const out = { status: 0, body: undefined as unknown }
  const res = {
    getHeader: (n: string) => headers[n.toLowerCase()],
    setHeader: (n: string, v: unknown) => {
      headers[n.toLowerCase()] = v
      return res
    },
    status(c: number) {
      out.status = c
      return res
    },
    json(b: unknown) {
      out.body = b
      return res
    },
  }
  const setCookies = () => {
    const v = headers['set-cookie']
    return Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)]
  }
  return { res, out, setCookies }
}

describe('signMemberSeal / verifyMemberSeal', () => {
  const token = signMemberSeal({ u: A, exp: NOW + 60 }, SECRET)

  it('round-trips a fresh seal', () => {
    expect(verifyMemberSeal(token, SECRET, NOW)).toEqual({ u: A, exp: NOW + 60 })
  })

  it('S1 — a body swapped to another member, keeping the old signature, is refused', () => {
    const [, sig] = token.split('.')
    const swappedBody = Buffer.from(JSON.stringify({ u: B, exp: NOW + 60 })).toString('base64url')
    expect(verifyMemberSeal(`${swappedBody}.${sig}`, SECRET, NOW)).toBeNull()
  })

  it('a wrong secret, a missing secret, an empty token, or an extra segment is refused', () => {
    expect(verifyMemberSeal(token, 'other-secret', NOW)).toBeNull()
    expect(verifyMemberSeal(token, '', NOW)).toBeNull()
    expect(verifyMemberSeal('', SECRET, NOW)).toBeNull()
    expect(verifyMemberSeal(undefined, SECRET, NOW)).toBeNull()
    expect(verifyMemberSeal(`${token}.x`, SECRET, NOW)).toBeNull()
    expect(verifyMemberSeal(A, SECRET, NOW)).toBeNull() // a bare user_id is not a seal
  })

  it('S2 — an expired seal is refused', () => {
    expect(verifyMemberSeal(token, SECRET, NOW + 60)).toBeNull()
    expect(verifyMemberSeal(token, SECRET, NOW + 61)).toBeNull()
  })

  it('S3 — a correctly signed seal whose subject is not a UUID is refused', () => {
    const odd = signMemberSeal({ u: 'not-a-uuid', exp: NOW + 60 } as never, SECRET)
    expect(verifyMemberSeal(odd, SECRET, NOW)).toBeNull()
  })

  it('S4 — the HMAC key is derived for this purpose, not NEXTAUTH_SECRET used raw', () => {
    // A MAC made with the raw secret must not verify; otherwise any other HMAC the app signs with
    // NEXTAUTH_SECRET over the same bytes would double as a member seal.
    const body = Buffer.from(JSON.stringify({ u: A, exp: NOW + 60 })).toString('base64url')
    const rawMac = createHmac('sha256', SECRET).update(body).digest('base64url')
    expect(verifyMemberSeal(`${body}.${rawMac}`, SECRET, NOW)).toBeNull()
  })
})

describe('the seal cookie', () => {
  it('S5 — Set-Cookie is httpOnly, Lax, site-wide, and Secure on a secure deploy', () => {
    const line = memberSealSetCookie('tok', true)
    expect(line.startsWith(`${memberSealCookieName(true)}=tok;`)).toBe(true)
    expect(line).toContain('HttpOnly')
    expect(line).toContain('SameSite=Lax')
    expect(line).toContain('Path=/;')
    expect(line).toContain('Secure')
    expect(line).toContain(`Max-Age=${MEMBER_SEAL_TTL_SECONDS}`)
    expect(memberSealCookieName(true).startsWith('__Secure-')).toBe(true)
    expect(memberSealSetCookie('tok', false)).not.toContain('Secure')
    expect(memberSealCookieName(false).startsWith('__Secure-')).toBe(false)
  })

  it('the clear line expires the same cookie', () => {
    const line = memberSealClearCookie(true)
    expect(line.startsWith(`${memberSealCookieName(true)}=;`)).toBe(true)
    expect(line).toContain('Max-Age=0')
    expect(line).toContain('Path=/;')
  })

  it('readMemberSeal reads the named cookie only', () => {
    const tok = signMemberSeal({ u: A, exp: NOW + 60 }, SECRET)
    expect(readMemberSeal({ [memberSealCookieName(true)]: tok }, SECRET, true, NOW)?.u).toBe(A)
    expect(readMemberSeal({ [memberSealCookieName(false)]: tok }, SECRET, true, NOW)).toBeNull()
    expect(readMemberSeal({}, SECRET, true, NOW)).toBeNull()
    expect(readMemberSeal({ [memberSealCookieName(true)]: tok }, undefined, true, NOW)).toBeNull()
  })

  it('issueMemberSeal appends without dropping a Set-Cookie already on the response', () => {
    const { res, setCookies } = fakeRes()
    res.setHeader('Set-Cookie', 'next-auth.session-token=rolling; Path=/')
    expect(issueMemberSeal(res, A, { secret: SECRET, secure: true, now: NOW })).toBe(true)
    const lines = setCookies()
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('next-auth.session-token=rolling')
    const tok = lines[1].split(';')[0].split('=').slice(1).join('=')
    expect(verifyMemberSeal(tok, SECRET, NOW)).toEqual({ u: A, exp: NOW + MEMBER_SEAL_TTL_SECONDS })
  })

  it('issueMemberSeal writes nothing without a secret or for a non-UUID id', () => {
    const { res, setCookies } = fakeRes()
    expect(issueMemberSeal(res, A, { secret: '', secure: true, now: NOW })).toBe(false)
    expect(issueMemberSeal(res, 'u-1', { secret: SECRET, secure: true, now: NOW })).toBe(false)
    expect(setCookies()).toHaveLength(0)
  })
})

describe('register-login-fe issues the seal for the member it just verified', () => {
  const SESSION = { user: { name: 'n' }, provider: 'line', providerId: 'U1', lineProfile: { sub: 'U1' } }

  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_SECRET', SECRET)
    h.state.session = SESSION
    h.state.result = { user_id: A, name: 'n' }
    h.state.error = null
  })

  const run = async () => {
    const { res, out, setCookies } = fakeRes()
    await registerLoginHandler({ method: 'POST', body: {}, cookies: {} } as never, res as never)
    const seals = setCookies().filter((l) => l.includes('mumate.member='))
    return { out, seals }
  }

  it('S6 — a successful login answers with a seal for that user_id', async () => {
    const { out, seals } = await run()
    expect(out.status).toBe(200)
    expect(seals).toHaveLength(1)
    const tok = seals[0].split(';')[0].split('=').slice(1).join('=')
    expect(verifyMemberSeal(tok, SECRET, Math.floor(Date.now() / 1000))?.u).toBe(A)
  })

  it('S7 — no session, or a refused identity, gets no seal', async () => {
    h.state.session = null
    let r = await run()
    expect(r.out.status).toBe(401)
    expect(r.seals).toHaveLength(0)

    h.state.session = SESSION
    h.state.error = new RegisterLoginError(422, 'refused', true)
    r = await run()
    expect(r.out.status).toBe(422)
    expect(r.seals).toHaveLength(0)
  })

  it('a response without a user_id gets no seal', async () => {
    h.state.result = { ok: true }
    const { seals } = await run()
    expect(seals).toHaveLength(0)
  })
})
