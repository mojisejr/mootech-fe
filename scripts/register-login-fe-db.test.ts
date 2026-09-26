// Real-Postgres proof for the pre-index concurrency window. The default test
// lane skips this file; run it only against the local testenv database:
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   npx vitest run scripts/register-login-fe-db.test.ts
//
// WHAT THIS PROVES: with the advisory lock, N concurrent first logins for one
// provider identity leave exactly one member and exactly one provider mapping,
// and every caller that succeeds sees the same user_id.
//
// WHY THE NEGATIVE CONTROL EXISTS: the earlier version of this file raced two
// callers and asserted the happy outcome. That passes even with the lock
// removed entirely - two callers often do not interleave - so it proved the
// code does not break rather than that the lock does anything. The control
// below runs the same race through a store whose lock is a no-op and requires
// the duplicate to actually appear. Without it the main assertion is not
// evidence. No production file is modified to run it; the lock is dropped by
// wrapping the transaction the store hands out.
//
// WHAT THIS DOES NOT PROVE: it runs over a DIRECT connection to a local
// Postgres. Production reaches Supabase through the transaction pooler, where
// a session-scoped lock would not behave the same way. pg_advisory_xact_lock is
// transaction-scoped and so is safe there in principle, but this file is not
// evidence about the pooler, and slice 2's unique index is what makes the
// guarantee structural rather than cooperative.
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { registerOrLoginInFe, type RegisterLoginStore } from '@/lib/auth/register-login-fe'
import { createPostgresRegisterLoginStore } from '@/lib/auth/register-login-fe-store'

const TEST_URL = process.env.TEST_DATABASE_URL
const CONCURRENCY = 8
// The race is timing-dependent, so the control asserts it appears at least once
// across a few attempts rather than on any single one.
const CONTROL_ATTEMPTS = 5

