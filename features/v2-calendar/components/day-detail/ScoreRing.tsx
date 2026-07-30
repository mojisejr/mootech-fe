// ScoreRing — the v3 hero score ring (lime progress over a navy track, lime inner disc, navy grade + %).
// EXTRACTED from DayScoreCard (§3, Figma 634:8194) so the compatibility result score card (ดวงสมพงศ์ Slice 2E)
// reuses the SAME primitive instead of duplicating it (bong's D24: borrow, no code dup). DayScoreCard now
// imports this; the markup is byte-for-byte what it rendered before, so the calendar score is unchanged.
export function ScoreRing({ grade, percent }: { grade: string; percent: number }) {
  const R = 46
  const C = 2 * Math.PI * R
  const pct = Math.max(0, Math.min(100, percent))
  return (
    <div className="relative grid size-[132px] place-items-center">
      <svg viewBox="0 0 120 120" className="size-[132px] -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#1B3A6B" strokeWidth="11" />
        <circle cx="60" cy="60" r={R} fill="none" stroke="#E1FF00" strokeWidth="11" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} />
        <circle cx="60" cy="60" r="30" fill="#E1FF00" />
      </svg>
      <span className="absolute flex flex-col items-center leading-none">
        <span className="text-[34px] font-extrabold text-v3-navy">{grade}</span>
        <span className="mt-0.5 text-sm font-bold text-v3-navy">{percent}%</span>
      </span>
    </div>
  )
}

export default ScoreRing
