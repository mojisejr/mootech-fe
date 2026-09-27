// #252 — the BFF must know WHO is consenting, and must not be told.
//
// ANCHOR: scripts/onboarding-identity.test.tsx#onboarding-identity-is-server-derived
// Bug-class this owns: a write that records a legal fact about a PERSON (a PDPA consent row, the
// onboarded_at stamp) taking that person's identity from the request. ตู๋ proved it live on origin/main
// e8043d7: a caller holding only the team passkey POSTed {"user_id":"VICTIM-…"} and got 200, with the BE
// receiving the victim's id and no user cookie at all. The shared secret (mootech-be#16) answers "may this
// caller reach /consent" — never "who is it".
//
// 🔴 WHY THIS SPEC IS SHAPED AROUND WHAT THE **WRITE SIDE RECEIVES**, not around the status code:
// a route can 401 correctly and still forward the wrong id on the paths that do pass. The thing that must
// be true is that the id which reaches the write side is the SESSION's, always — so nearly every case
// below asserts on the arguments the write received, and the negative cases assert it was never called.
// (CIEL mumate-be-retirement-001 slice 1d: the write side used to be BE POST /consent, reached by fetch; it
//  is now lib/v2/consent-store.ts, called in-process. The contract and every case below are unchanged —
//  only the place the "what did the write receive" question is asked moved from the fetch body to the call.)
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   MI1  the route reads user_id from the body again        → ① "A cannot write as B" reddens
//   MI2  the `if (!who.ok)` gate is dropped                 → ② (401) reddens, and ③ (no write) reddens
//   MI3  identity is checked AFTER the goal validation      → ④ reddens (an unauthenticated caller would
//                                                             learn its goal was malformed)
//   MI4  404 / 409 are collapsed into 200 or into 401       → ⑤ reddens
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const h = vi.hoisted(() => ({
  who: { ok: true, userId: 'CALLER-A' } as
    | { ok: true; userId: string }
    | { ok: false; status: 401 | 404 | 409; error: string },
}))

vi.mock('@/lib/v2/resolve-user', () => ({
  resolveSessionUserId: vi.fn(async () => h.who),
}))

const store = vi.hoisted(() => ({ recordOnboardingConsent: vi.fn() }))
vi.mock('@/lib/v2/consent-store', () => store)

import handler from '../pages/api/v2/onboarding'

function makeRes() {
  const res: { statusCode: number; body: any; status: any; json: any } = {
    statusCode: 0,
    body: undefined,
    status: vi.fn((c: number) => ((res.statusCode = c), res)),
    json: vi.fn((b: unknown) => ((res.body = b), res)),
  }
  return res
}
const makeReq = (body: unknown, method = 'POST') =>
  ({ method, body }) as unknown as Parameters<typeof handler>[0]

/** What the write side actually received (the only place the truth can be checked). Keys are the
 *  store's (userId / goal / policyVersion); `user_id` / `policy_version` below read the same two facts. */
function sentToWrite(writeMock: ReturnType<typeof vi.fn>) {
  const a = writeMock.mock.calls[0][0] as { userId: string; goal: string; policyVersion: string }
  return { user_id: a.userId, goal: a.goal, policy_version: a.policyVersion }
}

