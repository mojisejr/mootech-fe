// §8 "คำทำนายรายด้าน" — one Grade Card per life-area (DESIGN.md Grade Card 636-21251: bg = grade tint,
// header = title Bold + % in grade colour + badge pill, body = 3 advice lines #71717A). Same 4 areas as §6,
// so the two sections can never disagree — they read the one DayDetailArea[] from the content module.
import type { DayDetailArea } from '../../types'
import { GradeBadge } from './GradeBadge'
import { SectionCard } from './SectionCard'
import { gradeColors } from '../grade-colors'
import { percentText } from '../percent-display'

function PredictionCard({ area, advice }: { area: DayDetailArea; advice: string[] }) {
  const c = gradeColors(area.grade)
  const pctColor = c.badgeText === '#374151' ? '#374151' : c.accent
  return (
    <div className="rounded-2xl px-3 py-2.5" style={{ backgroundColor: c.bg }}>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-sm font-bold text-v3-navy">{area.label}</p>
        <span className="text-sm font-bold" style={{ color: pctColor }}>{percentText(area.percent)}%</span>
        <GradeBadge grade={area.grade ?? '—'} className="!min-w-[40px] !py-0.5 text-sm" />
      </div>
      {advice.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {advice.map((line, i) => (
            <li key={i} className="text-[13px] leading-[22px] text-[#71717A]">{line}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * M-D note, because the shape of the real data is narrower than the frozen mock and that is visible on
 * screen: the mock gave every area its own three advice lines. The pipe sends ONE `advice: string[]` — the
 * lines for the MAIN facet (types.ts: "คำแนะนำของด้านหลัก"). So the lines go on the strength card, and the
 * other cards show their score without invented copy. Repeating the main facet's advice under every area
 * would read as four readings when the source gave one.
 */
export function PredictionCards({ areas, advice }: { areas: DayDetailArea[]; advice: string[] }) {
  const mainKey = areas.find((a) => a.isStrength)?.key
  return (
    <SectionCard title="คำทำนายรายด้าน" testId="day-prediction-cards">
      <div className="flex flex-col gap-3">
        {areas.map((a) => (
          <PredictionCard key={a.key || a.label} area={a} advice={a.key === mainKey ? advice : []} />
        ))}
      </div>
    </SectionCard>
  )
}
