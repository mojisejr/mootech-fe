// #353 — teeth for lib/v2/resolve-user.ts, the PERMANENT home of "who is the caller?" (goo · #287).
// Every v2 route that acts on a specific user resolves identity through this ONE module, so its three
// refusals (401 not-signed-in · 404 no-account · 409 ambiguous) are load-bearing for every later
// phase of #352. The module had NO spec of its own — this file is that spec.
//
// Registered in vitest.config.mts `include` (APPEND-only — see the ⚠️ at the top of that list). Named
// .test.tsx to match the 29 .tsx already there; but the binding condition is "the name is in
// `include`", NOT the extension — `npm test` (= `vitest run`) runs ONLY the names listed there
// (vitest.config.mts:54). A spec not on that list runs in NO lane and its mutants never redden
// (debt #212 / #353's own DoD). The old .ts↔.tsx split reason (ci.yml's tsx lane) expired when
// ci.yml was archived in #321 — the extension is now pure convention.
//
// 🔴 MUTANT CONTRACT — each must go RED on its own when the FULL suite runs (`npm test`):
//   MA  resolveUserFromRows returns rows[0] instead of collapsing to distinct ids → the 409 test reddens
//   MB  resolveUserFromRows treats "no rows" as success                          → the 404 test reddens
//   MC  resolveUserFromRows dedupes by ROW not by user_id (a plain duplicate 409) → the same-user test reddens
//   MD  resolveSessionUserId drops the 401 "not signed in" guard                 → the null-session test reddens
//   ME  resolveSessionUserId requires only providerId (drops the provider check) → the provider-missing test reddens
//   MF  the lookup stops matching provider case-insensitively (drop lower())     → the query-shape test reddens
//   MG  first-run-reset handler drops the v2 preview gate                        → the gate test reddens
//   MH  first-run-reset handler acts on an ambiguous identity (stops refusing)   → the handler-409 test reddens
//   MI  first-run-reset forwards resolve-user's raw 409 reason to the user        → the "nothing was reset" test reddens
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Shared, inspectable state + capture buckets, declared via vi.hoisted so the (hoisted) vi.mock
// factories below can close over them. Only the TRANSPORT is mocked (getServerSession + db + the v2
// gate); the module's own branching — and the real drizzle `sql` that builds the lookup query — runs
// for real, which is what gives MD/ME/MF/MG/MH teeth.
const h = vi.hoisted(() => {
  const state = {
    session: null as null | { providerId?: unknown; provider?: unknown },
    rows: [] as Array<{ user_id?: unknown }>,
    v2: true,
  }
  const captured = { execute: [] as unknown[] } // every sql passed to db.execute, in call order
  const db = {
    // resolve-user does `rowsOf(await db.execute(sql))`; the reset handler also runs UPDATE/DELETE
    // through the same execute. Return the provider rows for all; UPDATE/DELETE ignore the result.
    execute: vi.fn(async (q: unknown) => {
      captured.execute.push(q)
      return state.rows
    }),
  }
  const getServerSession = vi.fn(async () => state.session)
  const isV2Authenticated = vi.fn(() => state.v2)
  return { state, captured, db, getServerSession, isV2Authenticated }
})

vi.mock('next-auth/next', () => ({ getServerSession: h.getServerSession }))
// [...nextauth] pulls in every OAuth provider; getServerSession is mocked, so authOptions is inert.
vi.mock('@/pages/api/auth/[...nextauth]', () => ({ authOptions: {}, default: () => undefined }))
vi.mock('@/lib/db', () => ({ db: h.db }))
vi.mock('@/lib/v2/gate', () => ({ isV2Authenticated: h.isV2Authenticated }))

import { resolveUserFromRows, resolveSessionUserId } from '@/lib/v2/resolve-user'
import firstRunResetHandler from '@/pages/api/v2/first-run-reset'

// The real drizzle `sql` stores its literal fragments as StringChunk.value (string[]) and its
// interpolated params as Param objects (no .value array). Join just the literal fragments to get the
// query skeleton with params elided — enough to assert the SHAPE of the lookup without depending on a
// SQL dialect renderer.
function sqlSkeleton(q: unknown): string {
  const chunks = (q as { queryChunks?: Array<{ value?: unknown }> })?.queryChunks ?? []
  return chunks
    .filter((c) => Array.isArray(c?.value))
    .flatMap((c) => c.value as string[])
    .join(' ')
}

const stubReqRes = () => [{} as never, {} as never] as const

