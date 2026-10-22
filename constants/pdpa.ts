import { PRIVACY_POLICY } from './privacy-policy'

// The PDPA policy version recorded with each consent (#233). Server-owned — the client never sends
// it; the onboarding BFF stamps this so a row can always be traced to the exact policy text accepted.
// It now comes from the one policy file (constants/privacy-policy.ts, CIEL mumate-pdpa-reconsent-001):
// raise the version THERE when the policy's substance changes, and every member whose latest accepted
// version differs is asked to accept the updated policy once (lib/home/first-run-gate.ts needsReconsent).
export const PDPA_POLICY_VERSION: string = PRIVACY_POLICY.version
