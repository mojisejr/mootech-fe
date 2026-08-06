// §12 [advanced] "8 ประตู 八門 · ทิศประจำวัน" — the 3×3 COMPASS.
//
// Rewritten for M-D (มุน 2026-08-06). Two things changed and both are deliberate subtractions, so they are
// written down rather than left to look like unfinished work:
//
// 1 · POSITION COMES FROM THE DATA, NOT FROM THE ARRAY. The previous version did `gates.map(...)` into a
//     `grid-cols-3` and rendered the direction as a caption, so a cell's position was whatever order the
//     pipe happened to return. It looked correct only because the frozen content.ts array was in the order
//     Figma drew. Figma 634:8752 §12 compared cell-by-cell against a real payload puts every gate at the
//     ANTIPODE of the pipe's — a 180° reflection across all eight, between dates 23 days apart, because the
//     gates rotate daily. Figma drew one day's fortune, not a layout. Each cell now takes explicit
//     grid coordinates from gate-compass.ts, so neither array order nor JSX order can move anything.
//
// 2 · NO GOOD/BAD TINTING. The old version tinted every cell with the DAY_CELL good/medium/bad palette,
//     and Figma tints them too — but those tiers were read off Figma's pixels, and the classics carry no
//     level for the eight gates (they carry a name and a meaning). ฟีม ruled: show what exists. Colouring
//     them would assert exactly how much worse ตาย is than บาดเจ็บ, which is writing doctrine, not design.
//     This is a REMOVAL of something the screen used to show, on purpose.
//
// The one highlight that remains is a different fact entirely, and is labelled as such: `luckyDirection`
// (ทิศมงคล) is its own field from the almanac, so the cell at that direction is marked and the legend says
// what the mark means. It is not a claim about that gate.
import type { DayDetailGate } from '../../types'
import { SectionCard } from './SectionCard'
import { SELECTED } from '../grade-colors'
import { DIR_CELL, CENTER, DIR_LABEL_TH, normalizeDirection, placeGates, type Direction } from './gate-compass'

function GateCell({ direction, gate, lucky }: { direction: Direction; gate: DayDetailGate; lucky: boolean }) {
  const cell = DIR_CELL[direction]
  return (
    <div
      data-testid="gate-cell"
      data-dir={direction}
      // explicit coordinates — the whole point. Source order is now irrelevant to where this paints.
      style={{
        gridRow: cell.row,
        gridColumn: cell.col,
        backgroundColor: lucky ? SELECTED.fill : '#F5F7FB',
        color: lucky ? SELECTED.text : '#0B305B',
      }}
      className="flex flex-col items-center gap-1 rounded-2xl px-1 py-3 leading-none"
    >
      <span className="text-[10px] font-semibold opacity-70">{DIR_LABEL_TH[direction]}</span>
      <span className="text-2xl font-extrabold">{gate.name}</span>
      <span className="text-[11px] font-medium opacity-90">{gate.meaning}</span>
    </div>
  )
}

export function EightGates({ gates, luckyDirection }: { gates: DayDetailGate[]; luckyDirection?: string }) {
  const { placed, unplaced } = placeGates(gates)
  const lucky = normalizeDirection(luckyDirection)
  return (
    <SectionCard title="8 ประตู 八門 · ทิศประจำวัน" testId="eight-gates">
      <div data-testid="gate-board" className="grid grid-cols-3 grid-rows-3 gap-2">
        {placed.map((p) => (
          <GateCell key={p.direction} direction={p.direction} gate={p.gate} lucky={p.direction === lucky} />
        ))}
        {/* the centre is not a ninth gate — ฟีม cut 財 because the classics have eight. It is where the
            reader stands, which is what makes the other eight readable as directions at all. */}
        <div
          data-testid="gate-center"
          style={{ gridRow: CENTER.row, gridColumn: CENTER.col }}
          className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-v3-sapphire/30 px-1 py-3 leading-none"
        >
          <span aria-hidden className="text-lg">📍</span>
          <span className="text-[10px] font-semibold text-v3-sapphire">คุณอยู่นี่</span>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-5 text-v3-text-muted">
        วางตามทิศที่ตำราระบุของวันนั้น — ประตูย้ายทิศทุกวัน
        {lucky && (
          <>
            {' · '}
            <span className="font-semibold text-v3-sapphire">ช่องสีน้ำเงิน = ทิศมงคลของวัน</span>
            {' (ไม่ได้แปลว่าประตูนั้นดี)'}
          </>
        )}
      </p>

      {/* A gate whose direction could not be read must be SEEN, not silently missing from the board — a
          board with seven cells looks complete to anyone who does not count. */}
      {unplaced.length > 0 && (
        <div data-testid="gate-unplaced" className="mt-3 rounded-xl bg-[#FEF1E0] px-3 py-2">
          <p className="text-[11px] font-semibold leading-5 text-[#B47E35]">
            วางบนเข็มทิศไม่ได้ {unplaced.length} ประตู (ทิศซ้ำหรืออ่านไม่ออก)
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {unplaced.map((g, i) => (
              <li key={`${g.name}-${i}`} className="text-[11px] leading-5 text-[#B47E35]">
                {g.name} · {g.direction || '—'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  )
}
