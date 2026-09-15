// Server only. Turns a member id into the `user_id` GA receives. (CIEL mootech-ga4-instrumentation-001, D2.)
//
// GA needs ONE stable string per person so that a phone, a laptop and the installed PWA count as one
// active user. It must not be the member id itself — GA data is exportable, shared with a vendor, and
// the raw id opens every /api/user?user_id= door in this app. So: HMAC-SHA256 over the member id with a
// key that lives only in the server environment. Same person → same string; string → person only with
// the key, which never leaves Vercel.
//
// 🔴 NO KEY, NO ID. If ANALYTICS_USER_ID_KEY is unset this returns null and the app sends no user_id at
// all. It never falls back to the raw id, a weaker hash, or a hard-coded key: every one of those would
// be a quiet identity leak that looks like success in the dashboard.
import { createHmac } from 'node:crypto'

export const ANALYTICS_USER_ID_KEY_ENV = 'ANALYTICS_USER_ID_KEY'

/** 32 hex characters — long enough to never collide across our members, short enough to read in DebugView. */
export function analyticsUserId(memberId: string, key: string | undefined = process.env[ANALYTICS_USER_ID_KEY_ENV]): string | null {
  if (!key || key.length < 16) return null
  if (!memberId) return null
  return createHmac('sha256', key).update(memberId).digest('hex').slice(0, 32)
}
