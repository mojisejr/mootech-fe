// Real-Postgres proof for migration 0034 (mumate-login-identity-001 slice 2).
// The default test lane skips this file; run it against the local testenv database:
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//     npx vitest run scripts/provider-identity-migration-db.test.ts
//
// HOW IT PROVES THE ARTIFACT. It extracts the migration's DO block from
// lib/db/0034_provider_identity_unique.sql and runs it VERBATIM - no rewriting,
// no substituted numbers. That block asserts production counts (657 dead rows,
// 1787 respellings, and so on), so the seed below reproduces the production
// SHAPE AT PRODUCTION SCALE: 5,937 rows arranged exactly as the table stood
// after the collisions were resolved. If the file and the seed ever disagree,
// the file's own guards fail the test, which is the point.
//
// An earlier version of this file parsed the migration into steps by its comment
// banners. Rewriting those comments broke every assertion at once - the test was
// coupled to prose. Running the block whole cannot break that way.
//
// WHERE IT RUNS. In its own schema, created and dropped by the test. It never
// touches the arena's restored tables.
//
// WHAT IT DOES NOT PROVE. Nothing about production timing, and nothing about the
// application: the route's behaviour against this index is proven separately in
// scripts/register-login-fe-db.test.ts.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

const TEST_URL = process.env.TEST_DATABASE_URL
const SCHEMA = 'slice2_identity_proof'

function block(file: string, label: string): string {
  const source = readFileSync(path.join(process.cwd(), 'lib/db', file), 'utf8')
  // The file quotes an illustrative `DO $$` inside a comment, so anchor to one
  // at the start of a line - the only place a real statement can begin.
  const start = source.search(/^DO \$\$/m)
  const end = start < 0 ? -1 : source.indexOf('END $$;', start)
  if (start < 0 || end < 0) throw new Error(`${label}: no DO block found`)
  return source.slice(start, end + 'END $$;'.length)
}

const migrationBlock = block('0034_provider_identity_unique.sql', 'migration')
const rollbackSql = readFileSync(
  path.join(process.cwd(), 'lib/db/0034_provider_identity_unique_rollback.sql'),
  'utf8',
)
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')

