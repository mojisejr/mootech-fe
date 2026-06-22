import { useSession } from "next-auth/react";
import { useCookies } from "react-cookie";
import { CookieKey } from "@/constants/cookie-key";
import { resolveAuth, type AuthStatus } from "./resolve-auth";

// Single source of truth for client identity.
//
// Why this exists: this app never stores user_id in the NextAuth session — it
// lives in the `cookie-mumate-id` cookie, which is only written AFTER the
// register-login round-trip completes. On a hard refresh / direct navigation the
// cookie can be momentarily absent while the session is still hydrating, which
// caused pages to fire `UserGetById(undefined)` (→ /api/user?user_id=undefined
// 400), bounce between guards, and flash placeholder avatars.
//
// The decision logic (loading-never-anon, uuid validation) lives in the pure,
// unit-tested `resolveAuth()` (lib/auth/resolve-auth.ts). This hook only wires the
// NextAuth session status and the id cookie into it.

export type { AuthStatus } from "./resolve-auth";

export interface CurrentUser {
  userId: string;
  status: AuthStatus;
}

export function useCurrentUser(): CurrentUser {
  const { status: sessionStatus } = useSession();
  const [cookies] = useCookies([CookieKey.MEMBER_ID]);

  const rawId = (cookies[CookieKey.MEMBER_ID] as string) || "";
  return resolveAuth(sessionStatus, rawId);
}
