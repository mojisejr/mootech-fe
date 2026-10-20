// คะแนน "สากล" ของวัน (คุณภาพวัน ไม่ขึ้นกับดวงใคร) — Kittipon 2026-10-20 (2 วง สากล | เฉพาะบุคคล แบบ 通勝)
// แหล่งจริง = engine almanac day.universal (กำลังดิถีวัน strength.ratioDay → 0-100 · src/lib/bazi/almanac/universal-score.ts)
// engine รุ่นก่อนไม่มี universal → คำนวณจาก strength.ratioDay เองด้วยเกณฑ์เดียวกัน (ต้องตรงกับ engine)
export type Universal = { score: number; label: string }

const BANDS: readonly { min: number; label: string }[] = [
  { min: 80, label: 'ดีเยี่ยม' },
  { min: 65, label: 'ดี' },
  { min: 45, label: 'พอใช้' },
  { min: 0, label: 'ระวัง' },
]

export function universalLabel(score: number): string {
  return (BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1]).label
}

/** almanac day (ดิบ) → คะแนนสากล · ไม่มีข้อมูล → null (การ์ดโชว์วงเดียวแบบเดิม) */
export function universalOf(almanacDay: unknown): Universal | null {
  const a = (almanacDay ?? {}) as { universal?: { score?: unknown; label?: unknown }; strength?: { ratioDay?: unknown } }
  if (a.universal && typeof a.universal.score === 'number') {
    const score = Math.max(0, Math.min(100, Math.round(a.universal.score)))
    return { score, label: typeof a.universal.label === 'string' && a.universal.label ? a.universal.label : universalLabel(score) }
  }
  const r = a.strength?.ratioDay
  if (typeof r !== 'number' || !Number.isFinite(r)) return null
  const score = Math.max(0, Math.min(100, Math.round(r * 100)))
  return { score, label: universalLabel(score) }
}