describe('resolveUserFromRows — collapse the matched rows to ONE user_id, or refuse', () => {
  it('one row ⇒ that user', () => {
    expect(resolveUserFromRows([{ user_id: 'u-1' }])).toEqual({ ok: true, userId: 'u-1' })
  })

  it('MC — duplicate rows for the SAME user are one identity, not an ambiguity', () => {
    const r = resolveUserFromRows([{ user_id: 'u-1' }, { user_id: 'u-1' }, { user_id: 'u-1' }])
    expect(r).toEqual({ ok: true, userId: 'u-1' })
  })

  it('MA — two DIFFERENT users ⇒ 409, and NEITHER id is chosen or leaked', () => {
    const r = resolveUserFromRows([{ user_id: 'u-1' }, { user_id: 'u-2' }])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(409)
    expect(JSON.stringify(r)).not.toContain('u-1')
    expect(JSON.stringify(r)).not.toContain('u-2')
  })

  it('MB — no rows ⇒ 404, never a silent success', () => {
    const r = resolveUserFromRows([])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(404)
  })

  it('blank / whitespace / non-string user_id is not an identity ⇒ 404', () => {
    for (const rows of [
      [{ user_id: '' }],
      [{ user_id: '   ' }],
      [{ user_id: null }],
      [{ user_id: 42 }],
      [{}],
    ]) {
      const r = resolveUserFromRows(rows as Array<{ user_id?: unknown }>)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.status).toBe(404)
    }
  })

  it('surrounding whitespace is trimmed (and " u-1 " is the SAME identity as "u-1", not a second)', () => {
    expect(resolveUserFromRows([{ user_id: '  u-1  ' }])).toEqual({ ok: true, userId: 'u-1' })
    const r = resolveUserFromRows([{ user_id: 'u-1' }, { user_id: '  u-1  ' }])
    expect(r).toEqual({ ok: true, userId: 'u-1' })
  })

  it('one real user among junk rows ⇒ still that user (junk is not a second identity)', () => {
    expect(resolveUserFromRows([{ user_id: '' }, { user_id: 'u-9' }, {}])).toEqual({
      ok: true,
      userId: 'u-9',
    })
  })
})

describe('resolveSessionUserId — derive user_id from the signed session ONLY', () => {
  beforeEach(() => {
    h.state.session = null
    h.state.rows = []
    h.captured.execute.length = 0
    h.db.execute.mockClear()
  })

  it('MD — no NextAuth session ⇒ 401, and the DB is never touched', async () => {
    h.state.session = null
    const r = await resolveSessionUserId(...stubReqRes())
    expect(r).toEqual({ ok: false, status: 401, error: 'not signed in' })
    expect(h.db.execute).not.toHaveBeenCalled()
  })

  it('ME — provider missing is as fatal as providerId missing (both required) ⇒ 401', async () => {
    for (const session of [
      { providerId: 'U1' }, // provider missing
      { provider: 'line' }, // providerId missing
      { providerId: '   ', provider: 'line' }, // whitespace-only providerId
      { providerId: 'U1', provider: '  ' }, // whitespace-only provider
    ]) {
      h.state.session = session
      const r = await resolveSessionUserId(...stubReqRes())
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.status).toBe(401)
    }
    expect(h.db.execute).not.toHaveBeenCalled()
  })

  it('signed in + exactly one matching row ⇒ that user_id', async () => {
    h.state.session = { providerId: 'U1', provider: 'line' }
    h.state.rows = [{ user_id: 'u-1' }]
    expect(await resolveSessionUserId(...stubReqRes())).toEqual({ ok: true, userId: 'u-1' })
  })

  it('signed in + no matching row ⇒ 404', async () => {
    h.state.session = { providerId: 'U1', provider: 'line' }
    h.state.rows = []
    const r = await resolveSessionUserId(...stubReqRes())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(404)
  })

  it('signed in + two disagreeing rows ⇒ 409 (the refusal survives the DB round-trip)', async () => {
    h.state.session = { providerId: 'U1', provider: 'line' }
    h.state.rows = [{ user_id: 'u-1' }, { user_id: 'u-2' }]
    const r = await resolveSessionUserId(...stubReqRes())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(409)
  })

  it('signed in + duplicate rows for the same user ⇒ that user (a plain duplicate is not 409)', async () => {
    h.state.session = { providerId: 'U1', provider: 'line' }
    h.state.rows = [{ user_id: 'u-1' }, { user_id: 'u-1' }]
    expect(await resolveSessionUserId(...stubReqRes())).toEqual({ ok: true, userId: 'u-1' })
  })

  it('MF — the provider match is case-INsensitive: the query lowercases BOTH column and param', async () => {
    // A session provider of "Line" must still match a stored "line". The fold happens in postgres, so
    // at unit level the honest proof is that the query still ASKS for it — resolveSessionUserId must
    // not lowercase in JS, and must not drop `lower()`. Dropping either reddens this test.
    h.state.session = { providerId: 'U1', provider: 'Line' }
    h.state.rows = [{ user_id: 'u-1' }]
    const r = await resolveSessionUserId(...stubReqRes())
    expect(r).toEqual({ ok: true, userId: 'u-1' })
    expect(h.db.execute).toHaveBeenCalledTimes(1)
    const skeleton = sqlSkeleton(h.captured.execute[0])
    expect(skeleton).toContain('lower(provider) = lower(')
    expect(skeleton).toContain('id_token =')
  })
})

