// Real-Postgres proof for the pre-index concurrency window. The default test
// lane skips this file; run it only against the local testenv database:
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   npx vitest run scripts/register-login-fe-db.test.ts
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { registerOrLoginInFe } from '@/lib/auth/register-login-fe'
import { createPostgresRegisterLoginStore } from '@/lib/auth/register-login-fe-store'

const TEST_URL = process.env.TEST_DATABASE_URL
const providerSubject = `codex-s1-${randomUUID()}`
const candidateUserIds = [randomUUID(), randomUUID()]
const providerRowIds = [randomUUID(), randomUUID()]

describe.skipIf(!TEST_URL)('FE-native register/login against real Postgres', () => {
  const client = postgres(TEST_URL as string, { prepare: false, max: 4 })
  const database = drizzle(client)
  const store = createPostgresRegisterLoginStore(database as any)

  async function cleanup() {
    await client`DELETE FROM log_activity WHERE user_id = ANY(${candidateUserIds})`
    await client`DELETE FROM user_provider WHERE id_token = ${providerSubject}`
    await client`DELETE FROM "user" WHERE user_id = ANY(${candidateUserIds})`
  }

  beforeAll(cleanup)
  afterAll(async () => {
    await cleanup()
    await client.end()
  })

  it('serializes two first-login requests into one member and one provider mapping', async () => {
    let userIndex = 0
    let providerIndex = 0
    const input = {
      provider: 'google',
      providerSubject,
      name: 'Concurrency proof',
      email: 'register-login-fe-test@example.invalid',
      pictureUrl: '',
    }
    const dependencies = {
      now: () => new Date('2026-09-23T02:00:00.000Z'),
      makeUserId: () => candidateUserIds[userIndex++],
      makeProviderRowId: () => providerRowIds[providerIndex++],
      makeReferCode: () => 'CONCURRENCYPROOFONLY',
    }

    const [a, b] = await Promise.all([
      registerOrLoginInFe(store, input, dependencies),
      registerOrLoginInFe(store, input, dependencies),
    ])

    expect(a.user_id).toBe(b.user_id)
    expect([a.is_user_new, b.is_user_new].sort()).toEqual([false, true])
    const providerRows = await client`
      SELECT user_id FROM user_provider
      WHERE id_token = ${providerSubject} AND lower(provider) = 'google'
    `
    expect(providerRows).toHaveLength(1)
    const memberRows = await client`
      SELECT user_id FROM "user" WHERE user_id = ANY(${candidateUserIds})
    `
    expect(memberRows).toHaveLength(1)
  })
})
