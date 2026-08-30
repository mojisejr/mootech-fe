// The tooth ตู๋'s M1 mutant walked straight through (#357 review at 86cb8f2).
//
// be splits the point log by DOMAIN, not by "matching":
//   chinese-horoscope.service.ts:1121  LOVE                  → updateLoveMate  → activity_id 2 (user.service.ts:900)
//   chinese-horoscope.service.ts:1199  BOSS/EMPLOYEE/FRIEND  → updateWorkVibes → activity_id 3 (user.service.ts:874)
// I had read only the LOVE half and used one constant for all four. Nothing in the suite saw it: the
// parity run counted log_activity rows 1 → 2 but never read the column, and no unit test touched it.
//
// It reaches a screen — pages/api/log-activity.ts:24 joins activity_id to activity.description and
// pages/profile/activity/index.tsx:221 renders that name — so a single id labels three of the four
// types as the fourth.
//
// This asserts the LITERAL ids, not `LOVE !== WORK`. A test that only checked they differ would pass
// with the pair swapped (3 for love, 2 for work), which is the same bug wearing the other shoe.
import { describe, expect, it } from 'vitest'
import { activityIdFor } from '@/lib/matching/calculate-flow'

describe('activityIdFor — the point-log split be makes', () => {
  it('LOVE logs activity 2', () => {
    expect(activityIdFor('LOVE')).toBe(2)
  })

  it('BOSS, EMPLOYEE and FRIEND all log activity 3', () => {
    expect(activityIdFor('BOSS')).toBe(3)
    expect(activityIdFor('EMPLOYEE')).toBe(3)
    expect(activityIdFor('FRIEND')).toBe(3)
  })

  it('every matching type is covered, so a new type cannot silently inherit LOVE', () => {
    const seen = (['LOVE', 'BOSS', 'EMPLOYEE', 'FRIEND'] as const).map(activityIdFor)
    expect(seen).toEqual([2, 3, 3, 3])
  })
})
