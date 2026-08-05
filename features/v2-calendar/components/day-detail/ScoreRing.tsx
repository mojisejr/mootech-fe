import { percentText } from '../percent-display'
// ScoreRing — the v3 hero score ring (lime progress over a navy track). Figma 636:19230 (ดวงสมพงศ์ hero) is
// an OPEN ring: no filled centre disc — the grade + % float over whatever the ring sits on. `onDark` picks the
// text treatment: on a dark card (compat hero) → lime grade + white %; on a light card (calendar/home, pastel
// gradient) → navy grade + navy % so it stays legible. Same primitive, one prop, no per-surface duplication.
// (Was: a solid lime centre disc with navy text on every surface — ฟีม 2026-08-03: match Figma's open ring
//  everywhere. The disc is removed here; light-bg callers keep navy text via the default.)
export function ScoreRing({ grade, percent, onDark = false }: { grade: string; percent: number; onDark?: boolean }) {
  const R = 46
  const C = 2 * Math.PI * R
  const pct = Math.max(0, Math.min(100, percent))
  return (
    <div className="relative grid size-[132px] place-items-center">
      <svg viewBox="0 0 120 120" className="size-[132px] -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#083C7B" strokeWidth="11" />
        <circle cx="60" cy="60" r={R} fill="none" stroke="#E1FF00" strokeWidth="11" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} />
      </svg>
      <span className="absolute flex flex-col items-center leading-none">
        <span className={`text-[34px] font-extrabold ${onDark ? 'text-v3-lime' : 'text-v3-navy'}`}>{grade}</span>
        <span className={`mt-0.5 text-sm font-bold ${onDark ? 'text-white' : 'text-v3-navy'}`}>{percentText(percent)}%</span>
      </span>
    </div>
  )
}

export default ScoreRing
