// Pure routing decision for the home "เช็คพื้นดวงและธาตุ" CTA / gotoWelcome
// (#mootech-home-cta-bounce-migration).
//
// Extracted so it can be unit-tested HEADLESS (no React / next-auth imports):
// see scripts/welcome-target.test.ts. Mirrors lib/auth/matching-target.ts.
//
// THE RULE (do not weaken): a logged-in user must NEVER be routed to /login.
// The old guard bounced on `infoUserId == ''` — but `infoUserId` is a LOCAL
// React state that the returning-user branch (hasMemberId early-return added in
// v1, commit 7d52131) never set, so returning users with a valid MEMBER_ID got
// bounced to /login-with even though they were logged in. Decide from the
// cookie-validated identity (useCurrentUser status), never from optimistic local
// state. Only a genuinely anonymous user may be sent to /login. While identity
// is still hydrating ("loading") we WAIT — we neither bounce nor proceed.

import type { AuthStatus } from "./resolve-auth";

export type WelcomeTarget =
  // identity still resolving -> do nothing yet (never bounce a hydrating user).
  | { kind: "wait" }
  // genuinely anonymous -> the only safe time to route to /login-with.
  | { kind: "login" }
  // authed + a result code present -> go straight to the result page.
  | { kind: "result"; code: string }
  // authed, no result code, not a refresh -> go to register/onboarding.
  | { kind: "register" }
  // authed, no result code, refresh flagged -> register with ?refresh=1.
  | { kind: "register-refresh" };

// Decide where the home CTA should navigate.
//   authStatus      — useCurrentUser status ("authed" | "loading" | "anon").
//   resultCode      — precomputed result code state (may be empty).
//   isRefreshResult — whether the result needs a refresh recompute.
export function resolveWelcomeTarget(
  authStatus: AuthStatus,
  resultCode: string | null | undefined,
  isRefreshResult: boolean,
): WelcomeTarget {
  // Never bounce a logged-in or still-hydrating user to /login.
  if (authStatus === "anon") {
    return { kind: "login" };
  }
  if (authStatus === "loading") {
    return { kind: "wait" };
  }

  // authStatus === "authed" from here.
  const code = (resultCode ?? "").trim();
  if (code !== "") {
    return { kind: "result", code };
  }
  return isRefreshResult ? { kind: "register-refresh" } : { kind: "register" };
}
