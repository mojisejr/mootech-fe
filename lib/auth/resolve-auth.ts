// Pure identity-resolution logic for useCurrentUser (#mootech-identity-guard-sweep).
//
// Extracted from use-current-user.ts so it can be unit-tested HEADLESS (no React /
// next-auth imports): see scripts/use-current-user.test.ts. The hook is now a thin
// wrapper that reads session status + the id cookie and delegates to resolveAuth().
//
// THE RULE (do not weaken): when the NextAuth session is valid but the id cookie
// (`cookie-mumate-id` / MEMBER_ID) hasn't landed yet, report "loading" — NEVER "anon".
// Reporting "anon" too eagerly is what bounced logged-in users to /login. We declare
// "anon" only when there is genuinely no session AND no id cookie.

export type AuthStatus = "loading" | "authed" | "anon";
// NextAuth's useSession().status values.
export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export interface ResolvedAuth {
  userId: string;
  status: AuthStatus;
}

// Internal user_id is always a DB-generated uuid (@PrimaryGeneratedColumn('uuid')).
// Older builds briefly stored the OAuth access token (ya29...) in the MEMBER_ID cookie,
// which fired /api/user?user_id=ya29... (400) and overflowed log_calculate (500).
// Treat any non-uuid cookie value as "not resolved yet" so we never fetch with garbage.
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveAuth(
  sessionStatus: SessionStatus,
  rawCookieId: string | null | undefined,
): ResolvedAuth {
  const raw = (rawCookieId as string) || "";
  const userId = UUID_RE.test(raw) ? raw : "";

  let status: AuthStatus;
  if (userId) {
    // Resolved identity — safe to fetch, regardless of session hydration timing.
    status = "authed";
  } else if (sessionStatus === "loading" || sessionStatus === "authenticated") {
    // NextAuth still resolving OR session valid but the id cookie hasn't been
    // written yet (register-login in flight). Wait — never fetch empty, never bounce.
    status = "loading";
  } else {
    // No session AND no id cookie → truly anonymous; the only safe time to /login.
    status = "anon";
  }

  return { userId, status };
}
