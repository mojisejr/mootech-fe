// features/v2-service/work-comparison.ts — the colleague lane's read model (mootech-fe#585).
//
// Three jobs, all pure, so each one has teeth in scripts/work-comparison.test.ts:
//   ① trim      bazi's POST /api/bazi/work answers ~7MB (self 2.3 + candidates 4.5 + comparison 0.2).
//               The screen needs `comparison` only. The cut happens HERE, on the server, so the browser
//               never receives the other 97%. DoD: "เบราว์เซอร์ไม่เคยได้รับก้อน 7MB".
//   ② rank      the order comes from `comparison.ranking` — an array of INDEXES into `candidates`.
//               DoD: "แสดงอันดับจาก comparison.ranking ❌ ไม่ใช่เรียงเอง". Re-sorting by rankScore would
//               agree with it on today's sample and diverge silently the day the engine's tie-break or
//               its scoring changes, which is exactly the failure nobody would see.
//   ③ roles     three per person: เจ้านาย / ลูกน้อง / หุ้นส่วน. ฟีม decided 2026-09-01 (ทาง ก) that the
//               HEADING is the engine's own `perspective` string, not Figma's การงาน/ธุรกิจ/การเงิน —
//               those name a different axis (a domain of life, not a direction of a relationship), and
//               pasting them over this content puts "การเงิน" above a paragraph about a subordinate.
//
// 🔴 WHY roles CANNOT BE READ BY POSITION ALONE. bazi builds the array with
// `for (const r of [boss, sub, partner]) if (r) readings.push(r)`
// (bazi-sft-dataset `src/lib/bazi/pair-matching.ts:195`, branch `pdf-dev` — that repo's `main` is 3 months
// stale and does not contain the file). A role whose reading is missing is SKIPPED, not pushed as null,
// so a short array shifts every later role one seat up. มุน measured the source tables at 120/120 pairs
// for all three roles, so it does not fire today — but "does not fire today" is not a contract, and the
// symptom if it ever does would be a correct-looking screen with the wrong heading over each paragraph.
// ⇒ read the count, and say which seat is empty. Never renumber.

export type WorkRole = { perspective: string; stageName?: string; narrative?: string }

export type WorkCandidate = {
  index: number
  rankScore?: number
  grade?: string
  ratingText?: string
  emoji?: string
  profile?: Record<string, unknown>
  elementInteraction?: Record<string, unknown>
  roles: WorkRole[]
}

export type WorkComparison = {
  self?: Record<string, unknown>
  ranking: number[]
  candidates: WorkCandidate[]
  sisingReference?: Record<string, unknown>
}

/** How many roles the engine promises per person. */
export const WORK_ROLE_COUNT = 3

/**
 * ① Keep `comparison`, drop everything else.
 *
 * Returns null when the body has no comparison block at all — the caller must treat that as a failed
 * calculation, NOT as an empty result, because "no comparison" and "comparison with zero candidates" are
 * different events and only the second one is a thing the screen can render.
 */
export function trimWorkResponse(body: unknown): WorkComparison | null {
  if (!body || typeof body !== 'object') return null
  const raw = (body as { comparison?: unknown }).comparison
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Partial<WorkComparison>
  if (!Array.isArray(c.candidates)) return null
  return {
    self: c.self,
    ranking: Array.isArray(c.ranking) ? c.ranking.filter((n) => Number.isInteger(n)) : [],
    candidates: c.candidates.map((x, i) => normaliseCandidate(x, i)),
    sisingReference: c.sisingReference,
  }
}

function normaliseCandidate(x: unknown, fallbackIndex: number): WorkCandidate {
  const o = (x ?? {}) as Record<string, unknown>
  const match = (o.match ?? {}) as Record<string, unknown>
  const forward = (match.forward ?? {}) as Record<string, unknown>
  return {
    index: Number.isInteger(o.index) ? (o.index as number) : fallbackIndex,
    rankScore: typeof o.rankScore === 'number' ? o.rankScore : numOrUndef(forward.percent),
    grade: strOrUndef(forward.grade),
    ratingText: strOrUndef(forward.ratingText),
    emoji: strOrUndef(forward.emoji),
    profile: o.profile as Record<string, unknown> | undefined,
    elementInteraction: o.elementInteraction as Record<string, unknown> | undefined,
    roles: Array.isArray(o.roles) ? (o.roles as WorkRole[]).filter((r) => !!r && typeof r.perspective === 'string') : [],
  }
}

const strOrUndef = (v: unknown) => (typeof v === 'string' && v !== '' ? v : undefined)
const numOrUndef = (v: unknown) => (typeof v === 'number' ? v : undefined)

/**
 * ② The people in the order the engine ranked them.
 *
 * `ranking` holds indexes into `candidates`. Anything it points at that does not exist is dropped, and any
 * candidate `ranking` forgot is appended in its original order — losing a person off the screen is worse
 * than showing them last, and an engine that returns a short `ranking` is a bug we want visible as a
 * mis-ORDER, not as a disappearance.
 */
export function readRankedCandidates(comparison: WorkComparison | null): WorkCandidate[] {
  if (!comparison) return []
  const byIndex = new Map(comparison.candidates.map((c) => [c.index, c]))
  const out: WorkCandidate[] = []
  const taken = new Set<number>()
  for (const i of comparison.ranking) {
    const c = byIndex.get(i)
    if (c && !taken.has(i)) { out.push(c); taken.add(i) }
  }
  for (const c of comparison.candidates) if (!taken.has(c.index)) out.push(c)
  return out
}

export type WorkRolesRead = {
  /** the roles the engine actually returned, in the order it returned them */
  roles: WorkRole[]
  /** true only when all three arrived */
  complete: boolean
  /** how many are missing — 0 when complete */
  missing: number
}

/**
 * ③ The three role readings for one person, plus an explicit answer to "did any go missing".
 *
 * The screen must show `missing > 0` as a gap it can name. It must NOT silently render two headings as if
 * that were the whole answer: the person paid a quota unit for three.
 */
export function readRoles(candidate: WorkCandidate | null | undefined): WorkRolesRead {
  const roles = candidate?.roles ?? []
  return { roles, complete: roles.length === WORK_ROLE_COUNT, missing: Math.max(0, WORK_ROLE_COUNT - roles.length) }
}
