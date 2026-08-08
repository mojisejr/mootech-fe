// MuMate v2 home — mascot/ผังดวง CLIENT cache (P3). Makes "สลับแท็บออกจากหน้าหลักแล้วกลับมา → มาสคอต +
// ธาตุขึ้นทันที ไม่ผ่านบล็อกเทา" real: every home mount re-asks ChineseHoroscopeGet for a chart whose answer
// is the same every time, so remount flashes a grey block before the mascot. Cache it and show it instantly.
//
// 🔴 MEMORY-ONLY — ❌ NEVER localStorage (P3 DoD#4, บอง's call after ตู๋'s F4 on P2): the month table earned a
// disk layer (whole month · ~6.8s · useful when you reopen the app tomorrow), but the chart is one image + one
// word AND MORE personal than the month table — not worth a disk copy, and nothing on disk = no PII to argue.
// Tab-switch (the real ask) is served 100% by memory alone. Same shape as day-detail-cache BEFORE P2 added
// its disk tier. scripts/chart-cache.test.ts pins the "never touches localStorage" invariant with a spy +
// a positive control (so "0 writes" is proven, not a 0-from-0 vacuum).
//
// SELF-HEAL — keyed by userId, storing the resultCode alongside (DoD#2: แก้วันเกิด → มาสคอตเปลี่ยนตาม ไม่ค้าง).
// A remount shows the cached chart instantly; when the LIVE user row lands, isChartFresh(userId, row.resultCode)
// decides: match → keep (no refetch) · mismatch (dob edited → BE returns a NEW result_code, verified live on
// testenv 2026-08-08: jvfQl2haFj2F→KBhQL58FQw8S) → refetch and overwrite. clearChartCache() on logout (DoD#5).
//
// ❌ avatar + upgrade badge are NOT cached here (DoD#3 money-bug) — those stay live-row-only; see
// deriveHomeLoading's money-bug boundary. This module holds ONLY the deterministic chart/compute source.
import type { ComputeMascotSource } from '@/lib/personalization/mascot'

type CachedChart = { resultCode: string; chart: ComputeMascotSource }

// userId → { resultCode, chart }. One entry per user (naturally bounded — the latest chart per identity);
// cleared on logout. No disk, no cap machinery needed (unlike the month cache) — a single compute per user.
const MEM = new Map<string, CachedChart>()

/** SYNC peek by identity — the cached chart to show INSTANTLY on remount (before the user row returns), or
 *  undefined. Freshness is validated separately via isChartFresh once the live row's resultCode is known. */
export function peekChart(userId: string): CachedChart | undefined {
  return MEM.get(userId)
}

/** The self-heal guard (DoD#2): the cached chart is fresh ONLY if its resultCode matches the LIVE row's.
 *  A dob edit makes BE mint a new result_code → mismatch → not fresh → the caller refetches and overwrites.
 *  🔴 dropping the `resultCode ===` check (returning just "is there an entry") serves a STALE chart after a
 *  dob edit — scripts/chart-cache.test.ts turns that mutant RED. */
export function isChartFresh(userId: string, resultCode: string): boolean {
  const c = MEM.get(userId)
  return !!c && c.resultCode === resultCode
}

/** Store the computed chart for an identity, keyed for self-heal by its resultCode. */
export function setChart(userId: string, resultCode: string, chart: ComputeMascotSource): void {
  MEM.set(userId, { resultCode, chart })
}

/** Logout hygiene (DoD#5) — the next identity on this machine starts with no cached chart. */
export function clearChartCache(): void {
  MEM.clear()
}

/** test-only introspection. */
export function _chartCacheSize(): number {
  return MEM.size
}
