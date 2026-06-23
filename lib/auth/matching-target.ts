// Pure routing decision for the "ดวงสมพงศ์" / matching navigation
// (#mootech-login-loop-fix-v2).
//
// Extracted so it can be unit-tested HEADLESS (no React / next-auth imports):
// see scripts/matching-target.test.ts.
//
// THE RULE (do not weaken): a logged-in user must NEVER be routed to /login.
// An empty refer-code for an authenticated user is a DATA hydration problem, not
// an auth problem — we BACKFILL it (fetch get-user), we never bounce. Only a
// genuinely anonymous user (no auth) may be sent to /login.

export type MatchingTarget =
  // refer-code present -> go straight to /matching/:code (happy path).
  | { kind: "go-matching"; code: string }
  // authed but no refer-code -> fetch get-user to backfill, THEN go to matching.
  | { kind: "needs-backfill" }
  // genuinely anonymous -> the only safe time to route to /login.
  | { kind: "go-login" };

// Decide where the matching navigation should go.
//   isAuthed  — true when the user has a resolved identity (useCurrentUser
//               status === "authed" OR a MEMBER_ID cookie is present).
//   referCode — the MEMBER_REFER_CODE cookie value (may be empty/undefined).
export function resolveMatchingTarget(
  isAuthed: boolean,
  referCode: string | null | undefined,
): MatchingTarget {
  const code = (referCode ?? "").trim();

  if (code !== "") {
    // Happy path — refer-code present. Go regardless of auth-flag timing; a real
    // code is itself evidence of a resolved identity.
    return { kind: "go-matching", code };
  }

  if (isAuthed) {
    // Logged-in but refer-code missing -> backfill, NEVER bounce to /login.
    return { kind: "needs-backfill" };
  }

  // No code AND not authed -> genuinely anonymous.
  return { kind: "go-login" };
}
