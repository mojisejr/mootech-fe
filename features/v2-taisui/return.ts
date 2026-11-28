// ปีชง 2570 — come back to the page after LINE login. The OAuth callback stays /v2 (changing it broke LINE
// login on 2026-09-28, see useV2Login), so the page leaves a marker and /v2 home sends the member back once
// their chart exists — the same pattern as the course redeem link (COURSE_REDEEM_KEY).
export const TAISUI_RETURN_KEY = 'taisui:return'
const MAX_AGE_MS = 30 * 60 * 1000
const REF_RE = /^MUMATE\d{3,8}$/

// Revision 0.13: a cookie beside the marker lets the /v2 server draw the return screen from the first
// frame, so home never shows. It carries no member data; Lax is enough for LINE's top-level redirect.
export const TAISUI_RETURN_COOKIE = 'taisui_return'

function setReturnCookie(on: boolean): void {
  try {
    const secure = window.location?.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${TAISUI_RETURN_COOKIE}=${on ? '1' : ''}; Path=/; Max-Age=${on ? MAX_AGE_MS / 1000 : 0}; SameSite=Lax${secure}`
  } catch { /* no cookie: home shows its loading screen after it mounts instead */ }
}

/** Drop the server-side hint once the return is done or abandoned. */
export function clearReturnCookie(): void { setReturnCookie(false) }

export function leaveReturnMarker(ref: string | null, now: number = Date.now()): void {
  try {
    window.localStorage.setItem(TAISUI_RETURN_KEY, JSON.stringify({ at: now, ...(ref && REF_RE.test(ref) ? { ref } : {}) }))
  } catch { /* storage off: the member lands on home instead */ }
  setReturnCookie(true)
}

/** The path to return to, or null. Takes the marker (one use) only when it is fresh. */
export function takeReturnPath(now: number = Date.now()): string | null {
  let raw: string | null = null
  try { raw = window.localStorage.getItem(TAISUI_RETURN_KEY) } catch { return null }
  clearReturnCookie()
  if (!raw) return null
  try { window.localStorage.removeItem(TAISUI_RETURN_KEY) } catch { /* ignore */ }
  try {
    const m = JSON.parse(raw) as { at?: unknown; ref?: unknown }
    if (typeof m.at !== 'number' || now - m.at > MAX_AGE_MS || now < m.at) return null
    return typeof m.ref === 'string' && REF_RE.test(m.ref) ? `/taisui-2570?ref=${m.ref}` : '/taisui-2570'
  } catch {
    return null
  }
}

/** The server-side hint alone (storage may be off). */
export function hasReturnCookie(): boolean {
  try { return document.cookie.split(';').some((c) => c.trim() === `${TAISUI_RETURN_COOKIE}=1`) } catch { return false }
}

/** Revision 0.15: a member on the way back to the page, chart or not. Home lets the page take the birth
 *  instead of sending them to registration. */
export function isReturningToTaisui(): boolean { return hasReturnMarker() || hasReturnCookie() }

/** Peek without taking, for the home page to wait until the member's chart exists. */
export function hasReturnMarker(): boolean {
  try { return Boolean(window.localStorage.getItem(TAISUI_RETURN_KEY)) } catch { return false }
}

// Revision 0.13: a login started on the page, so the page may say "already claimed" once when it is back.
export const TAISUI_QI_ASK_KEY = 'taisui:qi-ask'

export function leaveQiAsk(now: number = Date.now()): void {
  try { window.localStorage.setItem(TAISUI_QI_ASK_KEY, String(now)) } catch { /* storage off: the page stays quiet */ }
}

/** True once, within 30 minutes of a login started on the page; the marker is taken either way. */
export function takeQiAsk(now: number = Date.now()): boolean {
  let raw: string | null = null
  try { raw = window.localStorage.getItem(TAISUI_QI_ASK_KEY); window.localStorage.removeItem(TAISUI_QI_ASK_KEY) } catch { return false }
  const at = Number(raw)
  return raw !== null && Number.isFinite(at) && now >= at && now - at <= MAX_AGE_MS
}
