// §6 "ความเข้ากัน N ด้าน" (N = areas.length) + §7 insight box.
// The count in the heading comes from the data, never from a literal. It said five while the engine
// sent four, and writing four in its place would only move the same bug one engine change to the
// right — the same shape as the quota copy #557 had to fix. Each row: ♥ icon + area name + a grade-accent %-bar + % +
// GradeBadge (+ ⭐จุดแข็ง on the day's strongest area). The bar fill colour IS the grade accent (shared
// the shared 5-zone scale) — A± deep-green … D±/F deep-red — so the bar can't disagree with the badge.
// §7 is the 💡 line. NOTE the bar is the one place a zone colour appears without the letter ON it; the
// GradeBadge carrying that letter sits on the same row, which is why the zone alone is enough here.
import type { DayDetailArea } from '../../types'
import { GradeBadge } from './GradeBadge'
import { SectionCard } from './SectionCard'
import { facetLabel, orderFacets } from './facet-order'
import { gradeColors } from '../grade-colors'
import { percentText } from '../percent-display'

function HeartIcon() {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-v3-pastel-blue/40">
      <svg viewBox="0 0 24 24" className="size-6 text-[#F26B5E]" fill="currentColor" aria-hidden>
        <path d="M12 20s-7-4.35-7-9.5A3.5 3.5 0 0 1 12 7a3.5 3.5 0 0 1 7 3.5C19 15.65 12 20 12 20Z" />
      </svg>
    </span>
  )
}

function StrengthPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF7E9] px-2 py-1 text-xs font-bold text-[#2E7D32]">
      <span aria-hidden>⭐</span>จุดแข็ง
    </span>
  )
}

function CompatRow({ area }: { area: DayDetailArea }) {
  const accent = gradeColors(area.grade).accent
  return (
    // the testid exists so a test can COUNT what is on screen. Without it the count check would compare
    // the heading against the same array the heading came from, which is true no matter what renders.
    <div data-testid="day-compat-row" className="flex items-center gap-3">
      <HeartIcon />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-5 text-v3-navy">{facetLabel(area)}</p>
          {area.isStrength && <StrengthPill />}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#EDEFF2]">
            <span className="block h-full rounded-full" style={{ width: typeof area.percent === 'number' ? `${Math.max(0, Math.min(100, area.percent))}%` : '0%', backgroundColor: accent }} />
          </span>
          <span className="w-9 shrink-0 text-right text-xs font-bold text-v3-text-body">{percentText(area.percent)}%</span>
          <GradeBadge grade={area.grade ?? '—'} className="!min-w-[40px] !py-0.5 text-sm" />
        </div>
      </div>
    </div>
  )
}

export function CompatList({ areas, insight }: { areas: DayDetailArea[]; insight: string }) {
  // both sections order the SAME way through the same pure helper, so §6 and §8 can never disagree
  const ordered = orderFacets(areas)
  return (
    <SectionCard title={`ความเข้ากัน ${ordered.length} ด้าน`} info testId="day-compat-list">
      <div className="flex flex-col gap-4">
        {ordered.map((a) => (
          <CompatRow key={a.key || a.label} area={a} />
        ))}
      </div>
      {/* §7 — insight box */}
      <div className="mt-4 flex gap-2 rounded-xl bg-v3-lemon-chiffon px-3 py-3 text-sm leading-5 text-v3-text-body">
        <span aria-hidden>💡</span>
        <p>{insight}</p>
      </div>
    </SectionCard>
  )
}
