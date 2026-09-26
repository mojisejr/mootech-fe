// scripts/link-account.test.ts — lib/auth/link-account.ts (slice 3).
//
// The three cases of the identity contract and the last-method rule, exercised
// against a fake store. Every "nothing happened" assertion COUNTS ROWS rather
// than reading the returned status, because a status is what the code says it did
// and the rows are what it did.
import { describe, expect, it } from 'vitest'

import {
  linkProvider,
  unlinkProvider,
  type LinkStore,
  type LinkTransaction,
  type ProviderRow,
} from '@/lib/auth/link-account'

const ME = 'aaaaaaaa-0000-4000-8000-000000000001'
const SOMEONE_ELSE = 'bbbbbbbb-0000-4000-8000-000000000002'
/** The dead legacy shape: a Google ACCESS token stored as the identity (253-342 chars in production). */
const DEAD_YA29 = `ya29.${'x'.repeat(250)}`
const REAL_GOOGLE_SUB = '109876543210987654321' // 21 chars, a real Google `sub`

interface FakeState {
  rows: ProviderRow[]
  subjects: Map<string, string> // rowId -> subject
  members: Set<string>
  locks: string[]
  inserts: number
  deletes: number
}

function fakeStore(init: Partial<FakeState> = {}) {
  const s: FakeState = {
    rows: init.rows ?? [],
    subjects: init.subjects ?? new Map(),
    members: init.members ?? new Set([ME, SOMEONE_ELSE]),
    locks: [],
    inserts: 0,
    deletes: 0,
  }
  let failNextInsert: unknown = null

  const tx: LinkTransaction = {
    async lockIdentity(provider, subject) {
      s.locks.push(`${provider}\u001f${subject}`)
    },
    async findIdentityOwner(provider, subject) {
      const hit = s.rows.find(
        (r) => r.provider.toLowerCase() === provider.toLowerCase() && s.subjects.get(r.id) === subject,
      )
      return hit ?? null
    },
    async memberExists(userId) {
      return s.members.has(userId)
    },
    async insertProviderRow(row) {
      if (failNextInsert) {
        const e = failNextInsert
        failNextInsert = null
        throw e
      }
      s.inserts += 1
      s.rows.push({ id: row.id, userId: row.userId, provider: row.provider })
      s.subjects.set(row.id, row.subject)
    },
    async listMemberProviders(userId) {
      return s.rows.filter((r) => r.userId === userId)
    },
    async listMemberIdentityShapes(userId) {
      return s.rows
        .filter((r) => r.userId === userId)
        .map((r) => ({ id: r.id, provider: r.provider, identityLength: (s.subjects.get(r.id) ?? '').length }))
    },
    async deleteProviderRows(userId, provider) {
      const before = s.rows.length
      s.rows = s.rows.filter(
        (r) => !(r.userId === userId && r.provider.toLowerCase() === provider.toLowerCase()),
      )
      const removed = before - s.rows.length
      s.deletes += removed
      return removed
    },
  }

  const store: LinkStore = { transaction: (work) => work(tx) }
  return {
    store,
    state: s,
    failInsertOnce(error: unknown) {
      failNextInsert = error
    },
  }
}

function conflict() {
  // Drizzle wraps the driver error, and the wrapper's own code is undefined — the
  // exact shape isProviderIdentityConflict has to walk to find.
  return Object.assign(new Error('Failed query: insert into user_provider'), {
    cause: Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint_name: 'user_provider_identity_unique',
    }),
  })
}

