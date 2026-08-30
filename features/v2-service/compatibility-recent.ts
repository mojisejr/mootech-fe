// features/v2-service/compatibility-recent.ts — ดวงสมพงศ์ ก้อน 2G, PURE (no React, no fetch).
// The "ดูดวงสมพงศ์ล่าสุด" history list: normalise the history response into typed items and map the
// matching_type → a v2 chip label. Single source so the screen and its anchor agree.
// #357: the v2 hook now reads /api/v2/matching instead of mootech-be. This parser is UNCHANGED because
// the wire shape is deliberately identical — a bare array of { id, type, user, friend }.
//
// Rule 4 (ไม่มีข้อมูล = ไม่แสดง): a missing friend name / picture is HIDDEN by the caller — NEVER the v1
// fallback 'เพื่อน' or a default avatar. This module gives the caller undefined for absent fields (it does
// not invent them) and `undefined` for a type it won't label.

// The v1 item shape (only the fields the v2 card reads). picture/name are optional — real rows omit them.
export type RecentMatchItem = {
  /** = matching_id — the id the result route reads */
  id: string
  /** v1 matching_type; legacy history may carry BOSS/EMPLOYEE (ฟีม removed them from v2) */
  type?: string
  user?: { picture?: string | null } | null
  friend?: { name?: string | null; picture?: string | null } | null
}

// Chip label per matching_type. v2 offers only LOVE + FRIEND; BOSS/EMPLOYEE are legacy-only. We label the
// TWO v2 types and return undefined for everything else → the card HIDES the chip (rule 4: don't assert a
// type v2 doesn't support, and never crash on an unknown one — D43). ฟีม can add legacy labels here if he
// wants old BOSS/EMPLOYEE rows to read "เจ้านาย/ลูกน้อง"; today they render chip-less (surfaced in evidence).
const TYPE_LABEL: Record<string, string> = {
  LOVE: 'คู่รัก',
  FRIEND: 'เพื่อนร่วมงาน',
}

export function matchTypeLabel(type: string | undefined): string | undefined {
  if (!type) return undefined
  return TYPE_LABEL[type]
}

// Normalise whatever the history endpoint returns into a clean array. Both lanes return the array directly
// on success, or { error } / a non-array on failure. Anything not an array (error object / null / unexpected) → [] with ok=false so the
// screen shows an honest fallback, never an infinite spinner and never a fabricated row.
export type RecentParse = { ok: boolean; items: RecentMatchItem[] }

export function parseRecentMatches(resp: unknown): RecentParse {
  if (Array.isArray(resp)) {
    // keep only rows that at least have an id (the click target); drop malformed rows silently rather than
    // render a card that navigates nowhere.
    const items = resp.filter((r): r is RecentMatchItem => !!r && typeof (r as RecentMatchItem).id === 'string')
    return { ok: true, items }
  }
  return { ok: false, items: [] }
}

// The card's headline. "คุณ & <friend name>" when the name is present; just "คุณ" when it's absent —
// NEVER v1's fabricated "คุณ & เพื่อน" (rule 4).
export function recentCardTitle(friendName: string | null | undefined): string {
  const name = (friendName ?? '').trim()
  // MUT mut-fake-friend-name: return `คุณ & เพื่อน` on absent name (v1's rule-4 bug) → rule-4 check CAUGHT.
  return name ? `คุณ & ${name}` : 'คุณ'
}
