// Shared GRADE badge pill (DESIGN.md §GRADE + Grade Card 636-21251: "badge pill fill=grade, label Bold white
// [C+ dark]"). ONE place renders a grade → no scattered hex; the only dark-text exception is C+ (#374151,
// documented contrast exception in DESIGN.md — GRADE_COLORS['C+'].badgeText). Used by §6 rows + §8 cards.
import type { Grade } from '../../types'
import { GRADE_COLORS } from '../grade-colors'

// White on the solid accent pill, except the one documented exception (C+ lime #CDDC39 needs dark text).
function pillTextColor(grade: Grade): string {
  return GRADE_COLORS[grade].badgeText === '#374151' ? '#374151' : '#FFFFFF'
}

export function GradeBadge({ grade, className = '' }: { grade: Grade; className?: string }) {
  const c = GRADE_COLORS[grade]
  return (
    <span
      data-grade={grade}
      className={`inline-flex min-w-[44px] items-center justify-center rounded-full px-2.5 py-[3px] text-base font-bold leading-none ${className}`}
      style={{ backgroundColor: c.accent, color: pillTextColor(grade) }}
    >
      {grade}
    </span>
  )
}
