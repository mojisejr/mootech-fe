// Real-Postgres proof for the account merge (mumate-login-identity-001 slice 4).
// The default lane skips this file; run it against the local testenv database:
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   npx vitest run scripts/merge-identity-db.test.ts
//
// WHY THIS FILE EXISTS, stated as the gap it closes. Every other slice-4 spec runs
// against a fake transaction, which cannot say whether the SQL is even valid: whether
// `length(id_token)` is selectable, whether the UPDATE's RETURNING shape is what the
// adapter counts, whether `ops_audit_log` accepts a `::jsonb` cast of a stringified
// payload, or whether `user.create_at` exists under that name. None of that SQL had
// ever executed before this file ran. Slice 3 has the same file for the same reason
// (scripts/link-account-db.test.ts) and this one is its mirror, deliberately.
//
// WHAT IT PROVES THAT NOTHING ELSE DOES: the advisory lock, the row-scoped UPDATE and
// the audit insert run in ONE transaction against a REAL unique index on the real
// expression. The merge moves a row whose (lower(provider), id_token) is unchanged, so
// it must NOT trip that index — a claim that is only worth anything against a real one.
//
// §THE INDEX IS CREATED PARTIAL, AND THAT IS THE SAME REAL LIMIT SLICE 3 RECORDED.
// Production's index is over every row; the arena cannot carry that because
// testenv/scripts/anonymize.sql blanks id_token on all 5,872 rows. So this builds the
// SAME EXPRESSION under production's NAME restricted to this file's rows, and drops it
// afterwards. It is evidence that the merge does not violate that index; it is NOT
// evidence about production's index over production's data.
//
// §ALSO NOT PROVEN HERE. This is a direct connection — production reaches Supabase
// through the transaction pooler. And lib/v2/subscription.ts's hasEverPaid is not
// exercised: it reads through the application's own client, so the standing resolver is
// faked here. Its SQL is an ordinary Drizzle select over member_subscription plus the
// already-covered resolveMembership, which is the least of slice 4's risks; the paid
// RULE is proven in scripts/merge-survivor.test.ts.
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { linkProvider, mergeIdentity, planIdentityMerge } from '@/lib/auth/link-account'
import { createPostgresLinkStore } from '@/lib/auth/link-account-store'

const TEST_URL = process.env.TEST_DATABASE_URL
const PREFIX = 's4p'
// Production's name, for the reason slice 3's file records: recovery and index identity
// are keyed on it, and a differently named index would make this file weaker evidence
// than it looks.
const INDEX = 'user_provider_identity_unique'

