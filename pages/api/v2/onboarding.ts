// POST /api/v2/onboarding — finish v2 first-run (#233). Browser → this route (same-origin) → BE
// POST /consent (mootech-be, on main since 249c14b): records the PDPA consent row, sets onboarding_goal,
// and stamps user.onboarded_at (which is what stops the first-run gate from looping the user forever).
//
// Two things this BFF owns that the BE deliberately does NOT (BE has no ValidationPipe / class-validator —
// 0/28 controllers guard; the real debt is mootech-be#16, out of scope here):
//   • goal is validated to be one of the SIX first-run goals before it can reach the DB.
//   • policy_version is server-owned — never read from the client body.
import type { NextApiRequest, NextApiResponse } from 'next'
import { PDPA_POLICY_VERSION } from '@/constants/pdpa'

const BE_ENDPOINT = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
if (/bazichart\.mumate\.co/i.test(BE_ENDPOINT)) {
  throw new Error(`[GUARDRAIL] NEXT_PUBLIC_BACKEND_URL points at old prod (${BE_ENDPOINT}).`)
}
const BE_TIMEOUT_MS = 12000

// The six IntentCheckScreen goals (GoalId). Kept in sync with features/v2-first-run/components/IntentCheckScreen.
const GOALS = ['finance', 'health', 'family', 'growth', 'love', 'work'] as const
function isGoal(v: unknown): v is (typeof GOALS)[number] {
  return typeof v === 'string' && (GOALS as readonly string[]).includes(v)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  const userId = typeof req.body?.user_id === 'string' ? req.body.user_id.trim() : ''
  const goal = req.body?.goal
  if (!userId) return res.status(400).json({ ok: false, error: 'user_id required' })
  if (!isGoal(goal)) {
    return res.status(400).json({ ok: false, error: 'goal must be one of the 6 first-run goals' })
  }

  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), BE_TIMEOUT_MS)
    const r = await fetch(`${BE_ENDPOINT}/consent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: userId, goal, policy_version: PDPA_POLICY_VERSION }),
      signal: ac.signal,
    })
    clearTimeout(timer)
    if (!r.ok) return res.status(502).json({ ok: false, error: `consent save failed (${r.status})` })
    const data = (await r.json().catch(() => null)) as { onboarded_at?: string; onboarding_goal?: string } | null
    // onboarded_at is the load-bearing field — without it the gate loops. Surface it so the caller can
    // confirm the stamp actually happened rather than assuming a 200 means done.
    return res.status(200).json({
      ok: true,
      onboarded_at: data?.onboarded_at ?? null,
      onboarding_goal: data?.onboarding_goal ?? goal,
    })
  } catch {
    return res.status(504).json({ ok: false, error: 'consent save timed out' })
  }
}
