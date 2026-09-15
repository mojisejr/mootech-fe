// The one door every analytics event walks through. (CIEL mootech-ga4-instrumentation-001, D5.)
//
//   track('login', { method: 'line' })
//
// Refuses, in this order: an event not in ANALYTICS_EVENTS; a parameter key not declared for that
// event; a key that matches FORBIDDEN_PARAM_KEY even if declared; a non-scalar value; and finally a
// browser whose stored consent says no. Only then does it push to window.dataLayer, where the GTM
// container turns it into a GA4 hit.
//
// It never throws in production — an analytics mistake must not take a screen down — but it returns
// WHY it refused so the tests can assert on the reason rather than on silence. In development a
// refusal also logs, so the mistake is seen once by the person who made it.
//
// ⛔ NOT for the payment lane. /v2/shop/checkout, /qrcode and /result run under a CSP that shuts GTM out
// (middleware.ts, #493); nothing there imports this module, and scripts/analytics-track.test.ts reads the
// tree to keep it that way.
import { ANALYTICS_EVENTS, FORBIDDEN_PARAM_KEY, type AnalyticsEventName, type AnalyticsParamValue } from './events'
import { analyticsAllowed } from './consent'

export type TrackResult =
  | 'pushed'
  | 'no-window'
  | 'blocked-consent'
  | 'rejected-event'
  | 'rejected-key'
  | 'rejected-value'

export type TrackParams = Record<string, AnalyticsParamValue>

type DataLayerWindow = Window & { dataLayer?: unknown[] }

/** Pure validation, shared by track() and the tests: null = fine, otherwise the refusal. */
export function validateEvent(
  name: string,
  params: Record<string, unknown>,
  // Injectable so the test can hand in a POISONED list (a forbidden key written into the allowlist) and
  // prove the forbidden pattern still refuses it. Production always uses the real list.
  events: Record<string, readonly string[]> = ANALYTICS_EVENTS,
): Exclude<TrackResult, 'pushed' | 'no-window' | 'blocked-consent'> | null {
  if (!Object.prototype.hasOwnProperty.call(events, name)) return 'rejected-event'
  const allowed: readonly string[] = events[name as AnalyticsEventName]
  for (const [key, value] of Object.entries(params)) {
    if (!allowed.includes(key) || FORBIDDEN_PARAM_KEY.test(key)) return 'rejected-key'
    const t = typeof value
    if (t !== 'string' && t !== 'number' && t !== 'boolean') return 'rejected-value'
    if (t === 'string' && (value as string).length > 100) return 'rejected-value'
  }
  return null
}

export function track(name: AnalyticsEventName, params: TrackParams = {}): TrackResult {
  const refusal = validateEvent(name, params)
  if (refusal) {
    if (process.env.NODE_ENV !== 'production') console.warn(`[analytics] ${refusal}: ${name}`, params)
    return refusal
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') return 'no-window'
  if (!analyticsAllowed(document.cookie)) return 'blocked-consent'
  const w = window as DataLayerWindow
  w.dataLayer = w.dataLayer ?? []
  w.dataLayer.push({ event: name, ...params })
  return 'pushed'
}
