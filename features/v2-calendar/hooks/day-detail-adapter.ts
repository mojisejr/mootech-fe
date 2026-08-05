// MuMate v2 — ปฏิทินดวง · adapter: BFF day-detail (lib DayDetail) → the feature DayDetail the card/screen bind.
//
// The BFF (mapDayDetail, B-5) already trims bazi to the fields the day screen renders. This seam just
// renames the few fields whose names differ (dayGanzhi→ganzhi, overallPercent→percent, colors→luckyColors)
// and drops what the feature contract doesn't carry. The กอง-1/กอง-2 sub-shapes were defined (G-4) to MATCH
// the lib shapes, so they pass through structurally. RAW discipline is preserved end-to-end — nothing is
// invented here (gates keep no level, colors stay Thai names, yams carry no tone).
import type { DayDetail as LibDayDetail } from '@/lib/v2-calendar/day-detail'
import type { DayDetail } from '../types'

/**
 * lib DayDetail → feature DayDetail. `percent`/`grade` fall back only on a DEGRADED reply — a day the user
 * can SELECT is a real scored grid day (month-adapter drops null-score days), so in practice they are present;
 * the hook returns null for a degraded fetch before this even runs. Advanced-mode `pillars` are omitted
 * (optional; the lib carries dayPillars/ownerPillars in a different shape — wired with advanced mode later).
 */
export function libDayDetailToFeature(lib: LibDayDetail): DayDetail {
  return {
    date: lib.date,
    day: Number(lib.date.slice(8, 10)) || 0,
    ganzhi: lib.dayGanzhi,
    percent: lib.overallPercent ?? 0, // degraded-only fallback (a selected day has a score)
    grade: lib.grade ?? '', // degraded-only fallback (grade tracks percent)
    summary: lib.summary,
    suitable: lib.suitable,
    avoid: lib.avoid,
    yams: lib.yams.map((y) => ({ id: y.id, label: y.label, window: y.window })), // no grade/tone (cut G-2)
    // pillars: omitted — advanced-mode, optional; different lib shape, wired separately.
    compatAreas: lib.compatAreas, // sub-shapes match (G-4) → pass through
    advice: lib.advice,
    insight: lib.insight,
    dayDeity: lib.dayDeity,
    spirits: lib.spirits,
    wanPhra: lib.wanPhra,
    luckyColors: lib.colors, // RAW Thai names
    gates: lib.gates, // RAW, no good/bad level
    dithi: lib.dithi,
    luckyDirection: lib.luckyDirection, // RAW ทิศ text
  }
}
