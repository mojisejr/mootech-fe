// §9 [advanced] "ดิถีวันนี้" — the day's officer (建除) and what it means.
//
// M-D (มุน 2026-08-06) — V5 decided: PLAIN TEXT, no coloured dots.
//
// The previous version rendered coloured bullets whose tone came from a mock field (`tone: 'good' | 'bad'`).
// The real pipe sends `{officer, officerDesc, jianchu}` — three plain strings and no tone anywhere, because
// the classics do not grade the officer. Reading "อับโชค เสียหาย" and painting a red dot is turning prose
// into a verdict: that is interpretation, not data, and the moment it is a coloured dot the reader takes it
// as a rating the source never gave.
//
// So the dot is gone. This is a REMOVAL of something the screen used to show, on purpose — recorded here so
// nobody later reads the plain rows as an unfinished section and "restores" the colours.
import type { DayDetailDithi } from '../../types'
import { SectionCard } from './SectionCard'

export function Dithi({ dithi }: { dithi: DayDetailDithi }) {
  const rows: { label: string; value: string }[] = [
    { label: 'ดิถี', value: dithi.officer },
    { label: 'ความหมาย', value: dithi.officerDesc },
    { label: '建除', value: dithi.jianchu },
  ].filter((r) => r.value?.trim())

  return (
    <SectionCard title={`ดิถีวันนี้${dithi.officer ? ` · ${dithi.officer}` : ''}`} testId="dithi">
      {rows.length === 0 ? (
        <p className="text-sm text-v3-text-muted">วันนี้ไม่มีข้อมูลดิถี</p>
      ) : (
        <dl className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <div key={r.label} data-testid="dithi-row" className="flex items-baseline gap-3">
              <dt className="w-[68px] shrink-0 text-xs font-semibold text-v3-text-muted">{r.label}</dt>
              <dd className="min-w-0 flex-1 text-sm leading-6 text-v3-text-body">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </SectionCard>
  )
}
