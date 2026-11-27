// แผนชีวิตปีใหม่ 2570 — come back to the page after LINE login, and land on the plan after paying. The OAuth
// callback stays /v2 (features/v2-taisui/return.ts says why), so the page leaves a marker and /v2 sends the
// member back once (pages/v2/index.tsx). The marker and the typed birth are two items because two pages
// read them: /v2 takes the marker, this page takes the birth. Without the birth a visitor who typed it on
// the ad landing page would lose it across the login round trip. localStorage, not sessionStorage: the
// trip leaves the site. Thirty minutes, one use, and nothing in them but a birth the visitor typed.
export const NEWYEAR_PATH = '/v2/newyear'
const RETURN_KEY = 'newyear:return'
const BIRTH_KEY = 'newyear:birth'
const AFTER_PAY_KEY = 'newyear:after-pay'
const MAX_AGE_MS = 30 * 60 * 1000
const DOB_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export type NewYearBirth = { date: string; time: string | null; gender: 'male' | 'female' }

function put(key: string, value: string): void {
  try { window.localStorage.setItem(key, value) } catch { /* storage off: the member lands on home instead */ }
}

function take(key: string, now: number): Record<string, unknown> | null {
  let raw: string | null = null
  try { raw = window.localStorage.getItem(key); window.localStorage.removeItem(key) } catch { return null }
  if (raw === null) return null
  try {
    const m = JSON.parse(raw) as { at?: unknown }
    return typeof m.at === 'number' && now >= m.at && now - m.at <= MAX_AGE_MS ? m : null
  } catch {
    return null
  }
}

/** Remember where to come back to. Call right before the login starts. */
export function leaveNewYearReturn(now: number = Date.now()): void {
  put(RETURN_KEY, JSON.stringify({ at: now }))
}

/** True without taking — the page shows its loading state instead of the form while this is set. */
export function hasNewYearReturn(): boolean {
  try { return window.localStorage.getItem(RETURN_KEY) !== null } catch { return false }
}

/** '/v2/newyear' when a return is pending (one use, only while fresh), else null. */
export function takeNewYearReturn(now: number = Date.now()): string | null {
  return take(RETURN_KEY, now) ? NEWYEAR_PATH : null
}

/** Keep a typed birth for the page to show again after login or checkout. */
export function leaveNewYearBirth(birth: NewYearBirth, now: number = Date.now()): void {
  put(BIRTH_KEY, JSON.stringify({ at: now, birth }))
}

/** The shape the route accepts (lib/taisui/server.ts parseBirth): a Gregorian date, a time or null, a gender. */
function isBirth(b: unknown): b is NewYearBirth {
  if (!b || typeof b !== 'object') return false
  const { date, time, gender } = b as Record<string, unknown>
  if (typeof date !== 'string' || !DOB_RE.test(date)) return false
  const year = +date.slice(0, 4)
  if (year < 1900 || year > new Date().getFullYear()) return false
  if (time !== null && (typeof time !== 'string' || !TIME_RE.test(time))) return false
  return gender === 'male' || gender === 'female'
}

/** The typed birth to show again, or null. One use; a stored birth the route would refuse is dropped here too. */
export function takeNewYearBirth(now: number = Date.now()): NewYearBirth | null {
  const b = take(BIRTH_KEY, now)?.birth
  return isBirth(b) ? b : null
}

/** Set when the visitor leaves for checkout from the plan; the payment success screen reads it. */
export function leaveNewYearAfterPay(now: number = Date.now()): void {
  put(AFTER_PAY_KEY, JSON.stringify({ at: now }))
}

/** True once, within the thirty minutes after the visitor left for checkout. */
export function takeNewYearAfterPay(now: number = Date.now()): boolean {
  return take(AFTER_PAY_KEY, now) !== null
}
