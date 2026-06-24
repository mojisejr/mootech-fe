// Pure mapper: get-user response -> home routing state for a RETURNING user
// (#mootech-home-cta-bounce-migration).
//
// Extracted so it can be unit-tested HEADLESS (no React / network): see
// scripts/returning-result.test.ts.
//
// WHY: when a MEMBER_ID cookie already exists the home page SKIPS the
// register-login round-trip (the hasMemberId early-return added in v1). But that
// round-trip is the only thing that used to populate `resultCode` /
// `isRefreshResult` — the state the home CTA (gotoWelcome -> resolveWelcomeTarget)
// routes on. With them empty, a returning user WITH a computed chart was wrongly
// sent to /register instead of /my-destiny. We rehydrate the SAME two values from
// get-user (the source /my-destiny already uses), mirroring callApiRegister's
// original result_code/is_refresh handling exactly.

export interface ReturningResult {
  resultCode: string;
  isRefreshResult: boolean;
}

export interface GetUserResultShape {
  result_code?: string | null;
  is_refresh?: boolean | null;
}

// Mirror of the original callApiRegister handling:
//   if (result_code present) { isRefreshResult = is_refresh;
//     if (!is_refresh) resultCode = result_code; }  // refresh -> recompute, leave code empty
//   else nothing set.
export function resolveReturningResult(
  user: GetUserResultShape | null | undefined,
): ReturningResult {
  const code = (user?.result_code ?? "").toString().trim();
  if (code === "") {
    // No computed chart yet -> stays empty -> CTA routes to /register (input).
    return { resultCode: "", isRefreshResult: false };
  }
  const isRefresh = !!user?.is_refresh;
  // Refresh flagged -> leave resultCode empty so the CTA goes to recompute
  // (/register?refresh=1); otherwise expose the code so the CTA opens /my-destiny.
  return { resultCode: isRefresh ? "" : code, isRefreshResult: isRefresh };
}
