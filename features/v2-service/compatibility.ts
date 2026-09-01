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
 * 🔴 THE PICKER IS GONE (#585). The colleague screen used to make the user choose ONE of these three, and
 * ฟีม rejected that with "มันผิดเลยครับ": the engine returns ALL THREE readings per person in a single
 * /api/bazi/work call, so asking for a choice threw away two readings that were already computed.
 *
 * The DIRECTION table below is kept, not deleted, for two reasons that outlive the picker:
 *   1. `user_matching` rows written before #585 still carry BOSS / EMPLOYEE / FRIEND, and the result
 *      screen still has to map them back to the colleague kind (KIND_OF_MATCHING_TYPE below).
 *   2. The direction is measured, not guessed, and a future reader mapping engine roles onto a screen
 *      needs it. Losing it would cost another round of posting the same two people three times.
 *
 * Measured against the engine 2026-09-01 by posting the same two people three times to
 * /api/bazi/pair-match and reading back `ourLabel` / `partnerLabel`. The value names describe THE OTHER
 * PERSON, not the caller:
 *   BOSS      → bazi 'boss'         ourLabel "เรา (ลูกน้อง)"  partnerLabel "เจ้านาย"   ⇒ the OTHER is my boss
 *   EMPLOYEE  → bazi 'subordinate'  ourLabel "เรา"            partnerLabel "ลูกน้อง"   ⇒ the OTHER is my subordinate
 *   FRIEND    → bazi 'partner'      ourLabel "เรา"            partnerLabel "หุ้นส่วน"  ⇒ the OTHER is my partner
 * (mapping lives in mootech-be src/matching/bazi/bazi-pair.mapper.ts:35-46)
 *
 * A label that reads the direction backwards would send the engine the mirror image of what the user
 * meant, and the numbers would look perfectly plausible.
 */
export const WORK_MATCHING_TYPES = ['BOSS', 'FRIEND', 'EMPLOYEE'] as const

export type CompatibilityConfig = {
  kind: CompatibilityKind
  /** จอหัวเรื่อง — verbatim Figma 480:4549 / 636:18451 */
  title: string
  /** value sent to V2MatchingCalculateApi in the single-pair lane. Fixed per screen since #585 removed
   *  the role picker — the screen no longer changes it. */
  matchingType: MatchingType
  /** the empty-state wording of the person-2 picker. #569: the love screen used to borrow the colleague
   *  screen's "เลือกเพื่อน / คู่รัก", which offered a choice it does not have. */
  pickLabel: string
}

const CONFIG: Record<CompatibilityKind, CompatibilityConfig> = {
  love: { kind: 'love', title: 'ดูดวงคู่รัก', matchingType: 'LOVE', pickLabel: 'เลือกคู่รัก' },
  colleague: {
    kind: 'colleague',
    title: 'ดูดวงเพื่อนร่วมงาน',
    // the widest single-pair reading, and what the screen sent before #585 removed the choice
    matchingType: 'FRIEND',
    pickLabel: 'เลือกเพื่อนร่วมงาน',
  },
}

// The INVERSE map: which screen does a stored matching_type belong to? (#571 — the result screen's back
// button had `/v2/service` hardcoded because nothing on the page knew where the calculation came from.)
//
// 🔴 It lives HERE, beside CONFIG, and not in the result seam, because this file's header claims to be the
// single source of truth for kind ↔ matching_type. A second table elsewhere is a second thing to update when
// the roles change, and #569 just changed them.
//
// All three work roles answer 'colleague': after #569 the colleague screen is where a user picks BOSS or
// EMPLOYEE (WORK_MATCHING_TYPES above), so a row carrying either was created on that screen and belongs back on
// it. That is a change from what compatibility-recent.ts:21-24 still assumes ("BOSS/EMPLOYEE are legacy-only")
// — true when it was written, not true since #569 merged.
//
// Anything else — a value from a future role, a malformed row, a null column — is `null`, and the caller
// sends the user to the hub. NEVER guessed as 'love': a wrong guess lands the user on a screen they did not
// come from and looks like the app losing their place, which is the bug this fixes, mirrored.
const KIND_OF_MATCHING_TYPE: Record<MatchingType, CompatibilityKind> = {
  LOVE: 'love',
  BOSS: 'colleague',
  EMPLOYEE: 'colleague',
  FRIEND: 'colleague',
}

export function compatibilityKindOfMatchingType(type: unknown): CompatibilityKind | null {
  if (typeof type !== 'string') return null
  // allow-list check for the same object-injection reason as resolveCompatibilityKind below
  if (!Object.prototype.hasOwnProperty.call(KIND_OF_MATCHING_TYPE, type)) return null
  return KIND_OF_MATCHING_TYPE[type as MatchingType]
}

// Resolve a raw route param to its config, or null for anything unknown. The explicit allow-list check
// (not a bare `CONFIG[raw]`) closes an object-injection hole: 'constructor'/'__proto__' as [kind] must
// resolve to null, not a truthy prototype member.
export function resolveCompatibilityKind(raw: unknown): CompatibilityConfig | null {
  if (typeof raw !== 'string') return null
  if (!(COMPATIBILITY_KINDS as readonly string[]).includes(raw)) return null
  return CONFIG[raw as CompatibilityKind]
}
