import { useSession } from "next-auth/react";
import { useCookies } from "react-cookie";
import { CookieKey } from "@/constants/cookie-key";

// Single source of truth for client identity.
//
// Why this exists: this app never stores user_id in the NextAuth session — it
// lives in the `cookie-mumate-id` cookie, which is only written AFTER the
// register-login round-trip completes. On a hard refresh / direct navigation the
// cookie can be momentarily absent while the session is still hydrating, which
// caused pages to fire `UserGetById(undefined)` (→ /api/user?user_id=undefined
// 400), bounce between guards, and flash placeholder avatars.
//
// The fix: collapse identity into ONE deterministic status. Never report
// `authed` without a real userId, and — critically — when the session is valid
// but the id cookie hasn't landed yet, report `loading` (NOT `anon`) so callers
// wait instead of redirecting. We only declare `anon` when there is genuinely no
// session AND no cookie, which is the only safe time to send a user to /login.

export type AuthStatus = "loading" | "authed" | "anon";

export interface CurrentUser {
  userId: string;
  status: AuthStatus;
}

// Internal user_id is always a DB-generated uuid (@PrimaryGeneratedColumn('uuid')).
// Older builds briefly stored the OAuth access token (ya29...) in the MEMBER_ID cookie,
// which would fire /api/user?user_id=ya29... (400) and overflow log_calculate (500).
// Treat any non-uuid cookie value as "not resolved yet" so we never fetch with garbage;
// register-login on "/" overwrites it with the real uuid.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useCurrentUser(): CurrentUser {
  const { status: sessionStatus } = useSession();
  const [cookies] = useCookies([CookieKey.MEMBER_ID]);

  const rawId = (cookies[CookieKey.MEMBER_ID] as string) || "";
  const userId = UUID_RE.test(rawId) ? rawId : "";

  let status: AuthStatus;
  if (userId) {
    // We have a resolved identity — safe to fetch, regardless of session
    // hydration timing.
    status = "authed";
  } else if (sessionStatus === "loading" || sessionStatus === "authenticated") {
    // Either NextAuth is still resolving, OR the session is valid but the
    // id cookie hasn't been written yet (register-login in flight).
    // In BOTH cases we wait — we must not fetch with an empty id and must not
    // redirect (that is what caused the bounce loop).
    status = "loading";
  } else {
    // sessionStatus === "unauthenticated" AND no id cookie → truly anonymous.
    status = "anon";
  }

  return { userId, status };
}
