// POST /api/v2/onboarding — finish v2 first-run (#233). Browser → this route (same-origin) → BE
// POST /consent (mootech-be, on main since 249c14b): records the PDPA consent row, sets onboarding_goal,
// and stamps user.onboarded_at (which is what stops the first-run gate from looping the user forever).
//
// Two things this BFF owns that mirror the BE guard (mootech-be#16):
//   • goal is validated to be one of the SIX first-run goals before it can reach the DB.
//   • policy_version is server-owned — never read from the client body.
// This route carries the BFF↔BE shared secret `x-consent-secret` (mootech-be#16, fail-closed there):
// without the header the BE rejects the call with 401, so a request from OUTSIDE (a direct curl with no
// secret) cannot reach /consent. Same pattern as the AI wallet (lib/credit/wallet-client.ts sends
// x-ai-secret). Server-side only — CONSENT_SECRET is never NEXT_PUBLIC_.
//
// 🔴 IDENTITY (#252) — the secret above answers "may this CALLER reach /consent", never "WHO is it".
// Until this ticket the answer to "who" was `req.body.user_id`, and ตู๋ proved with a live probe that a
// request holding only the team passkey could write a PDPA consent row in a VICTIM's name and get 200
// back. The MEMBER_ID cookie is no better: pages/index.tsx sets it with a client-side `setCookie`, so it
// is not httpOnly and the sender owns it end to end.
// ⇒ user_id is now derived SERVER-SIDE from the signed NextAuth session and the request's own claim about
//   who it is, is not read at all. `user_id` in the body is INERT — not validated, not compared, not
//   logged: nothing to disagree with is the only shape that cannot be tricked into agreeing.
// ⇒ This uses resolveSessionUserId, the shared identity home (#287), NOT a local copy of the same three
//   steps. resolveUserFromRows there also refuses (409) when one provider account maps to two user rows —
//   a rule ตู๋ found in #254 B2 that a re-implementation here would silently drop.
// 🪞 The cost, stated because it IS a behaviour change: a visitor whose NextAuth session has expired but
//   whose MEMBER_ID cookie has not now gets 401 where they used to get 200. That is the same bar the
//   other six identity-bearing v2 routes already hold, and the alternative is trusting the forgeable half.
import type { NextApiRequest, NextApiResponse } from 'next'
import { PDPA_POLICY_VERSION } from '@/constants/pdpa'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'

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

  // Identity FIRST — before the body is inspected at all, and before anything leaves this process.
  // An unauthenticated request must not learn whether its goal was well-formed, and must never cause a
  // call to the BE (the write side). 401 / 404 / 409 come straight from the shared resolver.
  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ ok: false, error: who.error })
  const userId = who.userId

  const goal = req.body?.goal
  if (!isGoal(goal)) {
    return res.status(400).json({ ok: false, error: 'goal must be one of the 6 first-run goals' })
  }

  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), BE_TIMEOUT_MS)
    const r = await fetch(`${BE_ENDPOINT}/consent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // BFF↔BE shared secret — BE (#16) is fail-closed and 401s without it.
        'x-consent-secret': process.env.CONSENT_SECRET || '',
      },
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