describe.skipIf(!TEST_URL)('migration 0034 provider identity uniqueness', () => {
  const client = postgres(TEST_URL as string, { prepare: false, max: 2 })

  /**
   * The table as it stood on 2026-09-23 after the 20 collisions were resolved:
   * 1787 GOOGLE + 464 google + 3028 LINE + 657 dead + 1 dev = 5937 rows, with the
   * one same-user duplicate pair sitting inside the dead class - the shape that
   * made an order-dependent expectation wrong and cost a production run.
   */
  async function seed({ withCollision = false } = {}) {
    await client.unsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`)
    await client.unsafe(`CREATE SCHEMA ${SCHEMA}`)
    await client.unsafe(`
      CREATE TABLE ${SCHEMA}.user_provider (
        id text PRIMARY KEY, user_id text NOT NULL, provider text NOT NULL,
        email text NOT NULL DEFAULT '', id_token text NOT NULL,
        create_at text NOT NULL, update_at text NOT NULL
      );
      INSERT INTO ${SCHEMA}.user_provider (id, user_id, provider, id_token, create_at, update_at)
      SELECT 'G'||i, 'uG'||i, 'GOOGLE', 'g-sub-'||i, '2026-01-01', '2026-01-01' FROM generate_series(1,1787) i;
      INSERT INTO ${SCHEMA}.user_provider (id, user_id, provider, id_token, create_at, update_at)
      SELECT 'g'||i, 'ug'||i, 'google', 'g-new-'||i, '2026-09-01', '2026-09-01' FROM generate_series(1,464) i;
      INSERT INTO ${SCHEMA}.user_provider (id, user_id, provider, id_token, create_at, update_at)
      SELECT 'L'||i, 'uL'||i, 'LINE', 'U-'||i, '2026-03-01', '2026-03-01' FROM generate_series(1,3028) i;
      INSERT INTO ${SCHEMA}.user_provider (id, user_id, provider, id_token, create_at, update_at)
      SELECT 'd'||i, 'ud'||i, '', 'ya29.dead-'||i, '2026-05-01', '2026-05-01' FROM generate_series(1,655) i;
      -- the duplicate pair, itself inside the dead class
      INSERT INTO ${SCHEMA}.user_provider (id, user_id, provider, id_token, create_at, update_at) VALUES
        ('dup-a','uDup','','ya29.same','2026-04-22 15:24:29','2026-04-22 15:24:29'),
        ('dup-b','uDup','','ya29.same','2026-04-22 15:24:29','2026-04-22 15:30:20'),
        ('dev-1','uDev','dev','dev-sub','2026-06-01','2026-06-01');
    `)
    if (withCollision) {
      await client.unsafe(`
        INSERT INTO ${SCHEMA}.user_provider (id, user_id, provider, id_token, create_at, update_at)
        VALUES ('x1','uX1','LINE','U-collide','2026-03-01','2026-03-01'),
               ('x2','uX2','LINE','U-collide','2026-03-01','2026-03-01')`)
    }
  }

  const run = (sql: string) => client.unsafe(`SET search_path TO ${SCHEMA}, public;\n${sql}`)
  const count = async (where = 'true') => {
    const rows = await client.unsafe(
      `SELECT count(*)::int AS n FROM ${SCHEMA}.user_provider WHERE ${where}`)
    return (rows[0] as any).n as number
  }

  beforeEach(() => seed())
  afterAll(async () => {
    await client.unsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`)
    await client.end()
  })

  it('seeds the shape the migration was written against', async () => {
    expect(await count()).toBe(5937)
    expect(await count(`provider = 'GOOGLE'`)).toBe(1787)
    expect(await count(`btrim(provider) = ''`)).toBe(657)
  })

  it('applies the committed block verbatim and leaves the table as production looks', async () => {
    await run(migrationBlock)

    expect(await count()).toBe(5280)
    expect(await count(`btrim(provider) = ''`)).toBe(0)
    expect(await count(`provider = 'GOOGLE'`)).toBe(0)
    expect(await count(`provider = 'google'`)).toBe(2251)
    expect(await count(`provider = 'LINE'`)).toBe(3028)
    expect(await count(`provider = 'dev'`)).toBe(1)

    const index = await client.unsafe(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = '${SCHEMA}' AND indexname = 'user_provider_identity_unique'`)
    expect(index).toHaveLength(1)
    expect((index[0] as any).indexdef).toMatch(/lower\(provider\)/)
  })

  it('refuses everything, writing nothing, while an identity is claimed by two members', async () => {
    await seed({ withCollision: true })
    await expect(run(migrationBlock)).rejects.toThrow(/still claimed by two members/)
    // The dead rows the first step would have deleted are all still here.
    expect(await count(`btrim(provider) = ''`)).toBe(657)
    expect(await count(`provider = 'GOOGLE'`)).toBe(1787)
  })

  it('then refuses a duplicate identity in either spelling', async () => {
    await run(migrationBlock)
    await expect(client.unsafe(`
      INSERT INTO ${SCHEMA}.user_provider (id, user_id, provider, id_token, create_at, update_at)
      VALUES ('n1','uNew','LINE','U-1','2026-09-01','2026-09-01')
    `)).rejects.toThrow(/user_provider_identity_unique/)
    await expect(client.unsafe(`
      INSERT INTO ${SCHEMA}.user_provider (id, user_id, provider, id_token, create_at, update_at)
      VALUES ('n2','uNew2','GOOGLE','g-sub-1','2026-09-01','2026-09-01')
    `)).rejects.toThrow(/user_provider_identity_unique/)
  })

  it('then stops the dead-credential class regrowing', async () => {
    await run(migrationBlock)
    await expect(client.unsafe(`
      INSERT INTO ${SCHEMA}.user_provider (id, user_id, provider, id_token, create_at, update_at)
      VALUES ('n3','uBlank','  ','ya29.new','2026-09-01','2026-09-01')
    `)).rejects.toThrow(/user_provider_provider_not_blank/)
  })

  it('demonstrates the rollback of the structure it added', async () => {
    await run(migrationBlock)
    await run(rollbackSql)
    const index = await client.unsafe(
      `SELECT indexname FROM pg_indexes WHERE schemaname = '${SCHEMA}' AND indexname = 'user_provider_identity_unique'`)
    expect(index).toHaveLength(0)
    // and the table accepts what it refused a moment ago
    await client.unsafe(`
      INSERT INTO ${SCHEMA}.user_provider (id, user_id, provider, id_token, create_at, update_at)
      VALUES ('n4','uAfter','LINE','U-1','2026-09-01','2026-09-01')`)
    expect(await count(`id = 'n4'`)).toBe(1)
  })
})