// The v2 preview gate and the session-401 refusal used to live in resolveResetIdentity's path; #353
// relocates the identity work into resolveSessionUserId and keeps the gate INLINE in the handler.
// These teeth follow the relocated gates so a mutant that drops the handler's `isV2Authenticated`
// check (MG) or lets it act on an ambiguous identity (MH) still reddens — the pure lib spec
// (first-run-reset.test.tsx) can no longer see the handler, so without these the relocation would
// silently lose M2/M3's coverage.
describe('first-run-reset endpoint — behavior parity through the shared resolver', () => {
  const SIGNED = { providerId: 'U1', provider: 'line' }
  function invoke(method = 'POST') {
    const out = { status: 0 as number, body: undefined as unknown }
    const res = {
      status(c: number) {
        out.status = c
        return res
      },
      json(b: unknown) {
        out.body = b
        return res
      },
    }
    return { p: firstRunResetHandler({ method } as never, res as never), out }
  }
  const writes = () =>
    h.captured.execute.map(sqlSkeleton).filter((s) => /UPDATE|DELETE/.test(s))

  beforeEach(() => {
    h.state.v2 = true
    h.state.session = SIGNED
    h.state.rows = [{ user_id: 'u-1' }]
    h.captured.execute.length = 0
    h.db.execute.mockClear()
    h.getServerSession.mockClear()
    h.isV2Authenticated.mockClear()
  })

  it('non-POST ⇒ 405, nothing else runs', async () => {
    const { p, out } = invoke('GET')
    await p
    expect(out.status).toBe(405)
    expect(h.db.execute).not.toHaveBeenCalled()
  })

  it('MG — outside the preview gate ⇒ 401 "not in team preview", and NO identity work or writes', async () => {
    h.state.v2 = false
    const { p, out } = invoke()
    await p
    expect(out.status).toBe(401)
    expect(out.body).toEqual({ ok: false, error: 'not in team preview' })
    expect(h.getServerSession).not.toHaveBeenCalled() // gate short-circuits before any identity read
    expect(h.db.execute).not.toHaveBeenCalled()
  })

  it('inside the gate but no signed session ⇒ 401, and nothing is written', async () => {
    h.state.session = null
    const { p, out } = invoke()
    await p
    expect(out.status).toBe(401)
    expect(writes()).toHaveLength(0)
  })

  it('MH — an ambiguous identity ⇒ 409 and NOT one row is deleted (refuse, do not guess)', async () => {
    h.state.rows = [{ user_id: 'u-1' }, { user_id: 'u-2' }]
    const { p, out } = invoke()
    await p
    expect(out.status).toBe(409)
    expect(writes()).toHaveLength(0) // the SELECT ran, but no UPDATE/DELETE followed
  })

  it('MI — the 409 the USER sees says nothing was reset (destructive endpoint owns the wording, not resolve-user\'s shared reason)', async () => {
    // phase.message is rendered raw on /v2 (TeamPreviewResetBadge.tsx:148). resolve-user returns the
    // MECHANICAL reason 'identity is ambiguous' (shared by reminders/subscribe, which delete nothing); the
    // reset endpoint must add the half a human needs on a data-deleting refusal — that their data is intact.
    // A mutant that forwards the raw `found.error` here drops '— not resetting' and reddens this test.
    h.state.rows = [{ user_id: 'u-1' }, { user_id: 'u-2' }]
    const { p, out } = invoke()
    await p
    expect(out.status).toBe(409)
    expect((out.body as { error: string }).error).toContain('not resetting')
  })

  it('no account for this login ⇒ 404, nothing written', async () => {
    h.state.rows = []
    const { p, out } = invoke()
    await p
    expect(out.status).toBe(404)
    expect(writes()).toHaveLength(0)
  })

  it('gate open + signed in + one user ⇒ 200, and that caller\'s row is reset (UPDATE user + DELETE consent)', async () => {
    h.state.rows = [{ user_id: 'u-1' }]
    const { p, out } = invoke()
    await p
    expect(out.status).toBe(200)
    expect(out.body).toEqual({ ok: true })
    const skels = h.captured.execute.map(sqlSkeleton)
    expect(skels.some((s) => s.includes('UPDATE "user"'))).toBe(true)
    expect(skels.some((s) => s.includes('DELETE FROM consent'))).toBe(true)
  })
})
