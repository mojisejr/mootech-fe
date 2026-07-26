// RESPONSE_CHINESE_HOROSCOPE_GET — the chart inside the `{ data: chart }` envelope returned by
// GET /api/chinese-horoscope (ChineseHoroscopeGet).
//
// #167 — this type is now written from the REAL response VERIFIED LIVE (2026-07-26, GET on the local
// test-env stack, response.data). The previous hand-written type was a GUESS and deeply wrong: it declared
// `analytic.habits_behaviors` (a field that DOES NOT EXIST in the response) and omitted 7+ real top-level
// keys (dobThai, yearOfZodiac, cycleLife, cycleYearLife, power, elementCycle, code, share_profile_url) —
// exactly the fields pages/my-destiny reads. The blind `as` cast hid that mismatch. We type ONLY what we
// verified: the 15 real top-level keys; leaf shapes we did not fully inspect are `unknown` (honest — the
// key exists, its inner shape is unverified) rather than a fabricated deep type (that would be a new lie).
export interface RESPONSE_CHINESE_HOROSCOPE_GET {
  // 15 top-level keys, all VERIFIED present in the live response.
  dob: string
  time: string
  name: string
  gender: string
  dobThai: string
  yearOfZodiac: unknown
  // summary.element VERIFIED (string, e.g. "EARTH"); other summary members not re-verified → index sig.
  summary: { element: string; [key: string]: unknown }
  cycleLife: unknown
  cycleYearLife: unknown
  // detail.dayAbove.element is the day-master element toComputeSource reads; deeper detail not re-verified.
  detail: { dayAbove?: { element?: string; [key: string]: unknown }; [key: string]: unknown }
  // Real analytic keys (verified live): base · elemental_characteristics · habit · behaviors ·
  // behaviors_for_share · be_careful · occupations · lucky_colors · sacred_things · love · life ·
  // prediction_work. There is NO `habits_behaviors`. my-destiny reads analytic.base.description + analytic.life.
  analytic: {
    base?: { element?: string; description?: string; [key: string]: unknown }
    life?: unknown
    [key: string]: unknown
  }
  power: unknown
  elementCycle: unknown
  code: string
  share_profile_url: string
}