describe('case 1 — the identity has no owner, so attach it', () => {
  it('writes exactly one row, owned by the signed-in member', async () => {
    const f = fakeStore()
    const r = await linkProvider(f.store, { userId: ME, provider: 'line', subject: 'U-line-1' })
    expect(r.status).toBe('linked')
    expect(f.state.rows).toHaveLength(1)
    expect(f.state.rows[0].userId).toBe(ME)
    expect(f.state.inserts).toBe(1)
  })

  it('takes the advisory lock BEFORE reading, or two simultaneous links both see nothing', async () => {
    const f = fakeStore()
    await linkProvider(f.store, { userId: ME, provider: 'line', subject: 'U-line-1' })
    expect(f.state.locks).toEqual(['line\u001fU-line-1'])
  })

  it('stores google lower-case and LINE upper-case, the spelling the live writers use', async () => {
    const g = fakeStore()
    await linkProvider(g.store, { userId: ME, provider: 'google', subject: '1234567890' })
    expect(g.state.rows[0].provider).toBe('google')

    const l = fakeStore()
    await linkProvider(l.store, { userId: ME, provider: 'line', subject: 'U-1' })
    expect(l.state.rows[0].provider).toBe('LINE')
  })

  it('refuses when the member row is gone, rather than creating an orphan credential', async () => {
    const f = fakeStore({ members: new Set([SOMEONE_ELSE]) })
    const r = await linkProvider(f.store, { userId: ME, provider: 'line', subject: 'U-1' })
    expect(r.status).toBe('member-missing')
    expect(f.state.rows).toHaveLength(0)
    expect(f.state.inserts).toBe(0)
  })
})

describe('case 2 — it is already mine', () => {
  it('reports already-linked and writes NOTHING a second time', async () => {
    const f = fakeStore()
    await linkProvider(f.store, { userId: ME, provider: 'line', subject: 'U-1' })
    const again = await linkProvider(f.store, { userId: ME, provider: 'line', subject: 'U-1' })
    expect(again.status).toBe('already-linked')
    expect(f.state.rows).toHaveLength(1)
    expect(f.state.inserts).toBe(1)
  })

  it('matches the owner case-insensitively, so a differently-cased id is not read as a stranger', async () => {
    // Seeded directly: `WHERE user_id = $1` in Postgres is case-sensitive text
    // comparison, so an uppercased uuid would never reach this branch through a
    // real lookup. The compare is defensive, and this pins it rather than the
    // unreachable path that an earlier version of this test accidentally built.
    const f = fakeStore({
      rows: [{ id: 'seed', userId: ME, provider: 'LINE' }],
      subjects: new Map([['seed', 'U-1']]),
    })
    const r = await linkProvider(f.store, { userId: ME.toUpperCase(), provider: 'line', subject: 'U-1' })
    expect(r.status).toBe('already-linked')
    expect(f.state.inserts).toBe(0)
  })
})

describe('case 3 — it belongs to another member: STOP', () => {
  it('changes nothing at all, and the row keeps its original owner', async () => {
    const f = fakeStore()
    await linkProvider(f.store, { userId: SOMEONE_ELSE, provider: 'line', subject: 'U-shared' })
    const before = JSON.stringify(f.state.rows)

    const r = await linkProvider(f.store, { userId: ME, provider: 'line', subject: 'U-shared' })

    expect(r.status).toBe('owned-by-another')
    expect(JSON.stringify(f.state.rows)).toBe(before)
    expect(f.state.rows[0].userId).toBe(SOMEONE_ELSE)
    expect(f.state.inserts).toBe(1) // only the first link
    expect(f.state.deletes).toBe(0) // nothing relinked, nothing removed
  })

  it('does not merge, transfer or pick a winner — that is slice 4 and owner-gated', async () => {
    const f = fakeStore()
    await linkProvider(f.store, { userId: SOMEONE_ELSE, provider: 'google', subject: 'sub-x' })
    await linkProvider(f.store, { userId: ME, provider: 'google', subject: 'sub-x' })
    expect(f.state.rows.filter((r) => r.userId === ME)).toHaveLength(0)
  })
})

