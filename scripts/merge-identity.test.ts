// mumate-login-identity-001 slice 4 — mergeIdentity over a fake transaction.
//
// ANCHOR: scripts/merge-identity.test.ts#one-row-moves-and-only-when-it-may
// Bug-class this owns: a merge that writes when it should have refused, that moves
// more than the one credential the member proved, or that moves a credential in the
// direction owner decision 8 forbids. All three are silent at the surface — the
// member sees a success and the damage is a row in a table nobody looks at.
//
// The fake carries the identity's LENGTH as well as its value, because the real
// adapter deliberately reads only the length (an old `ya29` access token is still a
// credential and has no business in application memory).
import { describe, it, expect } from 'vitest'

import { mergeIdentity, type LinkStore, type LinkTransaction } from '@/lib/auth/link-account'
import type { PaidVerdict } from '@/lib/auth/merge-survivor'

const SIGNED_IN = 'signed-in-user'
const OTHER = 'other-user'

interface Row {
  id: string
  userId: string
  provider: string
  subject: string
  identityLength?: number
}

interface AuditEntry {
  id: string
  rowId: string
  provider: string
  fromUserId: string
  toUserId: string
  reason: string
}

function fakeStore(opts: {
  rows: Row[]
  paid: Record<string, PaidVerdict>
  members?: string[]
  createdAt?: Record<string, string>
}) {
  const rows = opts.rows.map((r) => ({ ...r }))
  const members = new Set(opts.members ?? [SIGNED_IN, OTHER])
  const audit: AuditEntry[] = []
  const locks: string[] = []
  let moves = 0

  const tx: LinkTransaction = {
    async lockIdentity(provider, subject) {
      locks.push(`${provider}\u001f${subject}`)
    },
    async findIdentityOwner(provider, subject) {
      const hit = rows.find(
        (r) => r.provider.toLowerCase() === provider.toLowerCase() && r.subject === subject,
      )
      return hit ? { id: hit.id, userId: hit.userId, provider: hit.provider } : null
    },
    async memberExists(userId) {
      return members.has(userId)
    },
    async insertProviderRow() {
      throw new Error('mergeIdentity must never insert a row')
    },
    async listMemberProviders(userId) {
      return rows.filter((r) => r.userId === userId).map((r) => ({ id: r.id, userId: r.userId, provider: r.provider }))
    },
    async deleteProviderRows() {
      throw new Error('mergeIdentity must never delete a row')
    },
    async listMemberIdentityShapes(userId) {
      return rows
        .filter((r) => r.userId === userId)
        .map((r) => ({
          id: r.id,
          provider: r.provider,
          identityLength: r.identityLength ?? r.subject.length,
        }))
    },
    async moveProviderRow(rowId, toUserId) {
      const row = rows.find((r) => r.id === rowId)
      if (!row) return 0
      row.userId = toUserId
      moves += 1
      return 1
    },
    async recordIdentityMerge(entry) {
      audit.push(entry)
    },
    async memberCreatedAt(userId) {
      return opts.createdAt?.[userId] ?? '2026-01-01 00:00:00'
    },
  }

  const store: LinkStore = { transaction: (work) => work(tx) }
  return {
    store,
    rows,
    audit,
    locks,
    get moves() {
      return moves
    },
    deps: {
      // 🔴 NOT `opts.paid[userId] ?? false`. `??` treats null as nullish, so it
      // would quietly convert the undeterminable verdict into a known-free one and
      // erase the exact distinction half of these cases exist to prove. A missing
      // key means "no verdict supplied by this test", which is different again.
      resolvePaid: async (userId: string) =>
        Object.prototype.hasOwnProperty.call(opts.paid, userId) ? opts.paid[userId]! : false,
    },
  }
}

