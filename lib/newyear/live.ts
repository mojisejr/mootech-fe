// แผนชีวิตปีใหม่ 2570 (/v2/newyear) — the production switch, the same shape as lib/taisui/live.ts.
// The page reaches staging as soon as its PR merges, and the owner's next promote would carry it to
// production with any other update. Until the Sinse has approved the wording and the owner says so, the
// page answers 404 on the production host. Turning it on is this one constant.
export const NEWYEAR_LIVE = false

export const PRODUCTION_HOST = 'bazichart.mumate.co'

/** True when the page may be served: always off production, and on production only when LIVE. */
export function isNewYearOpen(nextAuthUrl: string | undefined = process.env.NEXTAUTH_URL, live: boolean = NEWYEAR_LIVE): boolean {
  if (live) return true
  let host = ''
  try { host = nextAuthUrl ? new URL(nextAuthUrl).host : '' } catch { host = '' }
  return host !== PRODUCTION_HOST
}
