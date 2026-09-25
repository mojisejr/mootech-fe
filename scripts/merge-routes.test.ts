// mumate-login-identity-001 slice 4 — the preview and confirm routes.
//
// ANCHOR: scripts/merge-routes.test.ts#the-body-is-never-the-proof
// Bug-class this owns: the confirm step acting on a subject the CALLER supplied. The
// ticket is the only proof that a provider attested that identity in this session; if
// the body could override it, posting a stranger's Google subject would move their
// login method onto your account. The ticket is verified with the real module here on
// purpose — a mocked verifier would prove nothing about that.
//
// Also owned: an offer that survives its own confirmation (replayable), and a refusal
// that still writes.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const resolveSignedSessionUserId = vi.fn()
const planIdentityMerge = vi.fn()
const mergeIdentity = vi.fn()

vi.mock('@/lib/v2/resolve-user', () => ({
  resolveSignedSessionUserId: (...a: unknown[]) => resolveSignedSessionUserId(...a),
}))
vi.mock('@/lib/auth/link-account', () => ({
  planIdentityMerge: (...a: unknown[]) => planIdentityMerge(...a),
  mergeIdentity: (...a: unknown[]) => mergeIdentity(...a),
}))
vi.mock('@/lib/auth/link-account-store', () => ({ postgresLinkStore: { transaction: vi.fn() } }))
vi.mock('@/lib/v2/subscription', () => ({
  resolveSubscription: async () => ({ isPaid: false, tier: null, source: 'none', expireAt: null }),
}))

import preview from '@/pages/api/auth/link/merge/preview'
import confirm from '@/pages/api/auth/link/merge/confirm'
import { issueMergeTicket, mergeTicketCookieName } from '@/lib/auth/merge-ticket'

const ME = 'aaaaaaaa-0000-4000-8000-000000000001'
const THEM = 'bbbbbbbb-0000-4000-8000-000000000002'
const SUBJECT = '104081630471234567890'

interface Captured {
  status: number | null
  json: any
  headers: Record<string, string[]>
}

function run(
  handler: (req: any, res: any) => Promise<unknown> | unknown,
  init: { method?: string; query?: Record<string, string>; body?: unknown; cookies?: Record<string, string> } = {},
): Promise<Captured> {
  const out: Captured = { status: null, json: null, headers: {} }
  const req = {
    method: init.method ?? 'GET',
    query: init.query ?? {},
    body: init.body,
    cookies: init.cookies ?? {},
    headers: {},
  }
  const res: any = {
    setHeader: (k: string, v: string | string[]) => {
      out.headers[k.toLowerCase()] = Array.isArray(v) ? v.map(String) : [String(v)]
    },
    status: (c: number) => {
      out.status = c
      return res
    },
    json: (b: unknown) => {
      out.json = b
      return res
    },
  }
  return Promise.resolve(handler(req, res)).then(() => out)
}

/** A real ticket, signed by the real module. */
function ticketFor(opts: { provider?: string; user?: string; subject?: string } = {}) {
  const provider = opts.provider ?? 'google'
  return {
    [mergeTicketCookieName(provider)]: issueMergeTicket({
      signedInUserId: opts.user ?? ME,
      provider,
      subject: opts.subject ?? SUBJECT,
      survivorUserId: ME,
      loserUserId: THEM,
    }),
  }
}

const PLANNED = {
  status: 'planned',
  survivorUserId: ME,
  loserUserId: THEM,
  rowId: 'row-1',
  provider: 'google',
  reason: 'only-one-may-lose',
  loserLiveIdentities: 1,
}

let saved: string | undefined
beforeEach(() => {
  saved = process.env.LINK_STATE_SECRET
  process.env.LINK_STATE_SECRET = 'merge-routes-secret'
  resolveSignedSessionUserId.mockReset()
  planIdentityMerge.mockReset()
  mergeIdentity.mockReset()
  resolveSignedSessionUserId.mockResolvedValue({ ok: true, userId: ME })
  planIdentityMerge.mockResolvedValue(PLANNED)
  mergeIdentity.mockResolvedValue({
    status: 'merged',
    rowId: 'row-1',
    fromUserId: THEM,
    toUserId: ME,
    reason: 'only-one-may-lose',
  })
})
afterEach(() => {
  if (saved === undefined) delete process.env.LINK_STATE_SECRET
  else process.env.LINK_STATE_SECRET = saved
})

