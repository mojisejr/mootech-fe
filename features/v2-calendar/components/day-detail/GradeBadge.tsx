// Shared GRADE badge pill (DESIGN.md §GRADE + Grade Card 636-21251: "badge pill fill=grade, label Bold white
// [C+ dark]"). ONE place renders a grade → no scattered hex; the only dark-text exception is C+ (#374151,
// documented contrast exception in DESIGN.md). Used by §6 rows + §8 cards.
//
// Takes the grade as a STRING, not the 10-value `Grade` union: the wire owns the level list (13 today —
// lib/v2/api-grade.ts) and this pill is the thing that carries the precision now that the colour speaks
// five zones. A+ and A share a green; the letter is what tells them apart, so the letter must never be
// narrowed to a subset of what the API can send.
import { gradeColors } from '../grade-colors'

export function GradeBadge({ grade, className = '' }: { grade: string; className?: string }) {
  const c = gradeColors(grade)
  return (
    <span
      data-grade={grade}
      className={`inline-flex min-w-[44px] items-center justify-center rounded-full px-2.5 py-[3px] text-base font-bold leading-none ${className}`}
      style={{ backgroundColor: c.accent, color: c.badgeText }}
    >
      {grade}
    </span>
  )
}
