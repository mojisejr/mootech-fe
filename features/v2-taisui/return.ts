// ปีชง 2570 — come back to the page after LINE login. The OAuth callback stays /v2 (changing it broke LINE
// login on 2026-09-28, see useV2Login), so the page leaves a marker and /v2 home sends the member back once
// their chart exists — the same pattern as the course redeem link (COURSE_REDEEM_KEY).
export const TAISUI_RETURN_KEY = 'taisui:return'
const MAX_AGE_MS = 30 * 60 * 1000
const REF_RE = /^MUMATE\d{3,8}$/

export function leaveReturnMarker(ref: string | null, now: number = Date.now()): void {
  try {
    window.localStorage.setItem(TAISUI_RETURN_KEY, JSON.stringify({ at: now, ...(ref && REF_RE.test(ref) ? { ref } : {}) }))
  } catch { /* storage off: the member lands on home instead */ }
}

/** The path to return to, or null. Takes the marker (one use) only when it is fresh. */
export function takeReturnPath(now: number = Date.now()): string | null {
  let raw: string | null = null
  try { raw = window.localStorage.getItem(TAISUI_RETURN_KEY) } catch { return null }
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

/** Peek without taking, for the home page to wait until the member's chart exists. */
export function hasReturnMarker(): boolean {
  try { return Boolean(window.localStorage.getItem(TAISUI_RETURN_KEY)) } catch { return false }
}