describe.skipIf(!TEST_URL)('FE-native register/login against real Postgres', () => {
  const client = postgres(TEST_URL as string, { prepare: false, max: CONCURRENCY + 2 })
  const database = drizzle(client)
  const store = createPostgresRegisterLoginStore(database as any)

  // Same store, lock removed. Nothing in lib/ changes to run the control.
  const unlockedStore: RegisterLoginStore = {
    transaction: (work) =>
      store.transaction((tx) => work({ ...tx, lockProviderIdentity: async () => {} })),
  }

  const touchedUserIds: string[] = []
  const touchedSubjects: string[] = []

  async function cleanup() {
    if (touchedUserIds.length) {
      await client`DELETE FROM log_activity WHERE user_id = ANY(${touchedUserIds})`
    }
    if (touchedSubjects.length) {
      await client`DELETE FROM user_provider WHERE id_token = ANY(${touchedSubjects})`
    }
    if (touchedUserIds.length) {
      await client`DELETE FROM "user" WHERE user_id = ANY(${touchedUserIds})`
    }
  }

  async function raceFirstLogin(target: RegisterLoginStore) {
    const providerSubject = `slice1-proof-${randomUUID()}`
    const userIds = Array.from({ length: CONCURRENCY }, () => randomUUID())
    const rowIds = Array.from({ length: CONCURRENCY }, () => randomUUID())
    touchedSubjects.push(providerSubject)
    touchedUserIds.push(...userIds)
    let userIndex = 0
    let rowIndex = 0

    const settled = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        registerOrLoginInFe(
          target,
          {
            provider: 'google',
            providerSubject,
            name: 'Concurrency proof',
            email: 'register-login-fe-test@example.invalid',
            pictureUrl: '',
          },
          {
            now: () => new Date('2026-09-23T02:00:00.000Z'),
            makeUserId: () => userIds[userIndex++],
            makeProviderRowId: () => rowIds[rowIndex++],
            makeReferCode: () => 'CONCURRENCYPROOFONLY',
          },
        )
          .then((result) => ({ ok: true as const, result }))
          .catch((error) => ({ ok: false as const, status: error?.status })),
      ),
    )

    const providerRows = await client`
      SELECT user_id FROM user_provider
      WHERE id_token = ${providerSubject} AND lower(provider) = 'google'
    `
    const memberRows = await client`
      SELECT user_id FROM "user" WHERE user_id = ANY(${userIds})
    `
    return { settled, providerRows, memberRows }
  }

  beforeAll(cleanup)
  afterAll(async () => {
    await cleanup()
    await client.end()
  })

  it('serializes concurrent first logins into one member and one provider mapping', async () => {
    const { settled, providerRows, memberRows } = await raceFirstLogin(store)

    expect(providerRows).toHaveLength(1)
    expect(memberRows).toHaveLength(1)

    const succeeded = settled.filter((outcome) => outcome.ok)
    expect(succeeded.length).toBe(CONCURRENCY)
    const userIds = new Set(succeeded.map((outcome: any) => outcome.result.user_id))
    expect(userIds.size).toBe(1)
    // Exactly one caller may claim to have created the member.
    expect(succeeded.filter((outcome: any) => outcome.result.is_user_new)).toHaveLength(1)
  })

  // Covers the one store branch nothing else reaches: the `user`-table email
  // write is gated on the provider, so a spelling change could kill it silently.
  it('updates the member email on a returning Google login, and never on LINE', async () => {
    for (const [provider, subject, expected] of [
      ['google', `slice1-google-${randomUUID()}`, 'fresh@example.invalid'],
      ['LINE', `slice1-line-${randomUUID()}`, 'first@example.invalid'],
    ] as const) {
      const userId = randomUUID()
      touchedSubjects.push(subject)
      touchedUserIds.push(userId)
      const base = {
        provider, providerSubject: subject, name: 'Email proof',
        email: 'first@example.invalid', pictureUrl: '',
      }
      const dependencies = {
        now: () => new Date('2026-09-23T02:00:00.000Z'),
        makeUserId: () => userId,
        makeProviderRowId: () => randomUUID(),
        makeReferCode: () => 'EMAILPROOFEMAILPROOF',
      }
      await registerOrLoginInFe(store, base, dependencies)
      await registerOrLoginInFe(store, { ...base, email: 'fresh@example.invalid' }, dependencies)

      const [member] = await client`SELECT email FROM "user" WHERE user_id = ${userId}`
      expect(member.email).toBe(expected)
    }
  })

  // Owner decision 2026-09-23: the member avatar is refreshed from the
  // provider's own CDN, not copied into our storage. `user.picture_url` is the
  // column the app reads, and the legacy path refreshes it on every returning
  // LINE login - slice 1 originally never touched it after creation.
  it('refreshes the member avatar on a returning login, and never blanks it', async () => {
    const subject = `slice1-avatar-${randomUUID()}`
    const userId = randomUUID()
    touchedSubjects.push(subject)
    touchedUserIds.push(userId)
    const base = {
      provider: 'LINE' as const, providerSubject: subject, name: 'Avatar proof',
      email: '', pictureUrl: 'https://profile.line-scdn.net/first',
    }
    const dependencies = {
      now: () => new Date('2026-09-23T02:00:00.000Z'),
      makeUserId: () => userId,
      makeProviderRowId: () => randomUUID(),
      makeReferCode: () => 'AVATARPROOFAVATARPRO',
    }

    await registerOrLoginInFe(store, base, dependencies)
    const [created] = await client`SELECT picture_url FROM "user" WHERE user_id = ${userId}`
    expect(created.picture_url).toBe('https://profile.line-scdn.net/first')

    // The member changed their LINE photo.
    await registerOrLoginInFe(store, { ...base, pictureUrl: 'https://profile.line-scdn.net/second' }, dependencies)
    const [refreshed] = await client`SELECT picture_url FROM "user" WHERE user_id = ${userId}`
    expect(refreshed.picture_url).toBe('https://profile.line-scdn.net/second')

    // A session that carries no image must never erase the stored one.
    await registerOrLoginInFe(store, { ...base, pictureUrl: '' }, dependencies)
    const [kept] = await client`SELECT picture_url FROM "user" WHERE user_id = ${userId}`
    expect(kept.picture_url).toBe('https://profile.line-scdn.net/second')
  })

  // PRE-INDEX world. This is what the table looks like today: no unique index, so
  // the advisory lock is the only thing standing between two callers and a
  // duplicate. The post-index successor is the second describe block below, and it
  // asserts the opposite outcome for the same race - see its header.
  it('negative control: the same race duplicates the identity without the lock', async () => {
    let worstProviderRowCount = 0
    for (let attempt = 0; attempt < CONTROL_ATTEMPTS; attempt += 1) {
      const { providerRows } = await raceFirstLogin(unlockedStore)
      worstProviderRowCount = Math.max(worstProviderRowCount, providerRows.length)
      if (worstProviderRowCount > 1) break
    }
    // If this ever stops duplicating, the test above has stopped being evidence
    // and the reason must be understood before trusting it again.
    expect(worstProviderRowCount).toBeGreaterThan(1)
  })
})

