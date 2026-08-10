// The PDPA policy version recorded with each consent (#233). Server-owned — the client never sends
// it; the onboarding BFF stamps this so a row can always be traced to the exact policy text accepted.
// Bump when the policy wording changes so consent history stays auditable.
export const PDPA_POLICY_VERSION = 'v1'
