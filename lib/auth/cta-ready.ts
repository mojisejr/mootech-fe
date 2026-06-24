// Pure readiness gate for the home "เช็คพื้นดวงและธาตุ" CTA (#mootech-cta-race-gate).
//
// Extracted so it can be unit-tested HEADLESS (no React / next-auth imports):
// see scripts/cta-ready.test.ts. Companion to lib/auth/welcome-target.ts.
//
// THE PROBLEM (the race): `authStatus` comes from the id COOKIE (resolves to
// "authed" instantly on a valid MEMBER_ID), but `resultCode` is hydrated from
// get-user over the NETWORK (async, seconds on a cold /api/user). resolveWelcomeTarget
// is correct, but it was read the instant the user clicked — before the network
// settled — so a returning user with a computed chart saw resultCode='' and was
// routed to /register instead of /my-destiny.
//
// THE FIX: do not change the routing decision (it is right). Gate the BUTTON so it
// only fires once the routing state is actually known. `resultHydrated` is set true
// at every settle path that resolves resultCode (returning hydrate, DEV bypass,
// first-login register) — never in the error catch, so a failed hydrate keeps the
// gate closed and lets the retry re-open it.
//
// An anonymous user needs no result data (they go to /login), so they are ready
// immediately. While identity is still resolving ("loading") the button waits.

import type { AuthStatus } from "./resolve-auth";

// Decide whether the home CTA may fire yet.
//   authStatus     — useCurrentUser status ("authed" | "loading" | "anon").
//   resultHydrated — whether the async routing state (resultCode) has settled.
export function resolveCtaReady(
  authStatus: AuthStatus,
  resultHydrated: boolean,
): boolean {
  // Anonymous users route straight to /login — no result data to wait for.
  if (authStatus === "anon") {
    return true;
  }
  // Still resolving identity — never fire on a half-hydrated state.
  if (authStatus === "loading") {
    return false;
  }
  // authStatus === "authed": ready only once the routing state has settled.
  return resultHydrated;
}
