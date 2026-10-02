import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useCookies } from "react-cookie";
import { CookieKey } from "@/constants/cookie-key";
import { UUID_RE } from "./resolve-auth";

// mumate-member-identity-hardening-001 slice 1 (2026-10-02).
//
// The app calls a member "authed" whenever cookie-mumate-id holds a UUID, session or not
// (resolve-auth.ts). The server's #391 fallback used to accept that cookie alone; it now needs the
// httpOnly member seal beside it (lib/auth/member-seal.ts). A browser with the cookie, no session and no
// seal would therefore look signed in and be refused by every route.
//
// So, only in that state (session settled as "unauthenticated" + a UUID cookie), ask the server once per
// mount. A definite 401 clears the MEMBER_* cookies: the member becomes "anon" and the normal gates send
// them to sign in once. Anything else (204, 404, 409, 5xx, network) leaves everything as it is — a fault
// must never sign anyone out.
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
    if (sessionStatus !== "unauthenticated" || !UUID_RE.test(rawId) || askedRef.current) {
      return;
    }
    askedRef.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/auth/member-check", { credentials: "same-origin" });
        if (res.status !== 401) {
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