describe('a concurrent writer outside our transaction', () => {
  it('re-reads once on a unique violation and reports the truth instead of a 500', async () => {
    const f = fakeStore()
    // The legacy backend inserts the same identity for someone else between our
    // read and our write: the insert raises 23505, and the retry now sees an owner.
    f.failInsertOnce(conflict())
    f.state.rows.push({ id: 'race', userId: SOMEONE_ELSE, provider: 'LINE' })
    f.state.subjects.set('race', 'U-race')

    const r = await linkProvider(f.store, { userId: ME, provider: 'line', subject: 'U-race' })
    expect(r.status).toBe('owned-by-another')
  })

  it('retries at most once — a second conflict is a real error, not a loop', async () => {
    const f = fakeStore()
    let thrown = 0
    const store: LinkStore = {
      transaction: (work) =>
        work({
          lockIdentity: async () => {},
          findIdentityOwner: async () => null,
          memberExists: async () => true,
          insertProviderRow: async () => {
            thrown += 1
            throw conflict()
          },
          listMemberProviders: async () => [],
          listMemberIdentityShapes: async () => [],
          deleteProviderRows: async () => 0,
        }),
    }
    await expect(linkProvider(store, { userId: ME, provider: 'line', subject: 'U-1' })).rejects.toThrow()
    expect(thrown).toBe(2)
  })

  it('an error that is NOT a unique violation is not swallowed', async () => {
    const f = fakeStore()
    f.failInsertOnce(new Error('connection reset'))
    await expect(
      linkProvider(f.store, { userId: ME, provider: 'line', subject: 'U-1' }),
    ).rejects.toThrow(/connection reset/)
  })
})

