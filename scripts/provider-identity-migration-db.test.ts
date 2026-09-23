// Real-Postgres proof for migration 0034 (mumate-login-identity-001 slice 2).
// The default test lane skips this file; run it against the local testenv database:
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//     npx vitest run scripts/provider-identity-migration-db.test.ts
//
// WHY A SYNTHETIC SEED RATHER THAN A RESTORE. The plan's DoD says "on an anonymized
// local restore". That is not achievable: testenv/scripts/anonymize.sql sets
// user_provider.id_token = '' on EVERY row by design, because a real id_token is a
// JWT carrying user claims — measured 5872 rows, 5872 blank, one distinct value. A
// restore therefore has no distinct provider identities at all and cannot host a
// uniqueness proof. The index proof does not need real identities; it needs the
// right SHAPE — duplicates present, then resolved. So this file builds that shape
// deterministically and runs THE REAL MIGRATION FILE against it, rather than a
// paraphrase of it, so what passes here is the artifact the owner will run.
//
// WHERE IT RUNS. In its own schema, created and dropped by the test. It never
// touches the restored user_provider in the arena, which is someone else's data.
//
// WHAT IT DOES NOT PROVE. Nothing about production volumes, production drift, or
// how long any statement takes on a real table. The row counts in the plan are a
// 2026-09-23 checkpoint and are not re-measured here — that needs the read-only
// production inventory query, which is deliberately NOT run: see the slice-2
// records in ciel-os.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const TEST_URL = process.env.TEST_DATABASE_URL
const SCHEMA = 'slice2_identity_proof'

const migrationSql = readFileSync(
  path.join(process.cwd(), 'lib/db/0034_provider_identity_unique.sql'),
  'utf8',
)
const rollbackSql = readFileSync(
  path.join(process.cwd(), 'lib/db/0034_provider_identity_unique_rollback.sql'),
  'utf8',
)

/**
 * Split the migration on its own STEP banners so each can be run and judged alone.
 * A step's banner block holds only its header comment; the statements live in the
 * block AFTER it, between that banner and the next one.
 */
function step(source: string, n: number): string {
  const parts = source.split(/^-- =+$/m)
  const headerIndex = parts.findIndex((part) => new RegExp(`^\\s*--\\s*STEP ${n}\\b`).test(part))
  if (headerIndex < 0 || headerIndex + 1 >= parts.length) throw new Error(`migration has no STEP ${n}`)
  const body = parts[headerIndex + 1]
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .trim()
  if (!body) throw new Error(`STEP ${n} parsed to no statements`)
  return body
}