describe('mergeIdentity — the credential moves toward the account that may have paid', () => {
  it("moves the SIGNED-IN account's own credential away when the other side has paid", async () => {
    // Owner decision 8 by example. The member is signed into the free account and
    // has just proven the paid account's Google identity, so the free side loses and
    // its LINE credential is what moves. The proven row never moves here.
    const f = fakeStore({
      rows: [
        { id: 'row-line-free', userId: SIGNED_IN, provider: 'LINE', subject: 'U'.padEnd(33, 'a') },
        { id: 'row-google-paid', userId: OTHER, provider: 'google', subject: '104081630471234567890' },
      ],
      paid: { [SIGNED_IN]: false, [OTHER]: true },
    })

    const outcome = await mergeIdentity(f.store, {
      signedInUserId: SIGNED_IN,
      provider: 'google',
      subject: '104081630471234567890',
    }, f.deps)

    expect(outcome).toMatchObject({
      status: 'merged',
      rowId: 'row-line-free',
      fromUserId: SIGNED_IN,
      toUserId: OTHER,
      reason: 'only-one-may-lose',
    })
    expect(f.moves).toBe(1)
    expect(f.rows.find((r) => r.id === 'row-line-free')!.userId).toBe(OTHER)
    // The proven row stayed exactly where it was.
    expect(f.rows.find((r) => r.id === 'row-google-paid')!.userId).toBe(OTHER)
  })

  it('moves the PROVEN row when the account holding it is the one that may lose', async () => {
    const f = fakeStore({
      rows: [
        { id: 'row-line-paid', userId: SIGNED_IN, provider: 'LINE', subject: 'U'.padEnd(33, 'b') },
        { id: 'row-google-free', userId: OTHER, provider: 'google', subject: '104081630471234500000' },
      ],
      paid: { [SIGNED_IN]: true, [OTHER]: false },
    })

    const outcome = await mergeIdentity(f.store, {
      signedInUserId: SIGNED_IN,
      provider: 'google',
      subject: '104081630471234500000',
    }, f.deps)

    expect(outcome).toMatchObject({
      status: 'merged',
      rowId: 'row-google-free',
      fromUserId: OTHER,
      toUserId: SIGNED_IN,
    })
    expect(f.rows.find((r) => r.id === 'row-google-free')!.userId).toBe(SIGNED_IN)
  })

  it('moves exactly one row and leaves every other row alone', async () => {
    const f = fakeStore({
      rows: [
        { id: 'keep-1', userId: SIGNED_IN, provider: 'LINE', subject: 'U'.padEnd(33, 'c') },
        { id: 'move-me', userId: OTHER, provider: 'google', subject: '104000000000000000001' },
        // dead rows on the losing side: they are not credentials and must not move
        { id: 'dead-1', userId: OTHER, provider: 'google', subject: 'ya29-old-1', identityLength: 253 },
        { id: 'dead-2', userId: OTHER, provider: 'google', subject: 'ya29-old-2', identityLength: 337 },
      ],
      paid: { [SIGNED_IN]: true, [OTHER]: false },
    })

    await mergeIdentity(f.store, { signedInUserId: SIGNED_IN, provider: 'google', subject: '104000000000000000001' }, f.deps)

    expect(f.moves).toBe(1)
    expect(f.rows.find((r) => r.id === 'dead-1')!.userId).toBe(OTHER)
    expect(f.rows.find((r) => r.id === 'dead-2')!.userId).toBe(OTHER)
    expect(f.rows.find((r) => r.id === 'keep-1')!.userId).toBe(SIGNED_IN)
  })
})

describe('mergeIdentity — what it refuses, and that a refusal writes nothing', () => {
  it('refuses when neither side is known unpaid, and writes nothing at all', async () => {
    const f = fakeStore({
      rows: [
        { id: 'a', userId: SIGNED_IN, provider: 'LINE', subject: 'U'.padEnd(33, 'd') },
        { id: 'b', userId: OTHER, provider: 'google', subject: '104000000000000000002' },
      ],
      paid: { [SIGNED_IN]: true, [OTHER]: null },
    })

    const outcome = await mergeIdentity(f.store, { signedInUserId: SIGNED_IN, provider: 'google', subject: '104000000000000000002' }, f.deps)

    expect(outcome).toEqual({ status: 'refused', reason: 'no-side-may-lose' })
    expect(f.moves).toBe(0)
    expect(f.audit).toEqual([])
  })

  it('refuses when the losing side still holds several working credentials', async () => {
    const f = fakeStore({
      rows: [
        { id: 'a', userId: SIGNED_IN, provider: 'LINE', subject: 'U'.padEnd(33, 'e') },
        { id: 'b', userId: OTHER, provider: 'google', subject: '104000000000000000003' },
        { id: 'c', userId: OTHER, provider: 'LINE', subject: 'U'.padEnd(33, 'f') },
      ],
      paid: { [SIGNED_IN]: true, [OTHER]: false },
    })

    const outcome = await mergeIdentity(f.store, { signedInUserId: SIGNED_IN, provider: 'google', subject: '104000000000000000003' }, f.deps)

    expect(outcome).toEqual({ status: 'refused', reason: 'loser-holds-several-identities' })
    expect(f.moves).toBe(0)
  })

  it('reports not-a-collision when the identity is already the signed-in account’s', async () => {
    const f = fakeStore({
      rows: [{ id: 'a', userId: SIGNED_IN, provider: 'google', subject: '104000000000000000004' }],
      paid: { [SIGNED_IN]: false },
    })

    const outcome = await mergeIdentity(f.store, { signedInUserId: SIGNED_IN, provider: 'google', subject: '104000000000000000004' }, f.deps)

    expect(outcome).toEqual({ status: 'not-a-collision' })
    expect(f.moves).toBe(0)
  })

  it('reports identity-unknown when nobody owns the subject any more', async () => {
    const f = fakeStore({
      rows: [{ id: 'a', userId: SIGNED_IN, provider: 'LINE', subject: 'U'.padEnd(33, 'g') }],
      paid: { [SIGNED_IN]: false },
    })

    const outcome = await mergeIdentity(f.store, { signedInUserId: SIGNED_IN, provider: 'google', subject: 'vanished' }, f.deps)

    expect(outcome).toEqual({ status: 'identity-unknown' })
    expect(f.moves).toBe(0)
  })

  it('refuses to move a credential onto a member row that no longer exists', async () => {
    // user_provider.user_id carries no foreign key, so a row can outlive its member.
    const f = fakeStore({
      rows: [
        { id: 'a', userId: SIGNED_IN, provider: 'LINE', subject: 'U'.padEnd(33, 'h') },
        { id: 'b', userId: OTHER, provider: 'google', subject: '104000000000000000005' },
      ],
      paid: { [SIGNED_IN]: true, [OTHER]: false },
      members: [SIGNED_IN],
    })

    const outcome = await mergeIdentity(f.store, { signedInUserId: SIGNED_IN, provider: 'google', subject: '104000000000000000005' }, f.deps)

    expect(outcome).toEqual({ status: 'member-missing' })
    expect(f.moves).toBe(0)
  })
})

