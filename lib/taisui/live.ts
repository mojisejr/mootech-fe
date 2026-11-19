// ปีชง 2570 — the production switch (design/CONTRACT.md). The page reaches staging as soon as its PR
// merges, and the owner's next promote would carry it to production with any other update. Until the
// Sinse has approved the content and the owner says so, the page answers 404 on the production host.
// Turning it on is this one constant.
export const TAISUI_2570_LIVE = false

export const PRODUCTION_HOST = 'bazichart.mumate.co'

/** True when the page may be served: always off production, and on production only when LIVE. */
export function isTaisuiOpen(nextAuthUrl: string | undefined = process.env.NEXTAUTH_URL, live: boolean = TAISUI_2570_LIVE): boolean {
  if (live) return true
  let host = ''
  try { host = nextAuthUrl ? new URL(nextAuthUrl).host : '' } catch { host = '' }
  return host !== PRODUCTION_HOST
}
