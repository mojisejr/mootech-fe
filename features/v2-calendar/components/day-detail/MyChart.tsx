// §5 [advanced] "ดวงของฉัน · วันนี้" — the บาจื่อ pillars. Binds to goo's DayDetail.pillars (PillarColumn[]
// of PillarCell {stem,branch,element}); NO hardcoded glyphs — the DAY วัน column carries the day's real
// ganzhi (goo #138). MAN block draws 1 layer (stem); DAY block draws 3 (stem / branch / ธาตุ). Block bgs are
// DESIGN.md palette tints (MAN = endeavour-100 #E3ECFB · DAY = lemon-chiffon #F9F4F0) — no new hex.
import type { PillarColumn } from '../../types'
import { SectionCard } from './SectionCard'

const COL_LABELS = ['ปี', 'เดือน', 'วัน', 'ยาม']

function PillarBlock({ column, layers, bg }: { column: PillarColumn; layers: 1 | 3; bg: string }) {
  return (
    <div className="rounded-2xl p-3" style={{ backgroundColor: bg }}>
      <p className="mb-2 text-xs font-bold tracking-wide text-v3-navy/70">{column.label}</p>
      <div className="grid grid-cols-4 gap-2">
        {column.cells.map((cell, i) => (
          <div key={i} className="flex flex-col items-center rounded-xl bg-white px-1 py-2 leading-none">
            <span className="text-[10px] font-medium text-v3-text-body/60">{COL_LABELS[i]}</span>
            <span data-testid={`${column.kind}-stem-${i}`} className="mt-1 text-2xl font-extrabold text-v3-navy">{cell.stem}</span>
            {layers === 3 && (
              <>
                <span className="mt-1 text-2xl font-extrabold text-v3-navy">{cell.branch}</span>
                <span className="mt-1 text-[10px] font-medium text-v3-text-body/70">{cell.element || '—'}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function MyChart({ pillars }: { pillars?: PillarColumn[] }) {
  const man = pillars?.find((p) => p.kind === 'man')
  const day = pillars?.find((p) => p.kind === 'day')
  if (!man && !day) return null
  return (
    <SectionCard title="ดวงของฉัน · วันนี้">
      <div className="flex flex-col gap-3">
        {man && <PillarBlock column={man} layers={1} bg="#E3ECFB" />}
        {day && <PillarBlock column={day} layers={3} bg="#F9F4F0" />}
      </div>
    </SectionCard>
  )
}
