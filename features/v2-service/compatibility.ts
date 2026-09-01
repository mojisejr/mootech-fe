// features/v2-service/compatibility.ts — ดวงสมพงศ์ (compatibility) Slice 1, kind resolution.
// PURE, no React, no fetch: the SINGLE source of truth for `kind → { title, matching_type }`, shared by
// BOTH the SSR gate (pages/v2/service/compatibility/[kind].tsx) and the client hook (useCompatibility).
// One map means the gate's redirect decision and the hook's title/type can NEVER drift apart.
//
// FROZEN plan (2026-07-29): ฟีม removed BOSS/EMPLOYEE — only LOVE + FRIEND ship in Slice 1.
// 🔴 UNFROZEN 2026-09-01 (#569). ฟีม withdrew that decision after the design team asked for the three
// work roles back. The routes are UNCHANGED — still only `love` and `colleague` — because ฟีม's wording was
// "ต้องเลือกได้ว่าจะดู … ก่อนกดจะดูผลลัพธ์", i.e. a choice made ON the colleague screen, not three URLs.
// Keeping two routes also keeps the hub's two links working (services.ts:48-49) and keeps a shared
// /colleague link meaningful.
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
// All four values are accepted by the route (pages/api/v2/matching/calculate.ts:31-32) and were only ever
// closed off here.
export type MatchingType = 'LOVE' | 'BOSS' | 'EMPLOYEE' | 'FRIEND'

/**
 * The three work roles the colleague screen offers.
 *
 * 🔴 READ THE DIRECTION BEFORE EDITING. The value names describe THE OTHER PERSON, not the caller. Measured
 * against the engine on 2026-09-01 by posting the same two people three times to
 * /api/bazi/pair-match and reading back `ourLabel` / `partnerLabel`:
 *   BOSS      → bazi 'boss'         ourLabel "เรา (ลูกน้อง)"  partnerLabel "เจ้านาย"   ⇒ the OTHER is my boss
 *   EMPLOYEE  → bazi 'subordinate'  ourLabel "เรา"            partnerLabel "ลูกน้อง"   ⇒ the OTHER is my subordinate
 *   FRIEND    → bazi 'partner'      ourLabel "เรา"            partnerLabel "หุ้นส่วน"  ⇒ the OTHER is my partner
 * (mapping lives in mootech-be src/matching/bazi/bazi-pair.mapper.ts:35-46)
 *
 * The three are NOT cosmetic: same two people, different roles → different dimension keys, different
 * percentages and a different overall grade. Full output in mojisejr/mootech-fe#569. A label that reads
 * the direction backwards would send the engine the mirror image of what the user meant, and the numbers
 * would look perfectly plausible — which is why the direction is written here and not left to the screen.
 */
export type ColleagueRole = { value: MatchingType; label: string }
export const COLLEAGUE_ROLES: readonly ColleagueRole[] = [
  { value: 'BOSS', label: 'เจ้านาย' },
  { value: 'FRIEND', label: 'หุ้นส่วน / เพื่อน' },
  { value: 'EMPLOYEE', label: 'ลูกน้อง' },
] as const

/** The role the colleague screen starts on — the widest reading, and the value the screen used to send. */
export const DEFAULT_COLLEAGUE_ROLE: MatchingType = 'FRIEND'

export type CompatibilityConfig = {
  kind: CompatibilityKind
  /** จอหัวเรื่อง — verbatim Figma 480:4549 / 636:18451 */
  title: string
  /** value sent to V2MatchingCalculateApi in the result slice — for `colleague` this is only the DEFAULT;
   *  the screen may change it to another COLLEAGUE_ROLES value before the calculation fires. */
  matchingType: MatchingType
  /** the empty-state wording of the person-2 picker. #569: the love screen used to borrow the colleague
   *  screen's "เลือกเพื่อน / คู่รัก", which offered a choice it does not have. */
  pickLabel: string
  /** true when this screen lets the user pick which work role they are looking at */
  hasRoles: boolean
}

const CONFIG: Record<CompatibilityKind, CompatibilityConfig> = {
  love: { kind: 'love', title: 'ดูดวงคู่รัก', matchingType: 'LOVE', pickLabel: 'เลือกคู่รัก', hasRoles: false },
  colleague: {
    kind: 'colleague',
    title: 'ดูดวงเพื่อนร่วมงาน',
    matchingType: DEFAULT_COLLEAGUE_ROLE,
    pickLabel: 'เลือกเพื่อนร่วมงาน',
    hasRoles: true,
  },
}

// Resolve a raw route param to its config, or null for anything unknown. The explicit allow-list check
// (not a bare `CONFIG[raw]`) closes an object-injection hole: 'constructor'/'__proto__' as [kind] must
// resolve to null, not a truthy prototype member.
export function resolveCompatibilityKind(raw: unknown): CompatibilityConfig | null {
  if (typeof raw !== 'string') return null
  if (!(COMPATIBILITY_KINDS as readonly string[]).includes(raw)) return null
  return CONFIG[raw as CompatibilityKind]
}