describe('what gets written', () => {
  it('never writes null — an empty name arrives in a cookie as the word "null"', async () => {
    const captured: Record<string, unknown>[] = []
    const store: LinkStore = {
      transaction: (work) =>
        work({
          lockIdentity: async () => {},
          findIdentityOwner: async () => null,
          memberExists: async () => true,
          insertProviderRow: async (row) => {
            captured.push(row as unknown as Record<string, unknown>)
          },
          listMemberProviders: async () => [],
          listMemberIdentityShapes: async () => [],
          deleteProviderRows: async () => 0,
        }),
    }
    await linkProvider(store, { userId: ME, provider: 'google', subject: 's' })
    expect(captured[0].name).toBe('')
    expect(captured[0].pictureUrl).toBe('')
    expect(captured[0].email).toBe('')
  })

  it('drops an email on the LINE path even when one is supplied', async () => {
    const captured: Record<string, unknown>[] = []
    const store: LinkStore = {
      transaction: (work) =>
        work({
          lockIdentity: async () => {},
          findIdentityOwner: async () => null,
          memberExists: async () => true,
          insertProviderRow: async (row) => {
            captured.push(row as unknown as Record<string, unknown>)
          },
          listMemberProviders: async () => [],
          listMemberIdentityShapes: async () => [],
          deleteProviderRows: async () => 0,
        }),
    }
    await linkProvider(store, { userId: ME, provider: 'line', subject: 's', email: 'x@y.z' })
    expect(captured[0].email).toBe('')
  })

  it('writes the legacy timestamp shape, not an ISO string', async () => {
    const captured: Record<string, unknown>[] = []
    const store: LinkStore = {
      transaction: (work) =>
        work({
          lockIdentity: async () => {},
          findIdentityOwner: async () => null,
          memberExists: async () => true,
          insertProviderRow: async (row) => {
            captured.push(row as unknown as Record<string, unknown>)
          },
          listMemberProviders: async () => [],
          listMemberIdentityShapes: async () => [],
          deleteProviderRows: async () => 0,
        }),
    }
    await linkProvider(store, { userId: ME, provider: 'line', subject: 's' }, new Date('2026-09-24T05:12:30Z'))
    expect(captured[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(String(captured[0].timestamp)).not.toContain('T')
  })

  it('rejects an empty subject rather than writing a blank identity', async () => {
    const f = fakeStore()
    await expect(linkProvider(f.store, { userId: ME, provider: 'line', subject: '  ' })).rejects.toThrow()
    expect(f.state.rows).toHaveLength(0)
  })
})

describe('unlink', () => {
  async function withBoth() {
    const f = fakeStore()
    await linkProvider(f.store, { userId: ME, provider: 'line', subject: 'U-1' })
    await linkProvider(f.store, { userId: ME, provider: 'google', subject: 'g-1' })
    return f
  }

  it('removes the named provider when another remains', async () => {
    const f = await withBoth()
    const r = await unlinkProvider(f.store, { userId: ME, provider: 'google' })
    expect(r).toEqual({ status: 'unlinked', removed: 1 })
    expect(f.state.rows.map((x) => x.provider)).toEqual(['LINE'])
  })

  it('REFUSES the last remaining method, and removes nothing', async () => {
    const f = fakeStore()
    await linkProvider(f.store, { userId: ME, provider: 'line', subject: 'U-1' })
    const r = await unlinkProvider(f.store, { userId: ME, provider: 'line' })
    expect(r).toEqual({ status: 'last-method' })
    expect(f.state.rows).toHaveLength(1)
    expect(f.state.deletes).toBe(0)
  })

  it('counts OTHER PROVIDERS, not rows — several rows of one provider are still one way in', async () => {
    // The shape 1,443 members are actually in: many google rows, nothing else. The
    // extra row is a dead legacy access token — the only way a member reaches two
    // google rows since owner decision 22 (plan 0.8).
    const f = fakeStore()
    await linkProvider(f.store, { userId: ME, provider: 'google', subject: DEAD_YA29 })
    await linkProvider(f.store, { userId: ME, provider: 'google', subject: 'g-1' })
    const r = await unlinkProvider(f.store, { userId: ME, provider: 'google' })
    expect(r).toEqual({ status: 'last-method' })
    expect(f.state.rows).toHaveLength(2)
  })

  it('REFUSES the method the session is signed in WITH, and removes nothing', async () => {
    const f = await withBoth()
    const r = await unlinkProvider(f.store, { userId: ME, provider: 'line', sessionProvider: 'line' })
    expect(r).toEqual({ status: 'current-method' })
    expect(f.state.rows).toHaveLength(2)
    expect(f.state.deletes).toBe(0)
  })

  it('still allows removing the OTHER method while signed in through one', async () => {
    // The rule must not make a two-method account impossible to reduce.
    const f = await withBoth()
    const r = await unlinkProvider(f.store, { userId: ME, provider: 'google', sessionProvider: 'line' })
    expect(r).toEqual({ status: 'unlinked', removed: 1 })
    expect(f.state.rows.map((x) => x.provider)).toEqual(['LINE'])
  })

  it('matches the session provider case-insensitively, like every other comparison here', async () => {
    const f = await withBoth()
    const r = await unlinkProvider(f.store, { userId: ME, provider: 'line', sessionProvider: 'LINE' })
    expect(r).toEqual({ status: 'current-method' })
  })

  it('last-method OUTRANKS current-method when they collide', async () => {
    // One method, signed in through it: both rules fire. The permanent refusal must
    // be the one reported, or the member is told to sign in a way that does not exist.
    const f = fakeStore()
    await linkProvider(f.store, { userId: ME, provider: 'line', subject: 'U-1' })
    const r = await unlinkProvider(f.store, { userId: ME, provider: 'line', sessionProvider: 'line' })
    expect(r).toEqual({ status: 'last-method' })
    expect(f.state.deletes).toBe(0)
  })

  it('an absent session provider blocks nothing, so a support path is not broken by the guard', async () => {
    const f = await withBoth()
    const r = await unlinkProvider(f.store, { userId: ME, provider: 'line', sessionProvider: null })
    expect(r).toEqual({ status: 'unlinked', removed: 1 })
  })

  it('reports not-linked without touching anything when the provider was never linked', async () => {
    const f = fakeStore()
    await linkProvider(f.store, { userId: ME, provider: 'line', subject: 'U-1' })
    const r = await unlinkProvider(f.store, { userId: ME, provider: 'google' })
    expect(r).toEqual({ status: 'not-linked' })
    expect(f.state.rows).toHaveLength(1)
    expect(f.state.deletes).toBe(0)
  })

  it('never removes another member\'s credential', async () => {
    const f = await withBoth()
    await linkProvider(f.store, { userId: SOMEONE_ELSE, provider: 'google', subject: 'g-other' })
    await unlinkProvider(f.store, { userId: ME, provider: 'google' })
    expect(f.state.rows.filter((r) => r.userId === SOMEONE_ELSE)).toHaveLength(1)
  })

  it('a member can unlink and then link again — user_id never changed', async () => {
    const f = await withBoth()
    await unlinkProvider(f.store, { userId: ME, provider: 'google' })
    const again = await linkProvider(f.store, { userId: ME, provider: 'google', subject: 'g-1' })
    expect(again.status).toBe('linked')
    expect(f.state.rows.every((r) => r.userId === ME)).toBe(true)
  })
})

describe('owner decision 22 — one live identity per provider per member (plan 0.8)', () => {
  it('REFUSES a second live Google and writes nothing', async () => {
    const f = fakeStore()
    await linkProvider(f.store, { userId: ME, provider: 'google', subject: REAL_GOOGLE_SUB })
    const r = await linkProvider(f.store, { userId: ME, provider: 'google', subject: '100000000000000000002' })
    expect(r).toEqual({ status: 'provider-already-held' })
    expect(f.state.rows).toHaveLength(1)
    expect(f.state.inserts).toBe(1)
  })

  it('REFUSES a second LINE the same way', async () => {
    const f = fakeStore()
    await linkProvider(f.store, { userId: ME, provider: 'line', subject: `U${'a'.repeat(32)}` })
    const r = await linkProvider(f.store, { userId: ME, provider: 'line', subject: `U${'b'.repeat(32)}` })
    expect(r).toEqual({ status: 'provider-already-held' })
    expect(f.state.rows).toHaveLength(1)
  })

  it('a dead ya29 row does not count — the member may still attach their real Google', async () => {
    const f = fakeStore()
    await linkProvider(f.store, { userId: ME, provider: 'google', subject: DEAD_YA29 })
    const r = await linkProvider(f.store, { userId: ME, provider: 'google', subject: REAL_GOOGLE_SUB })
    expect(r.status).toBe('linked')
    expect(f.state.rows).toHaveLength(2)
  })

  it('holding one provider never blocks the OTHER provider', async () => {
    const f = fakeStore()
    await linkProvider(f.store, { userId: ME, provider: 'google', subject: REAL_GOOGLE_SUB })
    const r = await linkProvider(f.store, { userId: ME, provider: 'line', subject: `U${'a'.repeat(32)}` })
    expect(r.status).toBe('linked')
  })

  it('the SAME identity again is still "already-linked", not a refusal', async () => {
    const f = fakeStore()
    await linkProvider(f.store, { userId: ME, provider: 'google', subject: REAL_GOOGLE_SUB })
    const r = await linkProvider(f.store, { userId: ME, provider: 'google', subject: REAL_GOOGLE_SUB })
    expect(r).toEqual({ status: 'already-linked' })
  })

  it('an identity owned by ANOTHER member is still slice 4\'s collision, not this refusal', async () => {
    const f = fakeStore()
    await linkProvider(f.store, { userId: ME, provider: 'google', subject: REAL_GOOGLE_SUB })
    await linkProvider(f.store, { userId: SOMEONE_ELSE, provider: 'google', subject: '100000000000000000002' })
    const r = await linkProvider(f.store, { userId: ME, provider: 'google', subject: '100000000000000000002' })
    expect(r).toEqual({ status: 'owned-by-another' })
  })

  it('changing Google = unlink the old one, then link the new one', async () => {
    const f = fakeStore()
    await linkProvider(f.store, { userId: ME, provider: 'line', subject: `U${'a'.repeat(32)}` })
    await linkProvider(f.store, { userId: ME, provider: 'google', subject: REAL_GOOGLE_SUB })
    await unlinkProvider(f.store, { userId: ME, provider: 'google' })
    const r = await linkProvider(f.store, { userId: ME, provider: 'google', subject: '100000000000000000002' })
    expect(r.status).toBe('linked')
    expect(f.state.rows.filter((row) => row.provider.toLowerCase() === 'google')).toHaveLength(1)
  })
})
