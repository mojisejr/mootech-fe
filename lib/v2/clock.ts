// #358 Phase 3 — "which month is now", as its own seam so a test can move it.
//
// 🔴 WHY THIS EXISTS AND IS NOT JUST bkkDateStr().slice(0,7) AT THE CALL SITE. The span gate compares the
// requested month against the current one, so every span test has to control "now". The alternatives were
// both worse: freezing the global clock leaks across a shared worker pool (mootech-fe#523 is open about
// exactly that class), and mocking @/lib/usage-core replaces a module a dozen unrelated things import.
// One tiny module means a test mocks the smallest possible surface and nothing else changes behaviour.
//
// ⚠️ It takes `now` so it stays pure and callable with a fixed date; the routes call it with no argument.
import { bkkDateStr } from '@/lib/usage-core'

/** 'YYYY-MM' for today in Asia/Bangkok — the month a span is measured from. */
export function currentMonthBkk(now: Date = new Date()): string {
  return bkkDateStr(now).slice(0, 7)
}
