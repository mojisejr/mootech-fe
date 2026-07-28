// §8 "คำทำนายรายด้าน" — one Grade Card per life-area (DESIGN.md Grade Card 636-21251: bg = grade tint,
// header = title Bold + % in grade colour + badge pill, body = 3 advice lines #71717A). Same 4 areas as §6,
// so the two sections can never disagree — they read the one CompatArea[] from the content module.
import type { CompatArea } from './content'
import { GradeBadge } from './GradeBadge'
import { SectionCard } from './SectionCard'
import { GRADE_COLORS } from '../grade-colors'

function PredictionCard({ area }: { area: CompatArea }) {
  const c = GRADE_COLORS[area.grade]
  const pctColor = c.badgeText === '#374151' ? '#374151' : c.accent
  return (
    <div className="rounded-2xl px-3 py-2.5" style={{ backgroundColor: c.bg }}>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-sm font-bold text-v3-navy">{area.label}</p>
        <span className="text-sm font-bold" style={{ color: pctColor }}>{area.percent}%</span>
        <GradeBadge grade={area.grade} className="!min-w-[40px] !py-0.5 text-sm" />
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {area.advice.map((line, i) => (
          <li key={i} className="text-[13px] leading-[22px] text-[#71717A]">{line}</li>
        ))}
      </ul>
    </div>
  )
}

export function PredictionCards({ areas }: { areas: CompatArea[] }) {
  return (
    <SectionCard title="คำทำนายรายด้าน">
      <div className="flex flex-col gap-3">
        {areas.map((a) => (
          <PredictionCard key={a.label} area={a} />
        ))}
      </div>
    </SectionCard>
  )
}
