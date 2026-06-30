// Pure render-gate decision for auth-gated pages (#mootech-fortune-stick-hydration-fix).
// React-free / DB-free so it can be unit-tested headless alongside resolveAuth.
//
// THE RULE (additive, do not weaken): a page shows <ScreenLoading/> while the identity
// is not yet "authed" (the existing #mootech-identity-guard-sweep gate) OR while the
// component has not mounted yet. The `!hasMounted` term is what makes the server render
// and the first client render agree (both ScreenLoading), eliminating the hydration
// mismatch. It must only ADD to the existing `authStatus !== "authed"` check — never
// replace it, and never touch the `authStatus === "anon"` redirect logic.
import type { AuthStatus } from "./resolve-auth";

export function shouldRenderScreenLoading(
  hasMounted: boolean,
  authStatus: AuthStatus,
): boolean {
  return !hasMounted || authStatus !== "authed";
}
