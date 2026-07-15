// กำลังดิถี — 5-band classification of the day-master strength score.
//
// The score itself (`enrichment.strengthScore`) is REAL data from the current bazi-sft engine
// (public-calc → bazi-engine-adapter → symbolic-engine). Only the band *labels/thresholds* are
// ported here, verbatim from bazi-sft-dataset's src/lib/bazi/constants/operator-strength.ts
// (ซินแส spec 8.1, 2026-06-25). This is Phase-1 glue only: once goo ships `enrichment.strengthBand`
// (id + displayLabel) from public-calc, prefer that and treat this file as the fallback.
//   ที่มา: <2 อ่อนมาก · 2.25–3.75 อ่อน · 4–5.5 สมดุล · 5.75–6.75 แข็ง · >7 แข็งมาก
//   จุดตัดที่กึ่งกลางกริด (.875/.625) ให้ขอบจำนวนเต็มตกถูกฝั่ง — ตรงตาม engine ต้นทาง

export type StrengthBandId = 'very-weak' | 'weak' | 'balanced' | 'strong' | 'very-strong'

export type StrengthBand = {
  id: StrengthBandId
  /** short rail label */
  label: string
  /** full hero label */
  displayLabel: string
  maxInclusive: number
}

export const CALCULATOR_STRENGTH_BANDS: readonly StrengthBand[] = [
  { id: 'very-weak', label: 'อ่อนเกินไป', displayLabel: 'ดิถีอ่อนเกินไป', maxInclusive: 1.875 },
  { id: 'weak', label: 'ดวงอ่อน', displayLabel: 'ดิถีอ่อน', maxInclusive: 3.875 },
  { id: 'balanced', label: 'สมดุล', displayLabel: 'ดิถีสมดุล', maxInclusive: 5.625 },
  { id: 'strong', label: 'ดวงแข็ง', displayLabel: 'ดิถีแข็ง', maxInclusive: 6.875 },
  { id: 'very-strong', label: 'แข็งเกินไป', displayLabel: 'ดิถีแข็งเกินไป', maxInclusive: Number.POSITIVE_INFINITY },
]

export function bandIndexFromScore(score: number): number {
  const idx = CALCULATOR_STRENGTH_BANDS.findIndex((b) => score <= b.maxInclusive)
  // findIndex only returns -1 if score is NaN; the last band's maxInclusive is +Infinity so any
  // finite score always matches. Clamp NaN to the balanced middle rather than crashing the meter.
  return idx === -1 ? 2 : idx
}

/** Resolve by goo's future `strengthBand.id` when present; else classify the raw score. */
export function resolveStrengthBand(score: number, bandId?: string): { band: StrengthBand; index: number } {
  if (bandId) {
    const i = CALCULATOR_STRENGTH_BANDS.findIndex((b) => b.id === bandId)
    if (i !== -1) return { band: CALCULATOR_STRENGTH_BANDS[i], index: i }
  }
  const index = bandIndexFromScore(score)
  return { band: CALCULATOR_STRENGTH_BANDS[index], index }
}
