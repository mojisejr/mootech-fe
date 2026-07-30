// features/v2-service/compatibility-result.ts — ดวงสมพงศ์ Slice 2C, the goo↔μุน RESULT SEAM.
// PURE (no I/O, no v1 import) → node-testable, same discipline as compatibility-api.ts.
//
// goo owns: parsing the v1 get-detail response into the result contract μุน renders, and
// which day-ganzhi need mascots. μุน owns: the result screen, hiding fields that are absent.
//
// The contract rule (FROZEN §4, D12/D13): EVERY field is optional. A field the engine did not
// send is `undefined` — NOT '' or 0 — so the screen decides to hide it. `dimensions` is passed
// through VERBATIM: no cut, no add, no reorder, no default [] (love=5, colleague=4 as-is).

/** One mascot card ("โปเตโต้"). Shape mirrors GET /api/bazi/mascot/[ganzhi]. */
export type CompatMascot = {
  ganzhi: string
  nameTh: string
  nameEn: string
  imageUrl: string
}

/** One pillar column in the four-pillar table (Slice 2A added `element`). */
export type CompatPillar = { stem: string; branch: string; element: string }
export type CompatFourPillars = {
  year: CompatPillar
  month: CompatPillar
  day: CompatPillar
  hour: CompatPillar
}

/** One person's card. All optional — the screen hides what is absent. */
export type CompatResultPerson = {
  displayName?: string | null
  dayGanzhi?: string
  elementTh?: string
  stageTh?: string
  nisai?: string[]
  /** false → the hour was unknown; the screen shows "—" for the hour pillar (never a fake value). */
  timeKnown?: boolean
  fourPillars?: CompatFourPillars
  /**
   * Header birthdate line (Figma 636:18819). CARRIED from the form's CompatPerson at calculate time
   * (NOT re-fetched, NOT echoed by the engine) — the raw values, the screen formats to พ.ศ./Thai.
   * `undefined` when the result was opened directly without the form (parked "ล่าสุด" flow) → the screen
   * hides the birthdate line rather than showing a blank/fake value (rule 4).
   */
  birthDate?: string // YYYY-MM-DD
  time?: string // HH:mm — undefined when the birth time is unknown (→ show "—")
}

/** The birth fields carried forward from the calculate step (a slim slice of Slice 1's CompatPerson). */
export type CarriedBirth = { name?: string; dob?: string; time?: string }
export type CarriedPersons = { a?: CarriedBirth; b?: CarriedBirth }

export type CompatOverall = {
  percent?: number | null
  grade?: string | null
  gradeLabel?: string
  hearts?: number
  emoji?: string | null
  ratingText?: string
}

export type CompatElementRelation = {
  relation?: string
  labelTh?: string
  meaningTh?: string
}

/** One dimension row. `sising` may carry the symbolic hint ("เสือขาว") — or be null/absent. */
export type CompatDimension = {
  key?: string
  label?: string
  pairingLabel?: string
  percent?: number | null
  grade?: string
  gradeLabel?: string
  emoji?: string | null
  ratingText?: string
  isMain?: boolean
  sising?: { code?: string; nameTh?: string; summary?: string } | null
}

export type CompatElementInteraction = {
  aElementTh?: string
  bElementTh?: string
  summaryTh?: string
  aToB?: CompatElementRelation
  bToA?: CompatElementRelation
}

/** The whole contract μุน's result screen renders. */
export type CompatibilityResult = {
  overall?: CompatOverall
  /** VERBATIM pass-through of the engine's dimensions; `undefined` when absent (never defaulted). */
  dimensions?: CompatDimension[]
  persons: { a?: CompatResultPerson; b?: CompatResultPerson }
  elementInteraction?: CompatElementInteraction
}

// The BE (Slice 2B) stores `{ me, you, result, pairMatch }` as a JSON STRING in
// log_matching.result, and the v1 get-detail wrapper returns it under `.result` (v1 itself
// does `JSON.parse(response.result)` — we mirror that exactly). The rich fields live under
// `.pairMatch`. A legacy / non-bazi / malformed result has no usable `pairMatch` → null, and
// the hook shows a fallback rather than stranding or fabricating.
type StoredBlob = {
  pairMatch?: {
    overall?: CompatOverall
    dimensions?: CompatDimension[]
    persons?: { a?: CompatResultPerson; b?: CompatResultPerson }
    elementInteraction?: CompatElementInteraction
  }
}

/**
 * Parse the raw get-detail response into the result contract. Returns null when there is no
 * usable pairMatch blob (missing / not a string / malformed JSON / legacy result) — the caller
 * renders "ไม่มีข้อมูล", never strands. Pass-through only: no field is defaulted or reshaped.
 */
export function parseCompatibilityResult(getDetailResponse: unknown): CompatibilityResult | null {
  const resp = getDetailResponse as { result?: unknown } | null
  if (!resp || typeof resp.result !== 'string') return null

  let blob: StoredBlob
  try {
    blob = JSON.parse(resp.result) as StoredBlob
  } catch {
    return null // malformed JSON → no data, not a crash
  }

  const pm = blob?.pairMatch
  if (!pm || typeof pm !== 'object') return null // legacy/non-bazi engine → no rich screen

  return {
    overall: pm.overall, // undefined if absent — pass-through
    dimensions: pm.dimensions, // VERBATIM; undefined if absent (NO default [])
    persons: { a: pm.persons?.a, b: pm.persons?.b },
    elementInteraction: pm.elementInteraction,
  }
}

/**
 * The two day-ganzhi that need mascots. Absent dayGanzhi → undefined (skip that mascot; never
 * fabricate a ganzhi). Empty string is treated as absent.
 */
export function mascotGanzhiPair(
  result: CompatibilityResult | null,
): { a?: string; b?: string } {
  const a = result?.persons?.a?.dayGanzhi
  const b = result?.persons?.b?.dayGanzhi
  return {
    a: a && a.trim() ? a.trim() : undefined,
    b: b && b.trim() ? b.trim() : undefined,
  }
}

/**
 * Merge the birthDate/time CARRIED from the form onto the result persons (the header line).
 * PURE. '' / whitespace → undefined (rule 4: hide the line, never show a blank/fake). No carry
 * (direct-link / parked "ล่าสุด" flow) → persons unchanged (birthDate/time stay undefined).
 * Position-aligned: carried.a ↔ persons.a (the user), carried.b ↔ persons.b (the friend) — the same
 * order calculateCompatibility sends (userId→personA, friendId→personB).
 */
export function applyCarriedBirth(
  result: CompatibilityResult | null,
  carried: CarriedPersons | null | undefined,
): CompatibilityResult | null {
  if (!result || !carried) return result
  const merge = (
    p: CompatResultPerson | undefined,
    c: CarriedBirth | undefined,
  ): CompatResultPerson | undefined => {
    if (!p && !c) return p
    const birthDate = c?.dob?.trim() || undefined
    const time = c?.time?.trim() || undefined
    const name = c?.name?.trim() || undefined
    return {
      ...(p ?? {}),
      displayName: p?.displayName ?? name,
      birthDate,
      time,
    }
  }
  return {
    ...result,
    persons: {
      a: merge(result.persons.a, carried.a),
      b: merge(result.persons.b, carried.b),
    },
  }
}
