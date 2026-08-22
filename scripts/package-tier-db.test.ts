// #377 — DB half on a REAL postgres: the migration's shape, and the loop "edit in /ops → the sale lane
// changes, with no deploy". skipIf(!TEST_DATABASE_URL); the money lane's db suite is a Ready-gate (#370 B1):
//   TEST_DATABASE_URL=… DATABASE_URL=… npx vitest run scripts/package-tier-db.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { getPackage } from '@/lib/payment/repo'
import { quotePackage, UnsellablePackageError } from '@/lib/payment/catalog'
import { listPackages, applyEdit } from '@/lib/ops/packages'

const TEST_URL = process.env.TEST_DATABASE_URL
const M0009 = readFileSync(resolve('lib/db/0009_package_tier.sql'), 'utf8')

describe.skipIf(!TEST_URL)('payment_package tier + on-sale · real pg (#377)', () => {
  let sql: ReturnType<typeof postgres>

  beforeAll(async () => {
    sql = postgres(TEST_URL as string, { max: 6, ssl: false })
    await sql.unsafe(M0009) // idempotent by construction
  })

  afterAll(async () => {
    if (sql) await sql.end()
  })

  // every test starts from the migration's own intent for the v2 rows
  beforeEach(async () => {
    await sql`UPDATE payment_package SET amount = 790,  is_active = true  WHERE package_code = 'V2_PLUS_YEARLY'`
    await sql`UPDATE payment_package SET amount = 1590, is_active = true  WHERE package_code = 'V2_PRO_YEARLY'`
    await sql`UPDATE payment_package SET amount = 0,    is_active = false WHERE package_code LIKE 'V2\\_%MONTHLY'`
  })

  it('🔴 DoD — at least one PRO package exists (it was 0 before this ticket)', async () => {
    const [{ c }] = await sql`SELECT count(*)::int AS c FROM payment_package WHERE tier_code = 'PRO'`
    expect(c).toBeGreaterThanOrEqual(1)
  })

  it('🔴 DoD — no row is left with a NULL tier (the CHECK alone would have allowed it)', async () => {
    const [{ c }] = await sql`SELECT count(*)::int AS c FROM payment_package WHERE tier_code IS NULL`
    expect(c).toBe(0)
  })

  it('🔴 the DB refuses an unknown tier AND a NULL tier (both halves of the trap)', async () => {
    // 🔴 Clean up FIRST and LAST: if the constraint is ever missing (e.g. while proving these teeth with a
    // mutant), these INSERTs SUCCEED and would leave rows that no later run can add the constraint back
    // over — the table would stay permanently unguarded. Found exactly that way.
    await sql`DELETE FROM payment_package WHERE package_code LIKE 'ZZ%'`
    const ins = (tier: string | null) =>
      sql`INSERT INTO payment_package (plan_code, package_code, description, buffer_day, amount, expire, max_user, tier_code)
          VALUES ('MEMBER', ${'ZZ_' + String(tier)}, 'x', 0, 1, '1M', 1, ${tier})`
    await expect(ins('GARBAGE')).rejects.toThrow(/check|tier_code/i)
    await expect(ins(null)).rejects.toThrow(/null|not-null/i)
    await sql`DELETE FROM payment_package WHERE package_code LIKE 'ZZ%'`
  })

  it('🔴 DoD — the Pro card can be bought: quotePackage does not throw and prices ฿1,590', async () => {
    const pkg = await getPackage('V2_PRO_YEARLY')
    expect(pkg).not.toBeNull()
    const q = quotePackage(pkg!)
    expect(q.tierCode).toBe('PRO')
    expect(q.amountSatang).toBe(159000)
    expect(q.expire).toEqual({ value: 1, unit: 'Y' })
  })

  it('🔴 DoD — the monthly rows EXIST but are not sellable, and turning one on makes it sellable', async () => {
    const before = await getPackage('V2_PLUS_MONTHLY')
    expect(before).not.toBeNull() // it is in the database…
    expect(() => quotePackage(before!)).toThrow(UnsellablePackageError) // …but not for sale

    await applyEdit({ packageCode: 'V2_PLUS_MONTHLY', amountBaht: 89, isActive: true })
    const after = await getPackage('V2_PLUS_MONTHLY')
    expect(quotePackage(after!).amountSatang).toBe(8900) // no deploy happened in between
  })

  it('🔴 DoD — a price edited in /ops changes what the sale lane charges (no deploy)', async () => {
    expect(quotePackage((await getPackage('V2_PRO_YEARLY'))!).amountSatang).toBe(159000)
    await applyEdit({ packageCode: 'V2_PRO_YEARLY', amountBaht: 1290, isActive: true })
    expect(quotePackage((await getPackage('V2_PRO_YEARLY'))!).amountSatang).toBe(129000)
  })

  it('🔴 DoD — turning a package OFF makes the CHARGE lane refuse it, not just the screen hide it', async () => {
    await applyEdit({ packageCode: 'V2_PRO_YEARLY', amountBaht: 1590, isActive: false })
    const pkg = await getPackage('V2_PRO_YEARLY')
    expect(pkg!.isActive).toBe(false)
    expect(() => quotePackage(pkg!)).toThrow(UnsellablePackageError)
  })

  it('🔴 DoD — the legacy packages are PLUS, off sale, and still present (25 members reference them)', async () => {
    const rows = await sql`SELECT package_code, tier_code, is_active FROM payment_package
                            WHERE plan_code = 'MEMBER' AND package_code NOT LIKE 'V2\\_%'`
    expect(rows.length).toBe(15) // nothing was deleted
    for (const r of rows) {
      expect(r.tier_code).toBe('PLUS')
      expect(r.is_active).toBe(false)
    }
  })


  it('🔴 T1 — re-running 0009 does NOT overwrite what /ops decided (an operator turned a legacy package back on)', async () => {
    // The whole point of this ticket is that on-sale is an OPERATOR decision made from /ops. A migration
    // that is advertised as safe to re-run must therefore never reassert it. Mutant: put the unguarded
    // `UPDATE … SET is_active = false WHERE package_code NOT LIKE 'V2_%'` back → this test reddens.
    await applyEdit({ packageCode: 'SOULMATE', amountBaht: 499, isActive: true })
    const [before] = await sql`SELECT is_active FROM payment_package WHERE package_code = 'SOULMATE'`
    expect(before.is_active).toBe(true)

    await sql.unsafe(M0009) // exactly what an operator re-running the migration would do

    const [after] = await sql`SELECT is_active FROM payment_package WHERE package_code = 'SOULMATE'`
    expect(after.is_active).toBe(true) // still the operator's decision, not the migration's
    await applyEdit({ packageCode: 'SOULMATE', amountBaht: 499, isActive: false }) // restore
  })

  it('a re-run still does not disturb the v2 rows an operator has priced', async () => {
    await applyEdit({ packageCode: 'V2_PRO_YEARLY', amountBaht: 1234, isActive: true })
    await sql.unsafe(M0009)
    const [row] = await sql`SELECT amount, is_active FROM payment_package WHERE package_code = 'V2_PRO_YEARLY'`
    expect(Number(row.amount)).toBe(1234)
    expect(row.is_active).toBe(true)
  })

  it('applyEdit only touches price + on-sale (tier / expire / description are untouched)', async () => {
    const [before] = await sql`SELECT tier_code, expire, description FROM payment_package WHERE package_code = 'V2_PRO_YEARLY'`
    await applyEdit({ packageCode: 'V2_PRO_YEARLY', amountBaht: 1490, isActive: true })
    const [after] = await sql`SELECT tier_code, expire, description FROM payment_package WHERE package_code = 'V2_PRO_YEARLY'`
    expect(after).toEqual(before)
  })

  it('applyEdit on an unknown package_code changes nothing and reports it', async () => {
    expect(await applyEdit({ packageCode: 'NOPE_377', amountBaht: 100, isActive: false })).toBe(false)
  })

  it('listPackages surfaces a row whose tier the reader cannot map (tierKnown=false), instead of hiding it', async () => {
    const list = await listPackages()
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((p) => p.tierKnown)).toBe(true) // today every row maps — the flag exists for when one does not
  })
})
