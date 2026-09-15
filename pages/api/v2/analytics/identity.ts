// GET /api/v2/analytics/identity — the browser asks "what may GA call me, and did I consent?"
// (CIEL mootech-ga4-instrumentation-001, D2 + D5.)
//
// Reads the MEMBER_ID cookie (the same identity every BFF route trusts, lib/auth/resolve-auth.ts),
// answers with the keyed hash from lib/analytics/identity.ts and the member's latest 'analytics'
// consent from the engine, and writes both as first-party cookies so pages/_app.tsx can hand them to
// the Google tag synchronously on the next page load:
//
//   mumate-aid  = the 32-hex user_id     (absent when ANALYTICS_USER_ID_KEY is unset — no id, not a raw one)
//   mumate-ca   = '1' | '0'              (absent when the engine could not be asked — opt-out default applies)
//
// Nothing in the response or the cookies is the member id, an OAuth id, or a name. A caller without a
// valid MEMBER_ID gets 401 and no cookie, so an anonymous visitor cannot mint themselves an identity.
import type { NextApiRequest, NextApiResponse } from 'next'
import { UUID_RE } from '@/lib/auth/resolve-auth'
import { analyticsUserId } from '@/lib/analytics/identity'
import { analyticsConsentCookieValue } from '@/lib/analytics/consent'

export const ANALYTICS_ID_COOKIE = 'mumate-aid'

type ConsentRow = { kind?: string; accepted?: boolean }

async function latestAnalyticsConsent(memberId: string): Promise<boolean | null> {
  const base = process.env.BAZI_BASE_URL || 'http://localhost:3000'
  try {
    const r = await fetch(`${base}/api/account/consent?anonId=${encodeURIComponent(memberId)}`, {
      headers: { 'Content-Type': 'application/json' },
    })
    if (!r.ok) return null
    const j = (await r.json().catch(() => null)) as { consents?: ConsentRow[] } | null
    // Engine returns newest first (bazi src/app/api/account/consent/route.ts) — same read ConsentScreen does.
    const row = j?.consents?.find((c) => c.kind === 'analytics')
    return row ? row.accepted !== false : null
  } catch {
    return null
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const memberId = req.cookies['cookie-mumate-id'] ?? ''
  if (!UUID_RE.test(memberId)) return res.status(401).json({ code: 'not_authenticated' })

  const aid = analyticsUserId(memberId)
  const analytics = await latestAnalyticsConsent(memberId)

  const cookies: string[] = []
  if (aid) cookies.push(`${ANALYTICS_ID_COOKIE}=${aid}; Path=/; Max-Age=31536000; SameSite=Lax`)
  if (analytics !== null) cookies.push(analyticsConsentCookieValue(analytics))
  if (cookies.length) res.setHeader('Set-Cookie', cookies)
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ aid, analytics })
}
