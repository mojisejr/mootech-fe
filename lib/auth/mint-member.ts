// lib/auth/mint-member.ts — turn a signed session into the MEMBER_ID cookies the app reads.
//
// Extracted from use-self-heal-identity.ts (mumate-login-identity-001 slice 5, owner
// decision 23) so the question page can mint too.
//
// §WHY THE QUESTION PAGE NEEDS IT. /api/profile, and every screen that reads it, trusts
// only the MEMBER_ID cookie, and until now only the self-heal minted it. The "yes" path
// changes who is signed in half-way — the unowned identity is sent to the question
// instead of being registered, and the self-heal is deliberately skipped on the question
// page — so the member arrived on the connected screen with a valid session and no
// MEMBER_ID, and saw "ไม่พบข้อมูลผู้ใช้" until a refresh let the late self-heal's cookie
// through. Found by the owner's first production walk, 2026-09-26.
//
// Behaviour is the self-heal's, unchanged: 10 s window, one 70 s retry, ref-code backfill, the same four cookies with the same options. For an identity that
// already has an owner, register-login LOGS IN and creates nothing.
import { CookieKey } from "@/constants/cookie-key";
import { CONFIG } from "@/constants/config";
import { UserRegisterOrLogin } from "@/constants/api/api-user-register-or-login";
import { UserGetById } from "@/constants/api/api-user-get";
import type { RegisterParams } from "./register-params";

export const MINT_CALL_TIMEOUT_MS = 10000;
// One longer retry after a first-call timeout, so a slow first request ends in a second try rather than
// in signOut (the "login ไม่สำเร็จ" symptom of 2026-09-03). It was sized for mootech-be's Render cold start
// (30-60 s). Since mumate-login-identity slice 6 the call is same-origin (/api/auth/register-login-fe) and
// since be-retirement slice 2 nothing here reaches the BE at all; the retry stays as a cheap safety net for
// a slow serverless/DB first request. Its length is unchanged on purpose — shortening it is a behaviour
// change for the login lane to decide, not a comment cleanup.
export const MINT_RETRY_TIMEOUT_MS = 70000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("member mint timed out")), ms),
    ),
  ]);
}

export const MEMBER_COOKIE_OPTS = {
  path: "/",
  maxAge: CONFIG.EXPIRED_TIME_COOKIE,
  // เอ็ม/Janjarat 2026-09-20: เดิม sameSite:true (=Strict) → เปิดลิงก์แอปจาก "ใน LINE" (cross-site
  // line.me→bazichart, top-level nav) เบราว์เซอร์ "ไม่ส่ง" cookie-mumate-id → session มีแต่ MEMBER_ID
  // หาย = identity limbo (authStatus ค้าง 'loading' → ปุ่มเสี่ยงทาย/ฟีเจอร์กดไม่ได้). Lax = ส่งบน top-level
  // GET nav ข้ามไซต์ (เคสลิงก์จาก LINE พอดี) → MEMBER_ID มา → authStatus='authed'. ปลอดภัย (identity cookie).
  sameSite: "lax" as const,
};

export type MemberCookieName =
  | CookieKey.MEMBER_ID
  | CookieKey.MEMBER_NAME
  | CookieKey.MEMBER_REFER_CODE
  | CookieKey.MEMBER_IMAGE;
export type SetMemberCookie = (name: MemberCookieName, value: string, opts: typeof MEMBER_COOKIE_OPTS) => void;

export type MintOutcome =
  /** the four cookies are set */
  | { status: "minted"; userId: string }
  /** register-login rejected the identity outright (ok:false) — the caller clears and signs out */
  | { status: "rejected" }
  /** a response without a user_id; nothing written, safe to retry later */
  | { status: "no-user" };

/** Throws on network failure or a second timeout; the caller decides what that means. */
export async function mintMemberIdentity(params: RegisterParams, setCookie: SetMemberCookie): Promise<MintOutcome> {
  const call = () =>
    UserRegisterOrLogin(
      params.id_token,
      params.image,
      params.name,
      params.refer_code,
      params.email,
      params.provider,
    );
  let result: any;
  try {
    result = await withTimeout(call(), MINT_CALL_TIMEOUT_MS);
  } catch {
    // attempt 1 timed out — one retry with the long window (see MINT_RETRY_TIMEOUT_MS)
    result = await withTimeout(call(), MINT_RETRY_TIMEOUT_MS);
  }

  if (result && result.ok === false) return { status: "rejected" };

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
        // non-fatal: never block the mint on the backfill
      }
    }
    setCookie(CookieKey.MEMBER_ID, result.user_id, MEMBER_COOKIE_OPTS);
    setCookie(CookieKey.MEMBER_NAME, result.name, MEMBER_COOKIE_OPTS);
    setCookie(CookieKey.MEMBER_REFER_CODE, referCode, MEMBER_COOKIE_OPTS);
    setCookie(CookieKey.MEMBER_IMAGE, result.picture_url, MEMBER_COOKIE_OPTS);
    return { status: "minted", userId: String(result.user_id) };
  }

  return { status: "no-user" };
}
