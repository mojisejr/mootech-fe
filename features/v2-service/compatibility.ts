// features/v2-service/compatibility.ts — ดวงสมพงศ์ (compatibility) Slice 1, kind resolution.
// PURE, no React, no fetch: the SINGLE source of truth for `kind → { title, matching_type }`, shared by
// BOTH the SSR gate (pages/v2/service/compatibility/[kind].tsx) and the client hook (useCompatibility).
// One map means the gate's redirect decision and the hook's title/type can NEVER drift apart.
//
// FROZEN plan (2026-07-29): ฟีม removed BOSS/EMPLOYEE — only LOVE + FRIEND ship in Slice 1.
//   love      → "ดูดวงคู่รัก"        → matching_type LOVE
//   colleague → "ดูดวงเพื่อนร่วมงาน"  → matching_type FRIEND
//   anything else → null → caller redirects to /v2/service (NEVER silent — done-condition #1/#2, gate rule).
//
// matching_type is the value handed to V2MatchingCalculateApi(friend_id, matching_type) (#357; it was
// v1's UserMatchingCalculateApi(user_id, ...) before the lane moved off mootech-be)
// in the RESULT slice; Slice 1 holds it as the locked contract and proves it (done-condition #2 = prove the
// VALUE, not just the heading), but does NOT fire calculate (that endpoint has side effects — done-cond #9).

export const COMPATIBILITY_KINDS = ['love', 'colleague'] as const
export type CompatibilityKind = (typeof COMPATIBILITY_KINDS)[number]

// The exact strings v1's user_matching.calculate expects. FRIEND (not COLLEAGUE) — the v1 API vocabulary.
export type MatchingType = 'LOVE' | 'FRIEND'

export type CompatibilityConfig = {
  kind: CompatibilityKind
  /** จอหัวเรื่อง — verbatim Figma 480:4549 / 636:18451 */
  title: string
  /** value sent to V2MatchingCalculateApi in the result slice */
  matchingType: MatchingType
}

const CONFIG: Record<CompatibilityKind, CompatibilityConfig> = {
  love: { kind: 'love', title: 'ดูดวงคู่รัก', matchingType: 'LOVE' },
  colleague: { kind: 'colleague', title: 'ดูดวงเพื่อนร่วมงาน', matchingType: 'FRIEND' },
}

// Resolve a raw route param to its config, or null for anything unknown. The explicit allow-list check
// (not a bare `CONFIG[raw]`) closes an object-injection hole: 'constructor'/'__proto__' as [kind] must
// resolve to null, not a truthy prototype member.
export function resolveCompatibilityKind(raw: unknown): CompatibilityConfig | null {
  if (typeof raw !== 'string') return null
  if (!(COMPATIBILITY_KINDS as readonly string[]).includes(raw)) return null
  return CONFIG[raw as CompatibilityKind]
}
