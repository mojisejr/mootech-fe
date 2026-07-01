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

export function useSelfHealIdentity(): void {
  const { data: session, status: sessionStatus } = useSession();
  const { status: authStatus } = useCurrentUser();
  const [cookies, setCookie, removeCookie] = useCookies([
    CookieKey.MEMBER_ID,
    CookieKey.MEMBER_NAME,
    CookieKey.MEMBER_SURNAME,
    CookieKey.MEMBER_REFER_CODE,
    CookieKey.MEMBER_IMAGE,
    CookieKey.LOGIN_PROVIDER,
  ]);

  // Single-fire guard across this component's life (mirrors home's registerInFlightRef).
  const healingRef = useRef(false);

  useEffect(() => {
    // The limbo, precisely: NextAuth says authenticated, but identity is still
    // "loading" (== no valid MEMBER_ID uuid yet). Anything else is not our case.
    if (sessionStatus !== "authenticated" || authStatus !== "loading") {
      return;
    }
    // DEV bypass already owns MEMBER_ID; never re-register it (mirrors home).
    if (cookies[CookieKey.LOGIN_PROVIDER] === "DEV") {
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
      const params = buildRegisterParamsFromSession(session);
      if (!params) {
        return; // session not usable yet; a later render can retry
      }
      healingRef.current = true;
      try {
        const result: any = await UserRegisterOrLogin(
          params.id_token,
          params.image,
          params.name,
          params.refer_code,
          params.email,
          params.provider,
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
