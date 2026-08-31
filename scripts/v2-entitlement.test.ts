// #358 — teeth for "the three tiers actually get different amounts, in the shape the shop sells them".
//
// 🔴 MUTANT CONTRACT (each must redden a DIFFERENT test):
//   MU1  compatibility PLUS 20 → 2 (same as FREE)   → "PLUS and PRO are not the same as FREE" reddens
//   MU2  calendar PLUS 12 → 1                       → "PLUS reaches a year" reddens
//   MU3  isMonthReachable uses `<= span` not `< span` → "FREE sees only this month" reddens
//   MU4  drop Math.abs (forward-only)                → "symmetric: back as far as forward" reddens
//   MU5  PRO span null → 12                          → "PRO has no wall" reddens
//
// 🔑 WHY A TEST THAT COMPARES AGAINST THE SHOP FILE. The numbers here are a PROMISE ALREADY PRINTED on a
// screen a user can read (features/v2-shop/packages.ts). If the two ever drift, the app charges for one
// thing and delivers another — and nothing else in the repo would notice. So the last test reads that file
// and fails on drift, rather than trusting that whoever edits one will remember the other.
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import {
  monthlyQuotaFor,
  spanMonthsFor,
  isMonthReachable,
  monthDistance,
  type Tier,
} from '@/lib/v2/entitlement'

describe('#358 ดวงสมพงษ์ — counted per month, three different answers', () => {
  it('🔴 PLUS and PRO are not the same as FREE', () => {
    expect(monthlyQuotaFor('FREE', 'compatibility')).toBe(2)
    expect(monthlyQuotaFor('PLUS', 'compatibility')).toBe(20)
    expect(monthlyQuotaFor('PRO', 'compatibility')).toBeNull() // null = unlimited
  })

  it('no tier is blocked outright — 0 would read as "no access", which no tier here means', () => {
    for (const tier of ['FREE', 'PLUS', 'PRO'] as Tier[]) {
      const q = monthlyQuotaFor(tier, 'compatibility')
      expect(q === null || q > 0).toBe(true)
    }
  })
})

describe('#358 ปฏิทินดวง — a SPAN, not a count', () => {
  it('🔴 FREE sees only this month', () => {
    expect(spanMonthsFor('FREE', 'calendar')).toBe(1)
    expect(isMonthReachable('FREE', 'calendar', '2026-08', '2026-08')).toBe(true)
    expect(isMonthReachable('FREE', 'calendar', '2026-09', '2026-08')).toBe(false)
    expect(isMonthReachable('FREE', 'calendar', '2026-07', '2026-08')).toBe(false)
  })

  it('🔴 PLUS reaches a year — Aug reaches next Jul, but not next Aug', () => {
    expect(spanMonthsFor('PLUS', 'calendar')).toBe(12)
    expect(isMonthReachable('PLUS', 'calendar', '2027-07', '2026-08')).toBe(true) // month 12
    expect(isMonthReachable('PLUS', 'calendar', '2027-08', '2026-08')).toBe(false) // month 13
  })

  it('🔴 symmetric: back as far as forward', () => {
    expect(isMonthReachable('PLUS', 'calendar', '2025-09', '2026-08')).toBe(true) // 11 back
    expect(isMonthReachable('PLUS', 'calendar', '2025-08', '2026-08')).toBe(false) // 12 back
  })

  it('🔴 PRO has no wall, in either direction', () => {
    expect(spanMonthsFor('PRO', 'calendar')).toBeNull()
    expect(isMonthReachable('PRO', 'calendar', '2031-12', '2026-08')).toBe(true)
    expect(isMonthReachable('PRO', 'calendar', '2019-01', '2026-08')).toBe(true)
  })

  it('monthDistance crosses years correctly and rejects junk', () => {
    expect(monthDistance('2026-08', '2027-07')).toBe(11)
    expect(monthDistance('2026-08', '2026-08')).toBe(0)
    expect(monthDistance('2026-08', '2025-08')).toBe(-12)
    expect(() => monthDistance('2026-8', '2026-09')).toThrow()
    expect(() => monthDistance('nope', '2026-09')).toThrow()
  })
})

describe('#358 the table must not drift from what the shop already sells', () => {
  it('🔴 the shop card still says 2 / 20 / unlimited and 1 month / 1 year / unlimited', () => {
    const shop = readFileSync('features/v2-shop/packages.ts', 'utf8')
    // Free card
    expect(shop).toContain('ดวงสมพงษ์ การงาน, ความรัก 2 match')
    expect(shop).toContain('ปฏิทินดวงเฉพาะบุคคล เดือนปัจจุบัน (ดูสรุปรายวัน)')
    // Plus card
    expect(shop).toContain('ดวงสมพงษ์ การงาน, ความรัก 20 match')
    expect(shop).toContain('ปฏิทินดวงเฉพาะบุคคล 1 ปีเต็ม (รายวันแบบเต็ม)')
    // Pro card
    expect(shop).toContain('ดวงสมพงษ์ การงาน, ความรัก ไม่จำกัด (Unlimited)')
    expect(shop).toContain('ปฏิทินดวงเฉพาะบุคคล ไม่จำกัด (รายวันแบบเต็ม)')
  })
})

describe('#358 v1 constants stay untouched — the guardrail this ticket must not break', () => {
  it('🔴 usage-core still mirrors BE: free matching 100/YEAR, and no member constant', async () => {
    const core = await import('@/lib/usage-core')
    expect(core.FREE_MATCHING_LIMIT).toBe(100)
    // If someone "helpfully" edits this to 2, v1 tells users "เหลือ 2" while BE still allows 100.
    const src = readFileSync('lib/usage-core.ts', 'utf8')
    expect(src).toContain('export const FREE_MATCHING_LIMIT = 100')
  })
})
