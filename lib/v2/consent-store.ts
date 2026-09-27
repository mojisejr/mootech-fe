// lib/v2/consent-store.ts — the write side of v2 first-run (CIEL mumate-be-retirement-001 slice 1d).
//
// Until this slice, POST /api/v2/onboarding forwarded to mootech-be POST /consent, which did the two
// writes below. This is that service, moved into the FE so the first-run gate no longer needs a backend.
// Parity target: mootech-be src/consent/consent.service.ts:47-94 (completeOnboarding), read at 0705378.
//
// WHAT IS KEPT EXACTLY:
//   • the row: consent { user_id, accepted_at, policy_version } — APPENDED, never an upsert. A second
//     first-run writes a second row; consent is auditable history, not current state.
//   • the stamp: user.onboarding_goal = goal, user.onboarded_at = the SAME `now` as accepted_at.
//   • the clock: BE's MomentService formats Asia/Bangkok 'YYYY-MM-DD HH:mm:ss' (moment().tz('Asia/Bangkok')).
//     bkkTimestamp is the FE's copy of that exact format, already used by every legacy create_at write.
//     The old non-production fallback in onboarding.ts wrote an ISO string instead; that was a dev-only
//     shortcut and is gone — production rows keep the BE's format, so old and new rows sort together.
//   • "user not found" is refused before anything is written (BE: 400 'User not found.').
//   • the return value: { onboarded_at, onboarding_goal } — what the BE returned and the BFF relayed.
//
// WHAT IS DELIBERATELY DIFFERENT:
//   • ONE TRANSACTION. The BE did two separate saves (consent, then user) with no transaction, so a failure
//     between them left a consent row with no onboarded_at — a member who consented and is still looped
//     through first-run. Here both land or neither does. No value changes.
//   • validation of goal / policy_version lives in the caller (pages/api/v2/onboarding.ts), as it already
//     did on the BFF side; this module trusts its typed arguments and is not reachable from a request.
//
// 🔴 EVERY QUERY INSIDE THE TRANSACTION GOES THROUGH `tx`, NEVER `db`. lib/db/index.ts runs ONE connection
//    (max: 1). The transaction holds it, so a stray `db.` call inside would queue behind the transaction that
//    is waiting for it — the self-deadlock found in lib/auth/link-account.ts (mootech-fe db-pool wedge). The
//    user-exists check is done with the UPDATE's own RETURNING for the same reason: no second statement.
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consent, user } from '@/lib/db/schema'
import { bkkTimestamp } from '@/lib/usage-core'

export type OnboardingConsentInput = {
  userId: string
  goal: string
  policyVersion: string
  now?: Date
}

export type OnboardingConsentResult =
  | { ok: true; onboarded_at: string; onboarding_goal: string }
  | { ok: false; reason: 'user-not-found' }

/** Thrown inside the transaction purely to roll it back; never escapes this module. */
class UserNotFound extends Error {}

export async function recordOnboardingConsent(input: OnboardingConsentInput): Promise<OnboardingConsentResult> {
  const now = bkkTimestamp(input.now ?? new Date())
  try {
    await db.transaction(async (tx) => {
      // The user row first: if it is not there, nothing may be written — the BE looked the user up before
      // either save. RETURNING answers "was it there" without a second round trip.
      const stamped = await tx
        .update(user)
        .set({ onboardingGoal: input.goal, onboardedAt: now })
        .where(eq(user.userId, input.userId))
        .returning({ userId: user.userId })
      if (stamped.length === 0) throw new UserNotFound()

      await tx.insert(consent).values({
        userId: input.userId,
        acceptedAt: now,
        policyVersion: input.policyVersion,
      })
    })
  } catch (e) {
    if (e instanceof UserNotFound) return { ok: false, reason: 'user-not-found' }
    throw e
  }
  return { ok: true, onboarded_at: now, onboarding_goal: input.goal }
}
