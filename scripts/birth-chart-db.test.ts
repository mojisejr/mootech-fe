// mumate-be-retirement-001 slice 1 — the register / edit-birth writer against real Postgres (DoD B3:
// "time is never NULL", the user columns and the log_calculate row v2 and /ops need). Skipped unless
// TEST_DATABASE_URL is set; touches only rows it creates and deletes them afterwards:
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   npx vitest run scripts/birth-chart-db.test.ts
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ db: {} }))

import { createPostgresBirthChartStore, saveBirthChart, parseBirthChartBody } from '@/lib/chart/save-birth-chart'
import { buildChartPayload, deriveChartCore, RESULT_CODE_RE } from '@/lib/chart/engine-chart'

const TEST_URL = process.env.TEST_DATABASE_URL

describe.skipIf(!TEST_URL)('birth-chart writer against real Postgres', () => {
  // max 1: the same single-connection budget the app runs with — a statement that escaped the
  // transaction onto another handle would hang this suite instead of passing.
  const client = postgres(TEST_URL as string, { prepare: false, max: 1 })
  const store = createPostgresBirthChartStore(drizzle(client) as never)
  const userId = randomUUID()
  const chart = buildChartPayload(
    { dob: '1990-05-15', time: '', gender: 'FEMALE' },
    deriveChartCore({ pillars: { year: { branch: '午' }, day: { stem: '庚' } } })!,
    null,
  )

  beforeAll(async () => {
    // The row register-login-fe creates for a new member (register-login-fe-store.ts:123-131).
    await client`
      INSERT INTO "user" (user_id, name, picture_url, email, create_at, update_at, refer_code, login_at,
        dob, time, is_remember_time, result_code, place_name, used_point, total_point, is_refresh,
        share_img_profile_url, surname, gender)
      VALUES (${userId}, 'Old', 'old.png', '', '2026-09-27 10:00:00', '2026-09-27 10:00:00', 'ZZZZ',
        '2026-09-27 10:00:00', '', '', false, '', '', 0, 20, true, '', 'Keep', 'FEMALE')`
  })

  afterAll(async () => {
    await client`DELETE FROM log_calculate WHERE user_id = ${userId}`
    await client`DELETE FROM "user" WHERE user_id = ${userId}`
    await client.end()
  })

  it('register: user columns + one minimal log_calculate row, same code', async () => {
    const input = parseBirthChartBody({ dob: '1990-05-15', time: '08:30', gender: 'MALE', name: 'New', surname: 'S', picture_url: 'p.png', account_name: 'New' })!
    const r = await saveBirthChart(store, userId, input, async () => chart)
    expect(r.ok).toBe(true)
    const code = r.ok ? r.code : ''
    expect(code).toMatch(RESULT_CODE_RE)

    const [u] = await client`SELECT dob, time, is_remember_time, gender, result_code, is_refresh, name, surname, picture_url, account_name, place_name FROM "user" WHERE user_id = ${userId}`
    expect(u).toEqual({
      dob: '1990-05-15',
      time: '08:30',
      is_remember_time: true,
      gender: 'MALE',
      result_code: code,
      is_refresh: false,
      name: 'New',
      surname: 'S',
      picture_url: 'p.png',
      account_name: 'New',
      place_name: '',
    })
    const logs = await client`SELECT "createAt", name, dob, time, gender, is_remember_time, code, result FROM log_calculate WHERE user_id = ${userId}`
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ name: '', dob: '1990-05-15', time: '08:30', gender: 'MALE', is_remember_time: true, code })
    expect(logs[0].createAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(JSON.parse(logs[0].result as string).detail.yearBelow.id).toBe(7)
  })

  it('edit-birth, time unknown: time "" (never NULL), new code, name/surname untouched', async () => {
    const r = await saveBirthChart(store, userId, { dob: '1991-02-04', time: '' }, async () => chart)
    expect(r.ok).toBe(true)
    const [u] = await client`SELECT dob, time, is_remember_time, gender, result_code, name, surname FROM "user" WHERE user_id = ${userId}`
    expect(u).toMatchObject({ dob: '1991-02-04', time: '', is_remember_time: false, gender: 'MALE', name: 'New', surname: 'S' })
    expect(u.result_code).toBe(r.ok ? r.code : '')
    const n = await client`SELECT count(*)::int AS n FROM log_calculate WHERE user_id = ${userId}`
    expect(n[0].n).toBe(2)
  })

  it('no such member → false and no log row (the update and insert are one transaction)', async () => {
    const ghost = randomUUID()
    const r = await saveBirthChart(
      { ...store, readMember: async () => ({ gender: 'MALE', placeName: '' }) }, // force past the read
      ghost,
      { dob: '1990-01-01', time: '' },
      async () => chart,
    )
    expect(r).toEqual({ ok: false, status: 404 })
    const n = await client`SELECT count(*)::int AS n FROM log_calculate WHERE user_id = ${ghost}`
    expect(n[0].n).toBe(0)
  })
})
