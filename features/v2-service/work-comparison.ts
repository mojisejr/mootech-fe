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

// ── the merged read model (มุน caught this at review, mootech-fe#585) ───────────────────────────────
//
// 🔴 THE DEFECT SHE FOUND. The old contract handed the screen TWO arrays and asked it to join them:
//   `comparison.candidates[]`  from the engine — carries `index` and the readings, and NO identity at all
//   `candidates[]`             from our database — carries `slot`, the friend id, the name, the picture
// Both were called "candidates", one level apart in the same payload, and the only thing tying a reading
// to a human being was an integer describing a POSITION. TypeScript cannot see a mistake there: both are
// arrays of objects. And when a position join goes wrong it does not crash — every name renders, every
// picture renders, every score renders, and the readings simply belong to the wrong people. That is the
// same shape as a tool returning a picture of a different place, looking perfectly normal, which cost us
// an hour earlier the same day.
//
// ⇒ THE FIX IS NOT A WARNING COMMENT. The join happens ONCE, here, on the server, and the result is a
// single list where a reading and a person are the same object. The screen cannot join them wrongly
// because it is never handed two things to join.
//
// 🔴 AND THE JOIN FAILS LOUD. If the engine's index set and our slot set are not the same set, this
// returns `ok: false` and the routes answer 5xx. Never a 200 with a best-effort list: "the readings are
// for other people" must not be a thing a user can be shown.

export type WorkPerson = {
  slot: number
  friendId: string
  name?: string | null
  surname?: string | null
  pictureUrl?: string | null
  /**
   * false when this person has no recorded birth hour, so the reading was computed at noon.
   *
   * 🔴 THE SCREEN MUST SHOW THIS. `/api/bazi/work` has no "unknown hour" mode — measured 2026-09-02:
   * omitting `birthTime` is a 400 (`expected string, received undefined`) and `''` is a 400 too
   * (`too_small`). Its sibling `/api/bazi/pair-match` DOES have one (optional key → noon →
   * `timeKnown:false` in the response, `pair-match/route.ts:41,119,159`), and this endpoint simply never
   * got it. So the BFF applies the same noon default the pair lane has always applied, and carries this
   * flag because the engine will not carry it for us. Hiding it would mean printing a percentage derived
   * from an hour nobody ever told us.
   */
  timeKnown: boolean
}

export type WorkEntry = {
  /** 1-based position in the engine's ranking — what the screen prints on the badge */
  rank: number
  /** the engine's `index`, which is also our `slot`; kept for debugging, NOT for joining anything */
  slot: number
  person: WorkPerson
  rankScore?: number
  grade?: string
  ratingText?: string
  emoji?: string
  profile?: Record<string, unknown>
  elementInteraction?: Record<string, unknown>
  roles: WorkRole[]
  /** false when the engine returned fewer than three readings — the screen must SAY so */
  rolesComplete: boolean
  rolesMissing: number
  /**
   * false when THIS entry's position did not come from `comparison.ranking`.
   *
   * 🔴 THE DoD SAYS "แสดงอันดับจาก comparison.ranking ❌ ไม่ใช่เรียงเอง". `readRankedCandidates` appends
   * anyone `ranking` forgot (losing a person off the screen is worse than showing them last), and before
   * this flag existed the appended ones were stamped with a rank number exactly like the real ones — an
   * order we invented, wearing the engine's clothes. ตู๋ caught it on mootech-fe#593.
   * The screen must not print a rank badge for an entry whose rank we made up.
   */
  rankFromEngine: boolean
}

export type WorkResultBuild =
  | {
      ok: true
      entries: WorkEntry[]
      /** true only when `comparison.ranking` named every candidate — mirrors `rolesComplete` */
      rankingComplete: boolean
    }
  | { ok: false; reason: 'index-slot-mismatch'; detail: string }

/**
 * Join the engine's readings to the people they are about, in ranking order.
 *
 * Everything the screen needs is in the returned objects. There is no second list to line up.
 */
function uniqSorted(ns: number[]): number[] {
  const out: number[] = []
  for (const n of ns) if (!out.includes(n)) out.push(n)
  return out.sort((a, b) => a - b)
}

export function buildWorkResult(comparison: WorkComparison | null, people: WorkPerson[]): WorkResultBuild {
  const ranked = readRankedCandidates(comparison)
  const bySlot = new Map(people.map((p) => [p.slot, p]))

  const engineIdx = uniqSorted(ranked.map((c) => c.index))
  const dbSlots = uniqSorted(people.map((p) => p.slot))
  if (engineIdx.length !== dbSlots.length || engineIdx.some((n, i) => n !== dbSlots[i])) {
    // ⚠️ Fail LOUD. A best-effort join here would hand someone another person's reading under their own
    // name and photo, which is worse than an error page by a wide margin.
    return {
      ok: false,
      reason: 'index-slot-mismatch',
      detail: `engine index [${engineIdx.join(',')}] != stored slot [${dbSlots.join(',')}]`,
    }
  }

  const named = new Set((comparison?.ranking ?? []).filter((n) => bySlot.has(n)))

  return {
    ok: true,
    rankingComplete: ranked.every((c) => named.has(c.index)),
    entries: ranked.map((c, i) => {
      const r = readRoles(c)
      return {
        rank: i + 1,
        rankFromEngine: named.has(c.index),
        slot: c.index,
        // the sets were proven EQUAL, which means nobody is missing and nobody is extra — it does NOT
        // mean nobody traded places. A swap preserves the set and walks straight through the gate above
        // (ตู๋, mootech-fe#593). What keeps a swap from happening is that both sides are built from one
        // array in one place: `workCandidateRows` in lib/matching/work-compare-flow.ts.
        person: bySlot.get(c.index)!,
        rankScore: c.rankScore,
        grade: c.grade,
        ratingText: c.ratingText,
        emoji: c.emoji,
        profile: c.profile,
        elementInteraction: c.elementInteraction,
        roles: r.roles,
        rolesComplete: r.complete,
        rolesMissing: r.missing,
      }
    }),
  }
}
