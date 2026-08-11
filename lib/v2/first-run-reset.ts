// 🔴 TEMPORARY (#249) — deleted whole by #248 before launch. Nothing may depend on this module.
//
// The identity rule for the team-preview reset, kept PURE and React/next-auth-free so the mutants
// below can be fired without booting an API route.
//
// WHY THIS FILE EXISTS AT ALL: the obvious way to write the reset endpoint is to take the user_id
// from the request (body, query, or the MEMBER_ID cookie). All three are FORGEABLE:
//   • body/query — client-controlled by definition (this is exactly mootech-be#16's hole)
//   • MEMBER_ID  — set client-side with setCookie() in pages/index.tsx:206, NOT httpOnly ⇒ any
//                  visitor can edit it in devtools and hand us someone else's user_id
// The only identity the client cannot forge is the NextAuth session (a JWT signed with
// NEXTAUTH_SECRET, in an httpOnly cookie). So the server derives the user_id itself:
//
//   getServerSession → session.providerId  ─(user_provider.id_token)→  user_provider.user_id
//
// providerId is `account.providerAccountId` ([...nextauth].ts:70) and it is the SAME value the app
// stores as user_provider.id_token — pages/index.tsx:371 passes `session.providerId` into
// UserRegisterOrLogin's `id_token` argument. ✓ traced through both call sites, not assumed.

export type ResetIdentityInput = {
  /** from getServerSession — undefined when there is no valid NextAuth session */
  providerId?: string | null
  /** from getServerSession */
  provider?: string | null
  /** true only when the v2_access cookie matches V2_PREVIEW_KEY */
  v2Authenticated: boolean
}

export type ResetIdentity =
  | { ok: true; providerId: string; provider: string }
  | { ok: false; status: 401 | 400; error: string }

/**
 * Decide WHO (if anyone) this request is allowed to reset — and it is always the caller, never a
 * subject named by the caller. There is deliberately no `userId` field on the input type: a value
 * the client sent cannot reach this function, so it cannot reach the DELETE either.
 */
export function resolveResetIdentity(input: ResetIdentityInput): ResetIdentity {
  // Gate first (defence in depth — middleware guardV2 already checked, gate.ts asks each route to
  // re-check so the guard survives a matcher change).
  if (!input.v2Authenticated) {
    return { ok: false, status: 401, error: 'not in team preview' }
  }
  const providerId = (input.providerId ?? '').trim()
  const provider = (input.provider ?? '').trim()
  // No signed session ⇒ we have no forgery-proof identity ⇒ refuse. Never fall back to a cookie.
  if (!providerId || !provider) {
    return { ok: false, status: 401, error: 'not signed in' }
  }
  return { ok: true, providerId, provider }
}

export type ResolvedUser =
  | { ok: true; userId: string }
  | { ok: false; status: 404 | 409; error: string }

/**
 * Turn the rows matched for one provider account into the ONE user we may touch — or a refusal.
 *
 * 🔴 Why this is not just `rows[0]` (ตู๋, #254 B2): the lookup matches provider case-INsensitively,
 * the app's own dedupe (mootech-be user-provider.service.ts:32) matches case-SENSITIVELY, and nothing
 * enforces uniqueness on (id_token, provider) at the DB level. So two rows for one human CAN exist,
 * and picking "the first row" means picking whichever row the planner returned — which changes after
 * writes or vacuum. On an endpoint that DELETEs, an ambiguous answer must become a refusal, not a
 * coin flip. Same rows for the same user (a plain duplicate) is fine — it is one user_id.
 */
export function resolveUserFromRows(rows: Array<{ user_id?: unknown }>): ResolvedUser {
  const distinct = Array.from(
    new Set(
      rows
        .map((r) => (typeof r?.user_id === 'string' ? r.user_id.trim() : ''))
        .filter((id) => id !== ''),
    ),
  )
  if (distinct.length === 0) {
    return { ok: false, status: 404, error: 'no account for this login yet' }
  }
  if (distinct.length > 1) {
    return { ok: false, status: 409, error: 'identity is ambiguous — not resetting' }
  }
  return { ok: true, userId: distinct[0] }
}
