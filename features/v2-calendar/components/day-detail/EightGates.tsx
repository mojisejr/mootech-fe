// §12 [advanced] "8 ประตู 八門 · ทิศประจำวัน" — the 3×3 direction grid. Cell tint reuses DESIGN.md §CALENDAR
// day-cell tiers by the gate's auspiciousness (good/medium/bad); the day's own direction (財/ทิศ W) is the
// sapphire highlight (SELECTED) with white glyph. Every colour is a DESIGN.md token — no new hex.
import type { EightGate } from './content'
import { SectionCard } from './SectionCard'
import { DAY_CELL_COLORS, SELECTED } from '../grade-colors'

function GateCell({ gate }: { gate: EightGate }) {
  const tint = DAY_CELL_COLORS[gate.tier]
  const bg = gate.highlight ? SELECTED.fill : tint.tint
  const fg = gate.highlight ? SELECTED.text : tint.text
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl px-1 py-3 leading-none" style={{ backgroundColor: bg }}>
      <span className="text-[11px] font-semibold" style={{ color: fg, opacity: 0.75 }}>{gate.dir}</span>
      <span className="text-2xl font-extrabold" style={{ color: fg }}>{gate.char}</span>
      <span className="text-xs font-medium" style={{ color: fg }}>{gate.thai}</span>
    </div>
  )
}

export function EightGates({ gates }: { gates: EightGate[] }) {
  return (
    <SectionCard title="8 ประตู 八門 · ทิศประจำวัน">
      <div className="grid grid-cols-3 gap-2">
        {gates.map((g) => (
          <GateCell key={g.dir} gate={g} />
        ))}
      </div>
    </SectionCard>
  )
}
