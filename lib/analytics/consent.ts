// Analytics consent, client side. Two facts live here and nowhere else:
//
//   1. The app's consent model is OPT-OUT. features/v2-settings/components/ConsentScreen.tsx:18 declares
//      the 'analytics' purpose with `def: true` and the copy "ปิดแล้ว: ใช้งานได้ตามปกติทุกอย่าง" — a member
//      who has never touched the switch is consenting; only an explicit `accepted: false` record withdraws.
//      Google's consent mode is therefore GRANTED by default here and DENIED only after such a record.
//      (Plan D5 first said "default denied"; that would contradict the app's own consent screen and
//      silently drop every pre-login visitor. ANALYTICS_STORAGE_DEFAULT below is the one place to flip
//      it if the owner decides otherwise — the rest of the code reads it.)
//
//   2. The member's stored choice reaches the browser as a first-party cookie, `mumate-ca`, written by
//      /api/v2/analytics/identity (from the engine's consent history) and by ConsentScreen when the switch
//      is flipped. pages/_app.tsx reads it synchronously BEFORE the GTM loader runs, so the Google tag
//      sees the right consent state on the very first page view — not one round-trip later.
//
// The cookie carries a single character, never who the person is.

export const ANALYTICS_CONSENT_COOKIE = 'mumate-ca'
export const ANALYTICS_STORAGE_DEFAULT: 'granted' | 'denied' = 'granted'

/** '1' = consented, '0' = withdrawn, null = no stored choice (falls back to the opt-out default). */
export function readAnalyticsConsentCookie(cookieHeader: string): boolean | null {
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ANALYTICS_CONSENT_COOKIE}=([01])`))
  if (!m) return null
  return m[1] === '1'
}

/** The effective answer to "may this browser send analytics right now". */
export function analyticsAllowed(cookieHeader: string): boolean {
  const stored = readAnalyticsConsentCookie(cookieHeader)
  if (stored === null) return ANALYTICS_STORAGE_DEFAULT === 'granted'
  return stored
}

export function analyticsConsentCookieValue(accepted: boolean): string {
  // One year, whole site, Lax: the choice must survive the session but never travel cross-site.
  return `${ANALYTICS_CONSENT_COOKIE}=${accepted ? '1' : '0'}; Path=/; Max-Age=31536000; SameSite=Lax`
}

/** Browser only: persist the choice and tell the Google tag about it in the same tick. */
export function applyAnalyticsConsent(accepted: boolean): void {
  if (typeof document === 'undefined') return
  document.cookie = analyticsConsentCookieValue(accepted)
  const w = window as Window & { gtag?: (...args: unknown[]) => void }
  // `gtag` is the arguments-pushing shim pages/_app.tsx defines before the loader. Consent commands
  // MUST go through it: GTM reads an Arguments object, and a plain array push is silently ignored.
  w.gtag?.('consent', 'update', { analytics_storage: accepted ? 'granted' : 'denied' })
}