describe.skipIf(!TEST_URL)('the merge against real Postgres', () => {
  const client = postgres(TEST_URL as string, { prepare: false, max: 8 })
  const database = drizzle(client)
  const store = createPostgresLinkStore(database as never)

  const members: string[] = []
  const subjects: string[] = []
  const audits: string[] = []

  /** Standing is faked: this file is about the SQL, not about who has paid. */
  const standing = (paid: Record<string, { isPaid: boolean | null; everPaid: boolean }>) => ({
    resolveStanding: async (userId: string) => paid[userId] ?? { isPaid: false, everPaid: false },
  })

  async function makeMember(): Promise<string> {
    const id = randomUUID()
    members.push(id)
    // Every NOT NULL column without a default has to be named — the same list slice 3's
    // file had to discover, which is part of why a fake store cannot stand in for this.
    const t = '2026-09-25 00:00:00'
    await client`
      INSERT INTO "user" (user_id, name, email, picture_url, refer_code,
                          create_at, update_at, login_at, dob, "time",
                          result_code, place_name, share_img_profile_url)
      VALUES (${id}, ${'slice4 proof'}, ${''}, ${''}, ${''},
              ${t}, ${t}, ${t}, ${''}, ${''},
              ${''}, ${''}, ${''})
    `
    return id
  }

  /** A GOOGLE-shaped identity: 21 characters, the length of a real `sub`.
   *
   *  🔴 THE FIRST VERSION OF THIS FILE GOT THIS WRONG AND IT IS WORTH THE WARNING.
   *  Fixtures were `slice4-proof-<uuid>` — 49 characters — and isDeadIdentityShape
   *  calls a Google row longer than 32 DEAD, because that is the `ya29` access-token
   *  class revision 0.3 measured. So five of these specs failed with
   *  `loser-holds-no-identity`: the test's own fixtures were being read as the dead
   *  class. The rule was right and the fixtures were wrong, which is the good direction
   *  for that mistake to point. Any future fixture for a Google identity must be short. */
  function googleSubject(): string {
    const s = `${PREFIX}${randomUUID().replace(/-/g, '').slice(0, 18)}`
    subjects.push(s)
    return s
  }

  /** A LINE-shaped identity: 33 characters, like a real LINE userId. Length does not
   *  matter for LINE — the dead class was Google-only, because the legacy path's
   *  email-discovery branch excluded LINE — but matching the real shape keeps the
   *  fixture honest. */
  function lineSubject(): string {
    const s = `${PREFIX}${randomUUID().replace(/-/g, '').slice(0, 30)}`
    subjects.push(s)
    return s
  }

  async function auditFor(userId: string) {
    const rows = await client`
      SELECT id, admin_user_id, action, target_user_id, payload
      FROM ops_audit_log
      WHERE action = 'member_identity_merge' AND target_user_id = ${userId}
    `
    for (const r of rows) audits.push(r.id as string)
    return rows
  }

  beforeAll(async () => {
    await client.unsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS ${INDEX}
        ON user_provider (lower(provider), id_token)
        WHERE id_token LIKE '${PREFIX}%'
    `)
  })

  afterAll(async () => {
    if (audits.length) await client`DELETE FROM ops_audit_log WHERE id = ANY(${audits})`
    if (subjects.length) await client`DELETE FROM user_provider WHERE id_token = ANY(${subjects})`
    if (members.length) {
      await client`DELETE FROM user_provider WHERE user_id = ANY(${members})`
      await client`DELETE FROM ops_audit_log WHERE target_user_id = ANY(${members})`
      await client`DELETE FROM "user" WHERE user_id = ANY(${members})`
    }
    await client.unsafe(`DROP INDEX IF EXISTS ${INDEX}`)
    await client.end()
  })

  it('moves exactly one row, leaves the index satisfied, and records the move', async () => {
    const paidUser = await makeMember()
    const freeUser = await makeMember()
    const theirGoogle = googleSubject()
    const myLine = lineSubject()

    // The paid member signs in with LINE; the free member holds the Google identity.
    await linkProvider(store, { userId: paidUser, provider: 'line', subject: myLine })
    await linkProvider(store, { userId: freeUser, provider: 'google', subject: theirGoogle })

    const before = await client`SELECT count(*)::int AS n FROM user_provider`

    const outcome = await mergeIdentity(
      store,
      { signedInUserId: paidUser, provider: 'google', subject: theirGoogle },
      standing({ [paidUser]: { isPaid: true, everPaid: true } }),
    )

    expect(outcome.status).toBe('merged')
    if (outcome.status !== 'merged') return
    expect(outcome.fromUserId).toBe(freeUser)
    expect(outcome.toUserId).toBe(paidUser)

    // The row moved rather than being copied: the table is the same size.
    const after = await client`SELECT count(*)::int AS n FROM user_provider`
    expect(after[0].n).toBe(before[0].n)

    const moved = await client`
      SELECT user_id, provider, id_token FROM user_provider WHERE id = ${outcome.rowId}
    `
    expect(moved).toHaveLength(1)
    expect(moved[0].user_id).toBe(paidUser)
    // (lower(provider), id_token) is untouched, which is why a real unique index does
    // not object to the move.
    expect(moved[0].id_token).toBe(theirGoogle)

    // The losing account keeps nothing.
    const left = await client`SELECT count(*)::int AS n FROM user_provider WHERE user_id = ${freeUser}`
    expect(left[0].n).toBe(0)

    // The audit row: a `::jsonb` cast of a stringified payload, which no fake could
    // have told us Postgres accepts.
    const trail = await auditFor(paidUser)
    expect(trail).toHaveLength(1)
    expect(trail[0].admin_user_id).toBeNull()
    const payload = trail[0].payload as Record<string, unknown>
    expect(payload.from_user_id).toBe(freeUser)
    expect(payload.to_user_id).toBe(paidUser)
    expect(payload.row_id).toBe(outcome.rowId)
    // The subject is a credential-shaped value and ops can read this table.
    expect(JSON.stringify(payload)).not.toContain(theirGoogle)
  })

  it('the reversal recorded in the payload actually reverses it', async () => {
    const paidUser = await makeMember()
    const freeUser = await makeMember()
    const theirGoogle = googleSubject()
    await linkProvider(store, { userId: paidUser, provider: 'line', subject: lineSubject() })
    await linkProvider(store, { userId: freeUser, provider: 'google', subject: theirGoogle })

    const outcome = await mergeIdentity(
      store,
      { signedInUserId: paidUser, provider: 'google', subject: theirGoogle },
      standing({ [paidUser]: { isPaid: true, everPaid: true } }),
    )
    if (outcome.status !== 'merged') throw new Error(`expected a merge, got ${outcome.status}`)

    const trail = await auditFor(paidUser)
    const payload = trail[0].payload as { row_id: string; from_user_id: string }

    // DoD 4: "the move is reversible by one statement". This is that statement, built
    // only from what the audit row holds.
    await client`
      UPDATE user_provider SET user_id = ${payload.from_user_id} WHERE id = ${payload.row_id}
    `

    const back = await client`SELECT user_id FROM user_provider WHERE id = ${payload.row_id}`
    expect(back[0].user_id).toBe(freeUser)
  })

  it('a refusal writes nothing at all — no row moves and no audit appears', async () => {
    const a = await makeMember()
    const b = await makeMember()
    const theirGoogle = googleSubject()
    await linkProvider(store, { userId: a, provider: 'line', subject: lineSubject() })
    await linkProvider(store, { userId: b, provider: 'google', subject: theirGoogle })

    const outcome = await mergeIdentity(
      store,
      { signedInUserId: a, provider: 'google', subject: theirGoogle },
      // Both sides look paid, so nobody may lose.
      standing({
        [a]: { isPaid: true, everPaid: true },
        [b]: { isPaid: true, everPaid: true },
      }),
    )

    expect(outcome).toEqual({ status: 'refused', reason: 'no-side-may-lose' })
    const still = await client`SELECT user_id FROM user_provider WHERE id_token = ${theirGoogle}`
    expect(still[0].user_id).toBe(b)
    expect(await auditFor(a)).toHaveLength(0)
    expect(await auditFor(b)).toHaveLength(0)
  })

  it('reads the identity LENGTH from the real column, and calls a ya29-shaped row dead', async () => {
    // The whole liveness inference rests on length(id_token) being selectable and on the
    // 32-character line revision 0.3 drew. Here it is measured rather than assumed.
    const paidUser = await makeMember()
    const freeUser = await makeMember()
    const theirGoogle = googleSubject()
    await linkProvider(store, { userId: paidUser, provider: 'line', subject: lineSubject() })
    await linkProvider(store, { userId: freeUser, provider: 'google', subject: theirGoogle })

    // A second Google row on the losing side, of the dead shape. If lengths were not
    // read, this would look like a second working credential and the merge would refuse.
    const dead = `${PREFIX}${'y'.repeat(300)}`
    subjects.push(dead)
    await client`
      INSERT INTO user_provider (id, user_id, provider, id_token, email, name, picture_url, create_at, update_at)
      VALUES (${randomUUID()}, ${freeUser}, ${'google'}, ${dead}, ${''}, ${''}, ${''},
              ${'2026-09-25 00:00:00'}, ${'2026-09-25 00:00:00'})
    `

    const plan = await planIdentityMerge(
      store,
      { signedInUserId: paidUser, provider: 'google', subject: theirGoogle },
      standing({ [paidUser]: { isPaid: true, everPaid: true } }),
    )

    // Two rows on the losing side, one of them dead, so exactly one is live.
    expect(plan.status).toBe('planned')
    if (plan.status !== 'planned') return
    expect(plan.loserLiveIdentities).toBe(1)
    expect(plan.loserUserId).toBe(freeUser)
  })

  it('refuses when the losing side holds two WORKING credentials', async () => {
    const paidUser = await makeMember()
    const freeUser = await makeMember()
    const theirGoogle = googleSubject()
    await linkProvider(store, { userId: paidUser, provider: 'line', subject: lineSubject() })
    await linkProvider(store, { userId: freeUser, provider: 'google', subject: theirGoogle })
    await linkProvider(store, { userId: freeUser, provider: 'line', subject: lineSubject() })

    const outcome = await mergeIdentity(
      store,
      { signedInUserId: paidUser, provider: 'google', subject: theirGoogle },
      standing({ [paidUser]: { isPaid: true, everPaid: true } }),
    )

    expect(outcome).toEqual({ status: 'refused', reason: 'loser-holds-several-identities' })
  })

  it('moves the SIGNED-IN side’s own credential when the other account is the one that paid', async () => {
    // The mirror direction, which nothing else executes against real SQL. The row that
    // moves is not the one just proven.
    const freeSignedIn = await makeMember()
    const paidOther = await makeMember()
    const myLine = lineSubject()
    const theirGoogle = googleSubject()
    await linkProvider(store, { userId: freeSignedIn, provider: 'line', subject: myLine })
    await linkProvider(store, { userId: paidOther, provider: 'google', subject: theirGoogle })

    const outcome = await mergeIdentity(
      store,
      { signedInUserId: freeSignedIn, provider: 'google', subject: theirGoogle },
      standing({ [paidOther]: { isPaid: true, everPaid: true } }),
    )

    expect(outcome.status).toBe('merged')
    if (outcome.status !== 'merged') return
    expect(outcome.fromUserId).toBe(freeSignedIn)
    expect(outcome.toUserId).toBe(paidOther)

    const mine = await client`SELECT user_id FROM user_provider WHERE id_token = ${myLine}`
    expect(mine[0].user_id).toBe(paidOther)
    // And the proven row never moved: it was already on the surviving side.
    const theirs = await client`SELECT user_id FROM user_provider WHERE id_token = ${theirGoogle}`
    expect(theirs[0].user_id).toBe(paidOther)
  })

  it('reports not-a-collision when the identity is already the signed-in member’s', async () => {
    const user = await makeMember()
    const mine = googleSubject()
    await linkProvider(store, { userId: user, provider: 'google', subject: mine })

    const outcome = await mergeIdentity(
      store,
      { signedInUserId: user, provider: 'google', subject: mine },
      standing({}),
    )

    expect(outcome).toEqual({ status: 'not-a-collision' })
  })

  it('reads user.create_at under that exact name, which the tiebreak depends on', async () => {
    // Both sides unpaid, so the decision falls to the creation timestamp — and that only
    // works if the column is really called create_at on the real table.
    const older = await makeMember()
    const newer = await makeMember()
    await client`UPDATE "user" SET create_at = ${'2025-01-01 00:00:00'} WHERE user_id = ${older}`
    await client`UPDATE "user" SET create_at = ${'2026-09-01 00:00:00'} WHERE user_id = ${newer}`
    const newerGoogle = googleSubject()
    await linkProvider(store, { userId: older, provider: 'line', subject: lineSubject() })
    await linkProvider(store, { userId: newer, provider: 'google', subject: newerGoogle })

    const plan = await planIdentityMerge(
      store,
      { signedInUserId: older, provider: 'google', subject: newerGoogle },
      standing({}),
    )

    expect(plan).toMatchObject({
      status: 'planned',
      survivorUserId: older,
      loserUserId: newer,
      reason: 'older-account-survives',
    })
  })
})