describe('GET /api/auth/link/merge/preview', () => {
  it('describes the merge without naming either account', async () => {
    const r = await run(preview, { query: { provider: 'google' }, cookies: ticketFor() })

    expect(r.status).toBe(200)
    expect(r.json).toEqual({
      ok: true,
      provider: 'google',
      survivor: 'this-account',
      loserKeepsNothing: true,
    })
    const serialised = JSON.stringify(r.json)
    expect(serialised).not.toContain(THEM)
    expect(serialised).not.toContain(ME)
    expect(serialised).not.toContain(SUBJECT)
  })

  it('says the OTHER account survives when the rule sends the credential that way', async () => {
    planIdentityMerge.mockResolvedValue({ ...PLANNED, survivorUserId: THEM, loserUserId: ME })

    const r = await run(preview, { query: { provider: 'google' }, cookies: ticketFor() })

    expect(r.json).toMatchObject({ survivor: 'other-account' })
  })

  it('recomputes instead of reporting the verdict the ticket was minted with', async () => {
    // The ticket above says the survivor is ME. If the route echoed it, this refusal
    // would never surface and the member would be shown an offer that is no longer on.
    planIdentityMerge.mockResolvedValue({ status: 'refused', reason: 'no-side-may-lose' })

    const r = await run(preview, { query: { provider: 'google' }, cookies: ticketFor() })

    expect(r.status).toBe(409)
    expect(r.json).toEqual({ ok: false, error: 'merge_refused' })
  })

  it('leaves the ticket in place, because the member has not decided yet', async () => {
    const r = await run(preview, { query: { provider: 'google' }, cookies: ticketFor() })

    expect(r.headers['set-cookie']).toBeUndefined()
  })

  it('refuses every broken ticket with ONE indistinguishable answer', async () => {
    const cases: Array<[string, Record<string, string>]> = [
      ['no ticket at all', {}],
      ['a ticket for another provider', ticketFor({ provider: 'line' })],
      ['a ticket issued to another session', ticketFor({ user: THEM })],
      ['a mangled ticket', { [mergeTicketCookieName('google')]: 'not.a.ticket' }],
    ]
    for (const [label, cookies] of cases) {
      const r = await run(preview, { query: { provider: 'google' }, cookies })
      expect(r.status, label).toBe(409)
      expect(r.json, label).toEqual({ ok: false, error: 'no_offer' })
    }
  })

  it('refuses before it reads anything when the session is not signed in', async () => {
    resolveSignedSessionUserId.mockResolvedValue({ ok: false, status: 401, error: 'not signed in' })

    const r = await run(preview, { query: { provider: 'google' }, cookies: ticketFor() })

    expect(r.status).toBe(401)
    expect(planIdentityMerge).not.toHaveBeenCalled()
  })

  it('answers 405 to a POST and 404 to a provider it does not link', async () => {
    expect((await run(preview, { method: 'POST', query: { provider: 'google' } })).status).toBe(405)
    expect((await run(preview, { query: { provider: 'facebook' } })).status).toBe(404)
  })
})