describe.skipIf(!TEST_URL)('migration 0034 provider identity uniqueness', () => {
  const client = postgres(TEST_URL as string, { prepare: false, max: 2 })

  /** The shape the 2026-09-23 checkpoint describes, in miniature. */
  async function seed() {
    await client.unsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`)
    await client.unsafe(`CREATE SCHEMA ${SCHEMA}`)
    await client.unsafe(`
      CREATE TABLE ${SCHEMA}.user_provider (
        id varchar(36) PRIMARY KEY,
        user_id text NOT NULL,
        provider text NOT NULL,
        name text,
        picture_url text,
        email text NOT NULL DEFAULT '',
        id_token text NOT NULL,
        create_at varchar(255) NOT NULL,
        update_at varchar(255) NOT NULL
      )
    `)
    const rows: [string, string, string, string, string][] = [
      // id, user_id, provider, id_token, create_at
      ['r01', 'u-g1', 'GOOGLE', 'g-sub-1', '2026-01-01 00:00:00'],
      ['r02', 'u-g2', 'google', 'g-sub-2', '2026-02-01 00:00:00'],
      ['r03', 'u-l1', 'LINE', 'U-line-1', '2026-03-01 00:00:00'],
      ['r04', 'u-l2', 'LINE', 'U-line-2', '2026-03-02 00:00:00'],
      ['r05', 'u-dev', 'dev', 'dev-sub', '2026-04-01 00:00:00'],
      // dead credential rows: blank provider holding a Google ACCESS token
      ['r06', 'u-d1', '', 'ya29.a0AfB_byC_dead_token_one', '2026-05-01 00:00:00'],
      ['r07', 'u-d2', '', 'ya29.a0AfB_byC_dead_token_two', '2026-05-02 00:00:00'],
      // same-user duplicate: one member, same identity written twice
      ['r08', 'u-same', 'LINE', 'U-dup-same', '2026-06-01 00:00:00'],
      ['r09', 'u-same', 'LINE', 'U-dup-same', '2026-06-02 00:00:00'],
      // cross-user collision: one identity claimed by two members
      ['r10', 'u-x1', 'LINE', 'U-collide', '2026-07-01 00:00:00'],
      ['r11', 'u-x2', 'LINE', 'U-collide', '2026-07-02 00:00:00'],
      // cross-user collision that only lower(provider) can see
      ['r12', 'u-y1', 'GOOGLE', 'g-case-collide', '2026-08-01 00:00:00'],
      ['r13', 'u-y2', 'google', 'g-case-collide', '2026-08-02 00:00:00'],
    ]
    for (const [id, userId, provider, idToken, createAt] of rows) {
      await client`
        INSERT INTO ${client(SCHEMA)}.user_provider
          (id, user_id, provider, email, id_token, create_at, update_at)
        VALUES (${id}, ${userId}, ${provider}, '', ${idToken}, ${createAt}, ${createAt})
      `
    }
  }

  /** Run one migration step inside the proof schema. */
  async function run(sql: string) {
    await client.unsafe(`SET search_path TO ${SCHEMA}, public;\n${sql}`)
  }

  const idsNow = async (): Promise<string[]> => {
    const rows = await client.unsafe(`SELECT id FROM ${SCHEMA}.user_provider ORDER BY id`)
    return rows.map((r: any) => r.id)
  }

  beforeAll(seed)
  afterAll(async () => {
    await client.unsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`)
    await client.end()
  })

  it('deletes only dead credential rows, never a member row', async () => {
    await run(step(migrationSql, 2))
    const ids = await idsNow()
    expect(ids).not.toContain('r06')
    expect(ids).not.toContain('r07')
    expect(ids).toHaveLength(11)
    // The `dev` row is neither Google nor LINE and is NOT deleted - it is reported.
    expect(ids).toContain('r05')
  })

  it('collapses a same-user duplicate to the oldest row, deterministically', async () => {
    await run(step(migrationSql, 3))
    const ids = await idsNow()
    expect(ids).toContain('r08')
    expect(ids).not.toContain('r09')
    // A cross-user collision is NOT collapsed: nobody may pick an account owner.
    expect(ids).toContain('r10')
    expect(ids).toContain('r11')
  })

  it('normalises each provider to the spelling its live writer already stores', async () => {
    await run(step(migrationSql, 4))
    const rows = await client.unsafe(
      `SELECT provider, count(*)::int AS n FROM ${SCHEMA}.user_provider GROUP BY 1`,
    )
    const byProvider = Object.fromEntries(rows.map((r: any) => [r.provider, r.n]))
    expect(byProvider).toEqual({ google: 4, LINE: 5, dev: 1 })
  })

  it('refuses to build the index while any identity is claimed by two members', async () => {
    await expect(run(step(migrationSql, 5))).rejects.toThrow(/refusing to build the unique index/)
    const indexes = await client.unsafe(
      `SELECT indexname FROM pg_indexes WHERE schemaname = '${SCHEMA}' AND indexname = 'user_provider_identity_unique'`,
    )
    expect(indexes).toHaveLength(0)
  })

  it('builds the index once the owner has resolved every collision', async () => {
    // Stands in for the owner's hand resolution. The plan's rules: keep the side
    // holding a chart, else the older. Here: keep the older row.
    await client.unsafe(`DELETE FROM ${SCHEMA}.user_provider WHERE id IN ('r11','r13')`)
    await run(step(migrationSql, 5))
    const indexes = await client.unsafe(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = '${SCHEMA}' AND indexname = 'user_provider_identity_unique'`,
    )
    expect(indexes).toHaveLength(1)
    expect(indexes[0].indexdef).toMatch(/lower\(provider\)/)
  })

  it('stops a duplicate identity being written again, in either spelling', async () => {
    await expect(client.unsafe(`
      INSERT INTO ${SCHEMA}.user_provider (id, user_id, provider, email, id_token, create_at, update_at)
      VALUES ('r99', 'u-new', 'LINE', '', 'U-line-1', '2026-09-01', '2026-09-01')
    `)).rejects.toThrow(/user_provider_identity_unique/)

    // The case-insensitive half: the index is why 'GOOGLE' cannot sneak past 'google'.
    await expect(client.unsafe(`
      INSERT INTO ${SCHEMA}.user_provider (id, user_id, provider, email, id_token, create_at, update_at)
      VALUES ('r98', 'u-new2', 'GOOGLE', '', 'g-sub-2', '2026-09-01', '2026-09-01')
    `)).rejects.toThrow(/user_provider_identity_unique/)
  })

  it('stops the dead-credential class regrowing', async () => {
    await run(step(migrationSql, 6))
    await expect(client.unsafe(`
      INSERT INTO ${SCHEMA}.user_provider (id, user_id, provider, email, id_token, create_at, update_at)
      VALUES ('r97', 'u-blank', '  ', '', 'ya29.new_dead_token', '2026-09-01', '2026-09-01')
    `)).rejects.toThrow(/user_provider_provider_not_blank/)
  })

  it('demonstrates the rollback', async () => {
    await run(rollbackSql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n'))
    const indexes = await client.unsafe(
      `SELECT indexname FROM pg_indexes WHERE schemaname = '${SCHEMA}' AND indexname = 'user_provider_identity_unique'`,
    )
    expect(indexes).toHaveLength(0)
    // and the table accepts what it refused a moment ago
    await client.unsafe(`
      INSERT INTO ${SCHEMA}.user_provider (id, user_id, provider, email, id_token, create_at, update_at)
      VALUES ('r96', 'u-after', 'LINE', '', 'U-line-1', '2026-09-01', '2026-09-01')
    `)
    expect(await idsNow()).toContain('r96')
  })
})
