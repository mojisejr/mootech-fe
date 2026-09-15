// The ONLY list of events this app may send to Google Analytics, and the ONLY list of parameter keys
// each may carry. Everything analytics goes through lib/analytics/track.ts, which refuses anything not
// written here. (CIEL mootech-ga4-instrumentation-001, decision D5: one door for events.)
//
// 🔴 WHY A LIST AND NOT A CONVENTION. The data GA must never see is the data this app is made of —
// birth date and time, the element and zodiac derived from them, LINE/Google/Facebook identities,
// names, emails, phones, the raw member id. A convention ("just don't send those") is one refactor
// away from being forgotten. A list means the NEXT event someone adds has to be written down here,
// and scripts/analytics-track.test.ts reddens on any key that smells like identity or birth data even
// if it is added to this list by mistake.
//
// Names follow GA4's recommended events where one exists (login, sign_up) so GA's own reports light up
// without configuration. Custom names are snake_case.

export const ANALYTICS_EVENTS = {
  /** A member id has just been established in this browser (register-login round-trip landed). */
  login: ['method'],
  /** First-run completed for this account — the v2 "member" definition (user.onboarded_at written). */
  sign_up: ['method'],
  /** The PDPA analytics switch changed. Carries only the new state, never who changed it. */
  consent_update: ['analytics'],
} as const satisfies Record<string, readonly string[]>

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENTS

/** Parameter keys that must never travel, whatever list they appear in. Matched case-insensitively
 *  against the key name. Kept broad on purpose: a false refusal costs one rename, a false pass costs
 *  a PDPA incident. */
export const FORBIDDEN_PARAM_KEY = /birth|dob|bazi|element|zodiac|animal|email|mail|phone|tel|line|name|uuid|member_id|memberid|user_id|userid|token|address|ip$/i

/** Values a parameter may hold. Objects and arrays are refused so nothing structured leaks by accident. */
export type AnalyticsParamValue = string | number | boolean