describe('POST /api/auth/link/merge/confirm', () => {
  it('merges on an explicit yes and spends the ticket', async () => {
    const r = await run(confirm, {
      method: 'POST',
      body: { provider: 'google', confirm: 'merge' },
      cookies: ticketFor(),
    })

    expect(r.status).toBe(200)
    expect(r.json).toEqual({ ok: true, merged: 'google', survivor: 'this-account' })
    expect(r.headers['set-cookie']!.join('')).toContain('Max-Age=0')
    expect(r.headers['set-cookie']!.join('')).toContain('mumate_merge_google=')
  })

  it('NEVER takes the subject from the request body — the ticket is the only proof', async () => {
    // The attack this blocks: post someone else's Google subject and have their login
    // method moved onto your account.
    await run(confirm, {
      method: 'POST',
      body: { provider: 'google', confirm: 'merge', subject: 'a-stranger-subject', signedInUserId: THEM },
      cookies: ticketFor(),
    })

    expect(mergeIdentity).toHaveBeenCalledTimes(1)
    const [, input] = mergeIdentity.mock.calls[0]!
    expect(input).toEqual({ signedInUserId: ME, provider: 'google', subject: SUBJECT })
  })

  it('refuses a POST that does not say yes, and does NOT spend the offer', async () => {
    const r = await run(confirm, {
      method: 'POST',
      body: { provider: 'google' },
      cookies: ticketFor(),
    })

    expect(r.status).toBe(400)
    expect(r.json).toEqual({ ok: false, error: 'confirmation_required' })
    expect(mergeIdentity).not.toHaveBeenCalled()
    // The member has not said no; the offer must still be there.
    expect(r.headers['set-cookie']).toBeUndefined()
  })

  it('passes a refusal through as 409 and writes nothing', async () => {
    mergeIdentity.mockResolvedValue({ status: 'refused', reason: 'loser-holds-several-identities' })

    const r = await run(confirm, {
      method: 'POST',
      body: { provider: 'google', confirm: 'merge' },
      cookies: ticketFor(),
    })

    expect(r.status).toBe(409)
    expect(r.json).toEqual({ ok: false, error: 'merge_refused' })
    // And a refused offer is still spent, so it cannot be retried into a different answer.
    expect(r.headers['set-cookie']!.join('')).toContain('Max-Age=0')
  })

  it('spends the ticket even when the merge throws, so a crash cannot leave a replayable offer', async () => {
    mergeIdentity.mockRejectedValue(new Error('database went away'))

    const r = await run(confirm, {
      method: 'POST',
      body: { provider: 'google', confirm: 'merge' },
      cookies: ticketFor(),
    })

    expect(r.status).toBe(500)
    expect(r.headers['set-cookie']!.join('')).toContain('Max-Age=0')
  })

  it('will not let an unauthenticated request destroy a real member’s pending offer', async () => {
    resolveSignedSessionUserId.mockResolvedValue({ ok: false, status: 401, error: 'not signed in' })

    const r = await run(confirm, {
      method: 'POST',
      body: { provider: 'google', confirm: 'merge' },
      cookies: ticketFor(),
    })

    expect(r.status).toBe(401)
    expect(r.headers['set-cookie']).toBeUndefined()
    expect(mergeIdentity).not.toHaveBeenCalled()
  })

  it('refuses a ticket belonging to another session, and never merges', async () => {
    const r = await run(confirm, {
      method: 'POST',
      body: { provider: 'google', confirm: 'merge' },
      cookies: ticketFor({ user: THEM }),
    })

    expect(r.status).toBe(409)
    expect(r.json).toEqual({ ok: false, error: 'no_offer' })
    expect(mergeIdentity).not.toHaveBeenCalled()
  })

  it('answers 405 to a GET and 404 to a provider it does not link', async () => {
    expect((await run(confirm, { method: 'GET', body: { provider: 'google' } })).status).toBe(405)
    expect((await run(confirm, { method: 'POST', body: { provider: 'facebook', confirm: 'merge' } })).status).toBe(404)
  })

  it('reports the surviving side from the OUTCOME, not from the ticket', async () => {
    mergeIdentity.mockResolvedValue({
      status: 'merged',
      rowId: 'row-1',
      fromUserId: ME,
      toUserId: THEM,
      reason: 'only-one-may-lose',
    })

    const r = await run(confirm, {
      method: 'POST',
      body: { provider: 'google', confirm: 'merge' },
      cookies: ticketFor(),
    })

    expect(r.json).toMatchObject({ ok: true, survivor: 'other-account' })
  })
})
