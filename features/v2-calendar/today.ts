// MuMate v2 — ปฏิทินดวง · Asia/Bangkok "today" (client-only, mount-fenced by callers).
//
// WHY THIS IS A HOOK-FENCED VALUE, NOT A MODULE CONSTANT: "today" is derived from the clock, so the
// server render and the client hydration can land on DIFFERENT calendar days when they straddle Bangkok
// midnight (the exact timezone trap that bit user-fold: isNotExpired computed in UTC vs Bangkok). The
// FIX is to never render a clock-derived value in the FIRST paint — callers read this only AFTER mount
// (useHasMounted), so server HTML and first client render agree (no "today" ring), then the ring appears
// post-hydration. This util is pure; the fencing happens in the hook that calls it.
import { toISODate } from './month-grid'

/** Today's calendar date in Asia/Bangkok as `YYYY-MM-DD` — stable regardless of the runtime's local tz. */
export function bangkokTodayISO(): string {
  // en-CA gives ISO-ish YYYY-MM-DD; timeZone pins the Bangkok calendar day.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return parts // already YYYY-MM-DD
}

/** {year, month, day} of Bangkok today (month 1-12). */
export function bangkokToday(): { year: number; month: number; day: number } {
  const [y, m, d] = bangkokTodayISO().split('-').map(Number)
  return { year: y, month: m, day: d }
}

/** Re-export for callers building an ISO from parts. */
export { toISODate }
