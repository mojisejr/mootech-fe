// /api/v2/policy-consent — has the member accepted the CURRENT privacy policy? (CIEL mumate-pdpa-reconsent-001)
//   GET  → { ok, current, accepted, needed }   accepted = latest consent.policy_version (null = none)
//   POST → appends one consent row at the server's PDPA_POLICY_VERSION · { ok, version, accepted_at }
// Identity from the signed session only (same resolver as /api/v2/onboarding); the version is never read from
// the body. The page /v2/policy-update and the chat gate call this; home reads the same fact off /api/user.
import type { NextApiRequest, NextApiResponse } from 'next'
import { PDPA_POLICY_VERSION } from '@/constants/pdpa'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { latestPolicyVersion, recordPolicyConsent } from '@/lib/v2/consent-store'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'no-store')

  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ ok: false, error: who.error })
  const userId = who.userId

  try {
    if (req.method === 'GET') {
      const accepted = await latestPolicyVersion(userId)
      return res.status(200).json({ ok: true, current: PDPA_POLICY_VERSION, accepted, needed: accepted !== PDPA_POLICY_VERSION })
    }
    const r = await recordPolicyConsent({ userId, policyVersion: PDPA_POLICY_VERSION })
    return res.status(200).json({ ok: true, version: PDPA_POLICY_VERSION, accepted_at: r.accepted_at })
  } catch {
    // The driver's message is not relayed: it can name tables and values.
    return res.status(500).json({ ok: false, error: 'policy consent failed' })
  }
}