describe('#252 /api/v2/onboarding — identity comes from the session, never from the request', () => {
  // The write side. Its answer mirrors the real store: it echoes the goal it was given.
  const writeMock = store.recordOnboardingConsent

  beforeEach(() => {
    h.who = { ok: true, userId: 'CALLER-A' }
    writeMock.mockReset()
    writeMock.mockImplementation(async (a: { goal: string }) => ({
      ok: true,
      onboarded_at: '2026-08-23 10:00:00',
      onboarding_goal: a.goal,
    }))
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  // ① 🔴 ตู๋'s probe A, turned into a permanent test. Signed in as A, ASKING to be B.
  it('🔴 ① a signed-in caller cannot write consent in someone else\'s name', async () => {
    const res = makeRes()
    await handler(makeReq({ user_id: 'VICTIM-9999', goal: 'finance' }), res as never)

    expect(res.statusCode).toBe(200)
    expect(sentToWrite(writeMock).user_id).toBe('CALLER-A') // ← the session, not the claim
    expect(JSON.stringify(writeMock.mock.calls[0])).not.toContain('VICTIM-9999')
  })

  // The body's user_id is not merely overridden — it is never consulted. Same outcome with it absent,
  // empty, or a non-string, so there is no shape of it that can steer the write.
  it('① b the body\'s user_id is inert in every shape (absent / empty / wrong type / array)', async () => {
    for (const body of [
      { goal: 'health' },
      { user_id: '', goal: 'health' },
      { user_id: 12345, goal: 'health' },
      { user_id: ['VICTIM-9999'], goal: 'health' },
      { user_id: { toString: () => 'VICTIM-9999' }, goal: 'health' },
    ]) {
      writeMock.mockClear()
      const res = makeRes()
      await handler(makeReq(body), res as never)
      expect(res.statusCode).toBe(200)
      expect(sentToWrite(writeMock).user_id).toBe('CALLER-A')
    }
  })

  // ② + ③ MI2 — not signed in: the status is the small half. The load-bearing half is that the write
  // side is never reached, so no row, no stamp, nothing to undo.
  it('🔴 ② + ③ no session → 401 AND the write side is never called', async () => {
    h.who = { ok: false, status: 401, error: 'not signed in' }
    const res = makeRes()
    await handler(makeReq({ user_id: 'VICTIM-9999', goal: 'finance' }), res as never)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ ok: false, error: 'not signed in' })
    expect(writeMock).not.toHaveBeenCalled()
  })

  // ④ MI3 — ordering is part of the contract: an unauthenticated caller must not be handed a validation
  // oracle for free. With a bad goal AND no session the answer is 401, not 400.
  it('🔴 ④ no session + a malformed goal → 401 (identity is checked first, not after)', async () => {
    h.who = { ok: false, status: 401, error: 'not signed in' }
    const res = makeRes()
    await handler(makeReq({ goal: 'not-a-goal' }), res as never)

    expect(res.statusCode).toBe(401)
    expect(writeMock).not.toHaveBeenCalled()
  })

  // ⑤ MI4 — the resolver's other two refusals are distinct facts and must survive as themselves.
  // 409 in particular means "this login maps to two user rows" (ตู๋ #254 B2) — writing a consent row for
  // a guessed one of them is precisely the thing we must not do.
  it('🔴 ⑤ 404 (no account yet) and 409 (ambiguous identity) pass through, and neither writes', async () => {
    for (const refusal of [
      { ok: false as const, status: 404 as const, error: 'no account for this login yet' },
      { ok: false as const, status: 409 as const, error: 'identity is ambiguous' },
    ]) {
      writeMock.mockClear()
      h.who = refusal
      const res = makeRes()
      await handler(makeReq({ goal: 'finance' }), res as never)
      expect(res.statusCode).toBe(refusal.status)
      expect(res.body).toEqual({ ok: false, error: refusal.error })
      expect(writeMock).not.toHaveBeenCalled()
    }
  })

  // The contracts that existed before #252 and must not have moved.
  it('a signed-in caller with a valid goal still completes the normal flow', async () => {
    const res = makeRes()
    await handler(makeReq({ goal: 'work' }), res as never)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      ok: true,
      onboarded_at: '2026-08-23 10:00:00',
      onboarding_goal: 'work',
    })
    const sent = sentToWrite(writeMock)
    expect(sent.goal).toBe('work')
    expect(sent.policy_version).toBeDefined() // server-owned, never from the body
  })

  it('signed in + a goal outside the six → 400, and nothing is written', async () => {
    const res = makeRes()
    await handler(makeReq({ goal: 'crypto' }), res as never)
    expect(res.statusCode).toBe(400)
    expect(writeMock).not.toHaveBeenCalled()
  })

  it('a non-POST method is still refused before anything else', async () => {
    const res = makeRes()
    await handler(makeReq({ goal: 'finance' }, 'GET'), res as never)
    expect(res.statusCode).toBe(405)
    expect(writeMock).not.toHaveBeenCalled()
  })

  // policy_version is server-owned — proven by trying to move it from the body.
  it('policy_version cannot be set from the body', async () => {
    const res = makeRes()
    await handler(makeReq({ goal: 'finance', policy_version: 'ATTACKER-1' }), res as never)
    expect(res.statusCode).toBe(200)
    expect(sentToWrite(writeMock).policy_version).not.toBe('ATTACKER-1')
  })
})