// Slice 2's world: the unique index from lib/db/0034 exists. The race above then
// has the OPPOSITE outcome - the database refuses the duplicate instead of
// accepting it - so the pre-index control's assertion would fail here, by design
// rather than by regression. What must hold instead is that no caller is punished
// for losing the race: the unique-violation recovery in registerOrLoginInFe turns
// the loser into a returning member.
//
// It runs in its own schema so the arena's restored tables are never touched.
describe.skipIf(!TEST_URL)('FE-native register/login once the unique index exists', () => {
  const SCHEMA = 'slice2_route_proof'
  const client = postgres(TEST_URL as string, {
    prepare: false,
    max: CONCURRENCY + 2,
    connection: { search_path: `${SCHEMA},public` },
  })
  const store = createPostgresRegisterLoginStore(drizzle(client) as any)
  const unlockedStore: RegisterLoginStore = {
    transaction: (work) =>
      store.transaction((tx) => work({ ...tx, lockProviderIdentity: async () => {} })),
  }

  beforeAll(async () => {
    await client.unsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`)
    await client.unsafe(`CREATE SCHEMA ${SCHEMA}`)
    await client.unsafe(`
      CREATE TABLE ${SCHEMA}."user" (
        user_id text PRIMARY KEY, name text, picture_url text, email text,
        create_at text, update_at text, refer_code text, login_at text,
        dob text, time text, is_remember_time boolean, result_code text,
        place_name text, used_point int, total_point int, is_refresh boolean,
        share_img_profile_url text
      );
      CREATE TABLE ${SCHEMA}.user_provider (
        id varchar(36) PRIMARY KEY, user_id text NOT NULL, provider text NOT NULL,
        name text, picture_url text, email text NOT NULL DEFAULT '',
        id_token text NOT NULL, create_at text NOT NULL, update_at text NOT NULL
      );
      CREATE TABLE ${SCHEMA}.log_activity (
        id bigserial PRIMARY KEY, "createAt" text, activity_id int, point int, user_id text
      );
    `)
    // The artifact under test, taken from the migration rather than retyped.
    await client.unsafe(`
      CREATE UNIQUE INDEX user_provider_identity_unique
        ON ${SCHEMA}.user_provider (lower(provider), id_token)
    `)
  })

  afterAll(async () => {
    await client.unsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`)
    await client.end()
  })

  async function race(target: RegisterLoginStore, providerSubject: string) {
    let userIndex = 0
    let rowIndex = 0
    const userIds = Array.from({ length: CONCURRENCY }, () => randomUUID())
    const rowIds = Array.from({ length: CONCURRENCY }, () => randomUUID())
    const settled = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        registerOrLoginInFe(target, {
          provider: 'google', providerSubject, name: 'Index proof',
          email: 'register-login-fe-test@example.invalid', pictureUrl: '',
        }, {
          now: () => new Date('2026-09-23T02:00:00.000Z'),
          makeUserId: () => userIds[userIndex++],
          makeProviderRowId: () => rowIds[rowIndex++],
          makeReferCode: () => 'INDEXPROOFINDEXPROOF',
        })
          .then((result) => ({ ok: true as const, result }))
          .catch((error) => ({ ok: false as const, error })),
      ),
    )
    const providerRows = await client`
      SELECT user_id FROM user_provider WHERE id_token = ${providerSubject}
    `
    return { settled, providerRows }
  }

  it('keeps one identity and answers every caller, even with the lock removed', async () => {
    const subject = `slice2-no-lock-${randomUUID()}`
    const { settled, providerRows } = await race(unlockedStore, subject)

    // The index, not the lock, is what makes this one row.
    expect(providerRows).toHaveLength(1)
    // And nobody is punished for losing: the unique-violation recovery turns the
    // loser into a returning member instead of a 500 the caller would retry.
    const failures = settled.filter((outcome) => !outcome.ok)
    expect(failures).toEqual([])
    const userIds = new Set(settled.map((outcome: any) => outcome.result.user_id))
    expect(userIds.size).toBe(1)
    expect(settled.filter((outcome: any) => outcome.result.is_user_new)).toHaveLength(1)
  })

  it('still holds with the advisory lock in place, which is how it will ship', async () => {
    const subject = `slice2-locked-${randomUUID()}`
    const { settled, providerRows } = await race(store, subject)
    expect(providerRows).toHaveLength(1)
    expect(settled.filter((outcome) => !outcome.ok)).toEqual([])
    expect(settled.filter((outcome: any) => outcome.result.is_user_new)).toHaveLength(1)
  })
})
