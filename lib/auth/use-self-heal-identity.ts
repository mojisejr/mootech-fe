import { useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useCookies } from "react-cookie";
import { CookieKey } from "@/constants/cookie-key";
import { mintMemberIdentity } from "./mint-member";
import { useCurrentUser } from "./use-current-user";
import { buildRegisterParamsFromSession } from "./register-params";
import {
  WELCOME_BACK_PATH,
  fetchIdentityStatus,
  hasChosenCreateNew,
} from "./ask-before-create";

function tabStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

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

    // 🔴 2026-10-01: session จากการล็อกอินผ่าน LIFF (#846, ถอดแล้ว) ถือ LINE sub ของช่อง LIFF ซึ่งอยู่คนละ Provider →
    // ไม่ตรงกับบัญชีจริง. OAuth ช่อง Login ให้ lineProfile เป็น claims ของ id_token (มี iss) — ไม่มี iss = มาจาก LIFF.
    // ออกจากระบบ (ไม่ mint / ไม่ถาม) แล้วให้ผู้ใช้ล็อกอินใหม่ตามปกติ.
    const lp = (session as { lineProfile?: { sub?: string; iss?: string } } | null)?.lineProfile;
    if (lp?.sub && !lp.iss && !(lp as { via?: string }).via) {
      healingRef.current = true;
      void signOut({ redirect: false });
      return;
    }
    // หน้าสาธารณะ (ลิงก์แชร์คำทำนาย / คอร์ส / โปรฯ) เปิดดูได้โดยไม่ต้องมีบัญชี — ห้ามเด้งไปถามหรือสร้างบัญชีให้
    if (typeof window !== "undefined" && /^\/(invite|course|promo)(\/|$)/.test(window.location.pathname)) {
      return;
    }

    const timer = setTimeout(async () => {
      if (healingRef.current) {
        return;
      }
      // DEV bypass, re-checked fresh at fire time (mirrors home; never re-register a dev session).
      if (isDevSession()) {
        return;
      }
      // Slice 5: the question page drives its own flow; minting here would create the
      // very account it is asking about.
      if (typeof window !== "undefined" && window.location.pathname === WELCOME_BACK_PATH) {
        return;
      }
      const params = buildRegisterParamsFromSession(session);
      if (!params) {
        return; // session not usable yet; a later render can retry
      }
      healingRef.current = true;
      // Slice 5 (mumate-login-identity-001, plan 0.8): ask before creating. Only when the
      // server says this identity has NO owner and the switch is on; any failure answers
      // "do not ask" and the heal continues exactly as before. A member who already chose
      // "create new" for this identity in this tab is not asked again.
      if (!hasChosenCreateNew(tabStorage(), params.provider, params.id_token)) {
        const status = await fetchIdentityStatus();
        if (status?.ask) {
          window.location.assign(WELCOME_BACK_PATH);
          return; // guard stays held: this page is being left
        }
      }
      try {
        const outcome = await mintMemberIdentity(params, setCookie);

        if (outcome.status === "rejected") {
          // Genuine BE rejection — mirror home: clear identity + sign out.
          removeCookie(CookieKey.MEMBER_ID, { path: "/" });
          removeCookie(CookieKey.MEMBER_NAME, { path: "/" });
          removeCookie(CookieKey.MEMBER_SURNAME, { path: "/" });
          removeCookie(CookieKey.MEMBER_REFER_CODE, { path: "/" });
          removeCookie(CookieKey.MEMBER_IMAGE, { path: "/" });
          signOut({ redirect: false });
          return;
        }

        if (outcome.status === "minted") {
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
