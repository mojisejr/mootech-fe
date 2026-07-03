import { useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useCookies } from "react-cookie";
import { CookieKey } from "@/constants/cookie-key";
import { CONFIG } from "@/constants/config";
import { UserRegisterOrLogin } from "@/constants/api/api-user-register-or-login";
import { UserGetById } from "@/constants/api/api-user-get";
import { useCurrentUser } from "./use-current-user";
import { buildRegisterParamsFromSession } from "./register-params";

// Global identity self-heal (#mumate-line-webview-oauth, Fix B).
//
// Root problem: MEMBER_ID is minted ONLY on "/" (the home register-login round-trip).
// A user who deep-links straight into an auth-gated page (e.g. from a LINE rich
// menu) carrying a valid NextAuth session but NO MEMBER_ID cookie lands in the
// "loading" limbo — resolveAuth returns "loading" forever (never "anon"), so the
// page's ScreenLoading gate never releases and never redirects. ~11 pages share
// that gate, so the heal is mounted ONCE globally in _app.tsx, not per page.
//
// This hook mints the missing MEMBER_ID IN PLACE (no redirect, no bounce), reusing
// the SAME register-login round-trip home uses. It fires ONLY in the exact limbo
// (session authenticated + identity still "loading"), ONCE (useRef single-fire),
// after a short delay so home wins when the user actually lands on "/". It never
// touches resolveAuth and never changes any page's gate — it only supplies the
// missing cookie, after which every gated page's authStatus flips to "authed"
// naturally. Deliberately narrower than home's minter: no getNotify, no CTA state.

// Let the canonical minter ("/") win before self-healing; only deep-link pages that
// bypass "/" reach this timeout still missing MEMBER_ID. If MEMBER_ID lands during
// the wait, authStatus flips to "authed", the effect re-runs and clears the timer.
const SELF_HEAL_DELAY_MS = 3000;

// Hard ceiling on the register-login round-trip. Without it, a hung request leaves
// healingRef pinned true forever (the await never settles) and the user is stuck on
// ScreenLoading with no recovery. On timeout the call rejects -> the catch releases
// the guard, and my-destiny's escape hatch (Fix B″) offers re-login after 8s.
const SELF_HEAL_CALL_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("self-heal register timed out")), ms),
    ),
  ]);
}

// DEV bypass marker. /dev-login sets LOGIN_PROVIDER=DEV and mints MEMBER_ID itself,
// so a dev session must never be re-registered. Read from document.cookie at FIRE
// time (not react-cookie's render snapshot, which can lag during hydration and let
// the heal arm before the cookie is visible). Prod builds disable the dev provider,
// so this is belt-and-suspenders parity with home.
const DEV_PROVIDER_MARKER = `${CookieKey.LOGIN_PROVIDER}=DEV`;
function isDevSession(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  return document.cookie.split(/;\s*/).includes(DEV_PROVIDER_MARKER);
}

export function useSelfHealIdentity(): void {
  const { data: session, status: sessionStatus } = useSession();
  const { status: authStatus } = useCurrentUser();
  const [, setCookie, removeCookie] = useCookies([
    CookieKey.MEMBER_ID,
    CookieKey.MEMBER_NAME,
    CookieKey.MEMBER_SURNAME,
    CookieKey.MEMBER_REFER_CODE,
    CookieKey.MEMBER_IMAGE,
  ]);

  // Single-fire guard across this component's life (mirrors home's registerInFlightRef).
  const healingRef = useRef(false);

  useEffect(() => {
    // The limbo, precisely: NextAuth says authenticated, but identity is still
    // "loading" (== no valid MEMBER_ID uuid yet). Anything else is not our case.
    if (sessionStatus !== "authenticated" || authStatus !== "loading") {
      return;
    }
    // DEV bypass (mirrors home). /dev-login mints MEMBER_ID itself, so a dev session
    // must never be re-registered. Defensive parity only: prod builds disable the dev
    // provider, and a real dev session always holds MEMBER_ID (so authStatus is
    // "authed" and this hook never reaches here). Read from document.cookie (the
    // real jar) rather than react-cookie's render snapshot, which lags on hydration.
    if (isDevSession()) {
      return;
    }
    if (healingRef.current) {
      return;
    }

    const cookieOpts = {
      path: "/",
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true as const,
    };

    const timer = setTimeout(async () => {
      if (healingRef.current) {
        return;
      }
      // DEV bypass, re-checked fresh at fire time (mirrors home; never re-register a dev session).
      if (isDevSession()) {
        return;
      }
      const params = buildRegisterParamsFromSession(session);
      if (!params) {
        return; // session not usable yet; a later render can retry
      }
      healingRef.current = true;
      try {
        const result: any = await withTimeout(
          UserRegisterOrLogin(
            params.id_token,
            params.image,
            params.name,
            params.refer_code,
            params.email,
            params.provider,
          ),
          SELF_HEAL_CALL_TIMEOUT_MS,
        );

        if (result && result.ok === false) {
          // Genuine BE rejection — mirror home: clear identity + sign out.
          removeCookie(CookieKey.MEMBER_ID, { path: "/" });
          removeCookie(CookieKey.MEMBER_NAME, { path: "/" });
          removeCookie(CookieKey.MEMBER_SURNAME, { path: "/" });
          removeCookie(CookieKey.MEMBER_REFER_CODE, { path: "/" });
          removeCookie(CookieKey.MEMBER_IMAGE, { path: "/" });
          signOut({ redirect: false });
          return;
        }

        if (result && result.user_id) {
          // Backfill refer code from get-user when the register edge returns it
          // empty — an empty MEMBER_REFER_CODE once bounced users to /login?refresh=2.
          let referCode = result.ref_code;
          if (!referCode || referCode === "") {
            try {
              const fetched: any = await UserGetById(result.user_id);
              if (fetched && fetched.refer_code) {
                referCode = fetched.refer_code;
              }
            } catch {
              // non-fatal: never block the heal on the backfill
            }
          }
          setCookie(CookieKey.MEMBER_ID, result.user_id, cookieOpts);
          setCookie(CookieKey.MEMBER_NAME, result.name, cookieOpts);
          setCookie(CookieKey.MEMBER_REFER_CODE, referCode, cookieOpts);
          setCookie(CookieKey.MEMBER_IMAGE, result.picture_url, cookieOpts);
          // MEMBER_ID now present -> useCurrentUser re-resolves to "authed" ->
          // every gated page's ScreenLoading releases on its own. No redirect.
          return;
        }

        // Response present but NO user_id: mirror home — do NOT wipe; release the
        // guard so a later render can retry.
        healingRef.current = false;
      } catch {
        // Network / unknown failure: release so a later render can retry; never wipe.
        healingRef.current = false;
      }
    }, SELF_HEAL_DELAY_MS);

    return () => clearTimeout(timer);
    // Depend only on the decision signals. react-cookie's cookies/setter identities
    // are not stable and would needlessly re-arm the timer; they are read at fire time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, authStatus, session]);
}
