// POST /api/v2/onboarding — finish v2 first-run (#233): records the PDPA consent row, sets onboarding_goal,
// and stamps user.onboarded_at (which is what stops the first-run gate from looping the user forever).
//
// 🔁 CIEL mumate-be-retirement-001 slice 1d — THIS ROUTE NO LONGER CALLS mootech-be. It used to forward to BE
// POST /consent with a BFF↔BE shared secret (`x-consent-secret` / CONSENT_SECRET, mootech-be#16). The two writes
// that BE call made now happen here, in one transaction, through lib/v2/consent-store.ts (parity notes there).
// There is no secret any more because there is no second hop: the only way to reach the write is this route,
// and this route answers "who" from the signed session (below). CONSENT_SECRET is gone from code and
// .env.example; the BE keeps its own copy until the BE itself is retired.
// The write used to run locally only when NODE_ENV !== 'production' (a dev fallback that stamped the two user
// columns and skipped the consent row). That fallback is now the ONE path, in every environment, and it
// writes the consent row too.
//
// Two things this route owns (they mirrored the BE guard, and now they ARE the guard):
//   • goal is validated to be one of the SIX first-run goals before it can reach the DB.
//   • policy_version is server-owned — never read from the client body.
//
// 🔴 IDENTITY (#252) — the old BE secret only ever answered "may this CALLER reach /consent", never "WHO is it".
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
import { recordOnboardingConsent } from '@/lib/v2/consent-store'

// The six IntentCheckScreen goals (GoalId). Kept in sync with features/v2-first-run/components/IntentCheckScreen.
const GOALS = ['finance', 'health', 'family', 'growth', 'love', 'work'] as const
function isGoal(v: unknown): v is (typeof GOALS)[number] {
  return typeof v === 'string' && (GOALS as readonly string[]).includes(v)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  // Identity FIRST — before the body is inspected at all, and before anything leaves this process.
  // An unauthenticated request must not learn whether its goal was well-formed, and must never reach the
  // write side (lib/v2/consent-store.ts). 401 / 404 / 409 come straight from the shared resolver.
  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ ok: false, error: who.error })
  const userId = who.userId

  const goal = req.body?.goal
  if (!isGoal(goal)) {
    return res.status(400).json({ ok: false, error: 'goal must be one of the 6 first-run goals' })
  }

  // The write. Identity came from the session above; policy_version is the server's constant. Nothing from
  // the body except the validated goal reaches it.
  try {
    const r = await recordOnboardingConsent({ userId, goal, policyVersion: PDPA_POLICY_VERSION })
    if (!r.ok) {
      // The session resolved to a user_id that has no "user" row. Nothing was written (the store checks
      // before it writes). The BE answered this case with 400 'User not found.', which the old BFF turned
      // into 502; 404 says what it is.
      return res.status(404).json({ ok: false, error: 'user not found' })
    }
    // onboarded_at is the load-bearing field — without it the gate loops. Surface it so the caller can
    // confirm the stamp actually happened rather than assuming a 200 means done.
    return res.status(200).json({ ok: true, onboarded_at: r.onboarded_at, onboarding_goal: r.onboarding_goal })
  } catch {
    // Both writes rolled back together. The driver's message is not relayed: it can name tables and values.
    return res.status(500).json({ ok: false, error: 'consent save failed' })
  }
}
