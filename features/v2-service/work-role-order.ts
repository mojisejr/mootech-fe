// features/v2-service/work-role-order.ts — #585 ก้อน 6, the fixed seat order of the three role readings.
//
// WHY THIS FILE EXISTS. The DoD says "ลำดับบทบาทคงที่ทุกคน ❌ ห้ามเรียงตามที่เอนจินส่งมา". The engine's
// array order looks stable but is not contractual: `buildWorkRoleReadings` pushes with
// `for (const r of [boss, sub, partner]) if (r) readings.push(r)`
// (bazi-sft-dataset `src/lib/bazi/pair-matching.ts:186-197`, branch `pdf-dev`), so a role whose stage
// lookup returns null is SKIPPED and every later role shifts one seat up. Ordering by array position
// would then put the wrong heading over the wrong paragraph on a screen that looks completely normal.
//
// 🔴 WHY MATCHING BY STRING IS SAFE HERE, AND WHAT HAPPENS WHEN IT IS NOT. The three `perspective`
// values are hard-coded literals at that same call site, NOT entries in the swappable `MatchingText`
// table, so they are values we can key on. But a value we do not own can still drift, and the failure
// mode of exact matching is a section that silently disappears. It does not disappear here: anything
// unrecognised is APPENDED after the known seats, in arrival order. A drift therefore costs us the
// ORDER of one section, never its CONTENT — the same trade `readRankedCandidates` makes for a person
// `ranking` forgot.
import type { WorkRole } from './work-comparison'

/**
 * The canonical seat order, top to bottom on the screen.
 *
 * มุน decided it (mootech-fe#585, ก้อน 6) after opening Figma 720:29221 and finding that the frame
 * answers a different question: its three sections are การงาน / ธุรกิจ / การเงิน, the domain axis ฟีม
 * overruled on 2026-09-01 (`work-comparison.ts:11-15`). The frame fixes the SHAPE of a section, not the
 * order of these three. The order below is a relationship gradient — the person above me, the person
 * below me, the person beside me — and it is also the order the engine's own source lists them in and
 * the order ticket #585 documents them in, so screen, source and ticket all read the same way.
 */
export const WORK_ROLE_ORDER = ['ตัวเรา → เจ้านาย', 'ลูกน้อง → ตัวเรา', 'หุ้นส่วน/เพื่อนร่วมงาน'] as const

/** Roles in fixed seat order; anything unrecognised keeps its content and goes last. */
export function orderRoles(roles: WorkRole[]): WorkRole[] {
  const seat = (r: WorkRole) => {
    const i = WORK_ROLE_ORDER.indexOf((r.perspective ?? '').trim() as (typeof WORK_ROLE_ORDER)[number])
    return i === -1 ? WORK_ROLE_ORDER.length : i
  }
  // A stable sort keeps two unrecognised roles in the order they arrived, so "last" stays predictable.
  return roles.map((r, i) => ({ r, i })).sort((a, b) => seat(a.r) - seat(b.r) || a.i - b.i).map((x) => x.r)
}
