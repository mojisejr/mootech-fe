// B0 — Input Adapter (Phase 3.1, #mootech-fullstack-supabase-fold).
// Single chokepoint: fe calc input -> bazi RawInputSchema (src/lib/bazi/schema-types.ts).
// bazi requires birthDate, birthTime, gender(lowercase), province — ALL non-empty (.min(1)).
// fe sends {name,dob,time,gender:"MALE"|"FEMALE"|null, place_name}; time may be empty when the
// user doesn't remember their birth time (is_remember_time=false). PURE — unit-tested DB-free.
//
// INTERIM POLICY (marked): when birthTime is missing we default it to "12:00" only to satisfy
// bazi's required field, and return hasBirthTime=false so the chart adapter (B1) can SUPPRESS the
// time/hour pillar — matching NestJS's "no hour pillar" behavior (never fabricate an hour reading).
// province defaults to "Bangkok" (bazi already anchors Asia/Bangkok). Revisit when a real
// birth-time / birthplace UX exists.

export interface FeCalcInput {
  name?: string | null
  dob?: string | null // 'YYYY-MM-DD'
  time?: string | null // 'HH:mm' or '' / null
  gender?: string | null // 'MALE' | 'FEMALE' | null
  place_name?: string | null
}

export interface BaziRawInput {
  birthDate: string
  birthTime: string
  gender: 'male' | 'female'
  province: string
}

export interface BaziInputResult {
  rawInput: BaziRawInput
  hasBirthTime: boolean
  name: string
}

export const DEFAULT_BIRTH_TIME = '12:00'
export const DEFAULT_PROVINCE = 'Bangkok'

function nonEmpty(v: string | null | undefined): string {
  return typeof v === 'string' ? v.trim() : ''
}

// fe gender 'MALE'/'FEMALE'/null -> bazi 'male'/'female'. Null/unknown -> 'male' (interim default;
// NestJS allowed null gender, bazi requires a value).
export function normalizeGender(g: string | null | undefined): 'male' | 'female' {
  return nonEmpty(g).toLowerCase() === 'female' ? 'female' : 'male'
}

export function toBaziInput(fe: FeCalcInput): BaziInputResult {
  const time = nonEmpty(fe.time)
  const hasBirthTime = time !== ''
  const province = nonEmpty(fe.place_name) || DEFAULT_PROVINCE
  return {
    rawInput: {
      birthDate: nonEmpty(fe.dob),
      birthTime: hasBirthTime ? time : DEFAULT_BIRTH_TIME,
      gender: normalizeGender(fe.gender),
      province,
    },
    hasBirthTime,
    name: nonEmpty(fe.name),
  }
}

// Shape of the mootech `user` row fields we read for chat (subset of SELECT * FROM "user").
export interface UserBirthRow {
  name?: string | null
  dob?: string | null
  time?: string | null
  gender?: string | null
  place_name?: string | null
  is_remember_time?: boolean | null
}

// Map a stored user row -> FeCalcInput, honoring is_remember_time: we only trust the stored
// birth time when the user explicitly remembered it (is_remember_time === true). Otherwise we
// blank it so toBaziInput falls back to 12:00 and the hour pillar is suppressed (hasBirthTime
// false) — mirroring NestJS "no hour pillar" behavior. Never fabricate an hour reading.
export function userRowToFeCalcInput(row: UserBirthRow): FeCalcInput {
  const trustTime = row.is_remember_time === true
  return {
    name: row.name ?? null,
    dob: row.dob ?? null,
    time: trustTime ? (row.time ?? null) : '',
    gender: row.gender ?? null,
    place_name: row.place_name ?? null,
  }
}

// A profile is chat-ready only when birth date and gender are present. Province defaults to
// Bangkok and time degrades gracefully, but date/gender must never be guessed.
export function isBirthProfileComplete(row: UserBirthRow): boolean {
  return nonEmpty(row.dob) !== '' && nonEmpty(row.gender) !== ''
}