describe('mergeIdentity — the trail it leaves', () => {
  it('records the move so support can reverse it with one statement, and stores no subject', async () => {
    const f = fakeStore({
      rows: [
        { id: 'keep', userId: SIGNED_IN, provider: 'LINE', subject: 'U'.padEnd(33, 'i') },
        { id: 'moved', userId: OTHER, provider: 'google', subject: '104000000000000000006' },
      ],
      paid: { [SIGNED_IN]: true, [OTHER]: false },
    })

    await mergeIdentity(f.store, { signedInUserId: SIGNED_IN, provider: 'google', subject: '104000000000000000006' }, f.deps)

    expect(f.audit).toHaveLength(1)
    const entry = f.audit[0]!
    expect(entry).toMatchObject({
      rowId: 'moved',
      fromUserId: OTHER,
      toUserId: SIGNED_IN,
      reason: 'only-one-may-lose',
    })
    // Everything needed to reverse: which row, and where it came from.
    expect(entry.rowId).toBeTruthy()
    expect(entry.fromUserId).toBeTruthy()
    // The subject is a credential-shaped value and ops can read this table.
    expect(JSON.stringify(entry)).not.toContain('104000000000000000006')
  })

  it('takes the SAME advisory lock slice 3 takes, so a link and a merge cannot race', async () => {
    const f = fakeStore({
      rows: [
        { id: 'keep', userId: SIGNED_IN, provider: 'LINE', subject: 'U'.padEnd(33, 'j') },
        { id: 'moved', userId: OTHER, provider: 'google', subject: '104000000000000000007' },
      ],
      paid: { [SIGNED_IN]: true, [OTHER]: false },
    })

    await mergeIdentity(f.store, { signedInUserId: SIGNED_IN, provider: 'google', subject: '104000000000000000007' }, f.deps)

    expect(f.locks).toEqual(['google\u001f104000000000000000007'])
  })

  it('locks BEFORE it reads the owner, so two merges cannot both believe they know who owns it', async () => {
    const order: string[] = []
    const rows: Row[] = [
      { id: 'keep', userId: SIGNED_IN, provider: 'LINE', subject: 'U'.padEnd(33, 'k') },
      { id: 'moved', userId: OTHER, provider: 'google', subject: '104000000000000000008' },
    ]
    const tx = {
      async lockIdentity() {
        order.push('lock')
      },
      async findIdentityOwner() {
        order.push('read')
        return { id: 'moved', userId: OTHER, provider: 'google' }
      },
      async memberExists() {
        return true
      },
      async insertProviderRow() {},
      async listMemberProviders() {
        return []
      },
      async deleteProviderRows() {
        return 0
      },
      async listMemberIdentityShapes(userId: string) {
        return rows.filter((r) => r.userId === userId).map((r) => ({ id: r.id, provider: r.provider, identityLength: r.subject.length }))
      },
      async moveProviderRow() {
        order.push('write')
        return 1
      },
      async recordIdentityMerge() {},
      async memberCreatedAt() {
        return '2026-01-01 00:00:00'
      },
    } as unknown as LinkTransaction
    const store: LinkStore = { transaction: (work) => work(tx) }

    await mergeIdentity(
      store,
      { signedInUserId: SIGNED_IN, provider: 'google', subject: '104000000000000000008' },
      { resolvePaid: async (u) => (u === SIGNED_IN ? true : false) },
    )

    expect(order).toEqual(['lock', 'read', 'write'])
  })
})

describe('mergeIdentity — caller mistakes', () => {
  it('throws rather than merging without a subject', async () => {
    const f = fakeStore({ rows: [], paid: {} })
    await expect(
      mergeIdentity(f.store, { signedInUserId: SIGNED_IN, provider: 'google', subject: '  ' }, f.deps),
    ).rejects.toThrow(/subject/)
  })

  it('throws rather than merging without a signed-in member', async () => {
    const f = fakeStore({ rows: [], paid: {} })
    await expect(
      mergeIdentity(f.store, { signedInUserId: '', provider: 'google', subject: 'x' }, f.deps),
    ).rejects.toThrow(/signedInUserId/)
  })
})
