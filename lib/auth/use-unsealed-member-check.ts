import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useCookies } from "react-cookie";
import { CookieKey } from "@/constants/cookie-key";
import { UUID_RE } from "./resolve-auth";
import { WELCOME_BACK_PATH } from "./ask-before-create";

// mumate-member-identity-hardening-001 slice 1 (2026-10-02).
//
// The app calls a member "authed" whenever cookie-mumate-id holds a UUID, session or not
// (resolve-auth.ts). The server's #391 fallback used to accept that cookie alone; it now needs the
// httpOnly member seal beside it (lib/auth/member-seal.ts). A browser with the cookie, no session and no
// seal would therefore look signed in and be refused by every route.
//
// The routes also refuse (409 reason:'identity') a cookie left over from ANOTHER account than the session
// ("ล็อกอินค้าง 2 บัญชี", เอ็ม 2026-09-23). The self-heal only mints when the cookie is missing, so nothing
// repaired that state.
//
// So, once the session has settled and the app holds a UUID cookie, ask the server once per mount.
// 401 clears the MEMBER_* cookies: the member becomes "anon" and the normal gates send them to sign in
// once. 409 reason:'identity' clears them too: with a session, the self-heal then mints the session's own
// member. Anything else (204, 404, an ambiguous 409, 5xx, network) leaves everything as it is — a fault
// must never sign anyone out. The welcome-back question page runs its own flow and is never touched.
const MEMBER_COOKIES = [
  CookieKey.MEMBER_ID,
  CookieKey.MEMBER_NAME,
  CookieKey.MEMBER_SURNAME,
  CookieKey.MEMBER_REFER_CODE,
  CookieKey.MEMBER_IMAGE,
] as const;

export function useUnsealedMemberCheck(): void {
  const { status: sessionStatus } = useSession();
  const [cookies, , removeCookie] = useCookies([...MEMBER_COOKIES]);
  const rawId = ((cookies[CookieKey.MEMBER_ID] as string) || "").trim();
  const askedRef = useRef(false);

  useEffect(() => {
    if (sessionStatus === "loading" || !UUID_RE.test(rawId) || askedRef.current) {
      return;
    }
    if (typeof window !== "undefined" && window.location.pathname === WELCOME_BACK_PATH) {
      return;
    }
    askedRef.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/auth/member-check", { credentials: "same-origin" });
        const stale =
          res.status === 401 ||
          (res.status === 409 && ((await res.json().catch(() => null)) as { reason?: string } | null)?.reason === "identity");
        if (!stale) {
          return;
        }
        for (const name of MEMBER_COOKIES) {
          removeCookie(name, { path: "/" });
        }
      } catch {
        // offline or similar: keep the cookies; a later mount asks again
      }
    })();
    // removeCookie's identity is not stable (react-cookie); the decision signals are enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, rawId]);
}
