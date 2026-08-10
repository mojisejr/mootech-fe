// PURE submit-gate for the v2 register profile (#233 Phase B). React-free so it is unit-testable in the
// plain-tsx lane. gender is REQUIRED: it starts null (no default) and must be actively chosen, because a
// null gender silently becomes "male" downstream (bazi normalizeGenderForYun) AND breaks the element_cycle
// join (gender is a lookup key) — 589/4,742 real users (12.4%) had no gender. A truthy-only check on a
// defaulted 'MALE' would be a no-op; this requires the field itself.
export function profileCanSubmit(input: {
  userId: string
  name: string
  birthDay: string
  gender: 'MALE' | 'FEMALE' | null
  isTimeValid: boolean
}): boolean {
  return Boolean(input.userId && input.name.trim() && input.birthDay && input.gender) && input.isTimeValid
}
