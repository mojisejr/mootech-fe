import { PDPA_POLICY_VERSION } from '@/constants/pdpa'

// The v2 first-run onboarded gate (#233). Called in useV2Home AFTER the user row has settled and its
// chart is confirmed: a charted user whose onboarded_at is empty has not finished first-run → route there.
//
// 🔴 CONTRACT DEPENDENCY: this reads onboarded_at off the GET /user response (pages/api/user.ts, raw
// SELECT *). If that endpoint ever returns a FIELD PROJECTION that omits the column, onboarded_at becomes
// undefined for everyone → needsFirstRun() returns true → even long-onboarded users get bounced into
// first-run (this is exactly the stale-fixture class that broke the home harness on #233). The test pins
// it: an onboarded row must NOT need first-run, and a row missing the field is treated as not-onboarded.
export function needsFirstRun(u: { onboarded_at?: string | null }): boolean {
  return !u.onboarded_at
}

// CIEL mumate-pdpa-reconsent-001 — the updated-policy gate, checked right AFTER needsFirstRun (a member still in
// first-run accepts the current policy there). `policyConsent` comes off the same GET /user row:
//   null / missing  → NOT DETERMINED (read failed, or an older response) → let the member through, never lock out
//   { version }     → ask once when it differs from the current version (including "no row at all")
export function needsReconsent(
  u: { policyConsent?: { version: string | null } | null },
  current: string = PDPA_POLICY_VERSION,
): boolean {
  if (!u.policyConsent) return false
  return u.policyConsent.version !== current
}

/** Where /v2/policy-update may send the member back to: a /v2 path only (never another origin), else /v2. */
export function safeNext(raw: unknown): string {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (typeof v !== 'string') return '/v2'
  return /^\/v2(?:[/?#]|$)/.test(v) && !v.startsWith('//') ? v : '/v2'
}
