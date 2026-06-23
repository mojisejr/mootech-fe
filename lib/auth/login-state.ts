// Pure login-state logic for the home page register-login round-trip
// (#mootech-login-loop-fix).
//
// Extracted so it can be unit-tested HEADLESS (no React / next-auth imports):
// see scripts/login-state.test.ts.
//
// THE RULE (do not weaken): the home page MINTS the MEMBER_ID cookie via the
// register-login round-trip. The trigger must be IDEMPOTENT — fire whenever the
// NextAuth session is authenticated AND the MEMBER_ID cookie is not present yet
// (first login OR after any wipe). If MEMBER_ID already exists, skip. This stops
// the one-shot guard from blocking re-registration after the loading-tick wipe.
//
// And the inverse VOW: NEVER clear the token while the session is still
// "loading" — only on a genuine settled "unauthenticated" (real logout).

import type { SessionStatus } from "./resolve-auth";

// Should the home page (re)fire the register-login round-trip?
// True only when the session is authenticated AND we do not yet hold a member id.
export function shouldRegister(
  status: SessionStatus | string,
  hasMemberId: boolean,
): boolean {
  return status === "authenticated" && !hasMemberId;
}

// Should the home page clear identity cookies?
// True only on a genuine settled logout — NEVER during the "loading" tick
// (that loading-tick wipe is what raced the register round-trip and caused the
// login loop).
export function shouldClearToken(status: SessionStatus | string): boolean {
  return status === "unauthenticated";
}
