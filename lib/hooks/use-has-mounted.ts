import { useEffect, useState } from "react";

// Returns false on the server render AND on the client's first render (hydration),
// then flips to true after mount. Use it to gate any UI whose initial tree depends on
// client-only state (e.g. a cookie read via react-cookie) so the first client render
// matches the server HTML and React does not throw a hydration mismatch (#418/#423).
//
// Why this exists (#mootech-fortune-stick-hydration-fix): identity lives in the
// `cookie-mumate-id` cookie, which the server cannot see (no SSR cookie seed in _app).
// So `useCurrentUser()` resolves to "loading" on the server but "authed" on the first
// client render — making auth-gated pages render <ScreenLoading/> on the server and the
// full page on first client paint. Holding render until `hasMounted` removes that
// divergence. This is purely additive: it never replaces the identity gate or the
// anon-redirect logic from #mootech-identity-guard-sweep.
export function useHasMounted(): boolean {
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);
  return hasMounted;
}
