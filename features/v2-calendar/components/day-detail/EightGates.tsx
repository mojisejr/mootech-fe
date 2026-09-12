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
import { SPIRIT_STYLE } from './EightDeities'
import { DIR_CELL, CENTER, placeGates, type Direction } from './gate-compass'

// สีต่อประตูตามเฟรม Figma 634:8752 (design context 2026-09-07 — ผู้ใช้สั่ง "อย่าลืมใส่สีด้วยนะ" ทับคำตัดสิน M-D เดิม):
//   開休生 = teal #E7F6F8/#1B9AAF · 傷杜死驚 = แดง #FDECE9/#CD3D2E · 景 = ส้ม #FEF3E5/#B47E35 · ไม่รู้จัก = #F5F7FB navy
export const GATE_TINT: Record<string, { bg: string; ink: string }> = {
  '開': { bg: '#E7F6F8', ink: '#1B9AAF' },
  '休': { bg: '#E7F6F8', ink: '#1B9AAF' },
  '生': { bg: '#E7F6F8', ink: '#1B9AAF' },
  '景': { bg: '#FEF3E5', ink: '#B47E35' },
  '傷': { bg: '#FDECE9', ink: '#CD3D2E' },
  '杜': { bg: '#FDECE9', ink: '#CD3D2E' },
  '死': { bg: '#FDECE9', ink: '#CD3D2E' },
  '驚': { bg: '#FDECE9', ink: '#CD3D2E' },
}
const GATE_DEFAULT = { bg: '#F5F7FB', ink: '#0B305B' }

function GateCell({ direction, gate }: { direction: Direction; gate: DayDetailGate }) {
  const cell = DIR_CELL[direction]
  const tint = GATE_TINT[gate.name.trim()] ?? GATE_DEFAULT
  // ผู้ใช้ 2026-09-12: "เอาชื่อ(เทพ)ขึ้นก่อนตัวอักษรจีน และชื่อไทยใส่สีตามพลัง" — ชื่อเทพ 十神 นำหน้า (บน),
  // ทาสีตามพลังเทพ (SPIRIT_STYLE.ink); อักษรจีนประตูอยู่ล่าง. ไม่มี deity → ใช้ความหมายประตู + สีประตู.
  const deityStyle = gate.deity ? SPIRIT_STYLE[gate.deity.trim()] : undefined
  const leadName = deityStyle?.th ?? gate.deity?.trim() ?? gate.meaning
  const leadInk = deityStyle?.ink ?? tint.ink
  return (
    <div
      data-testid="gate-cell"
      data-dir={direction}
      // explicit coordinates — the whole point. Source order is now irrelevant to where this paints.
      style={{
        gridRow: cell.row,
        gridColumn: cell.col,
        backgroundColor: tint.bg,
        color: tint.ink,
      }}
      className="flex flex-col items-center gap-0.5 rounded-2xl px-1 py-3 leading-none"
    >
      <span className="text-[10px] font-bold text-v3-text-body">{direction}</span>
      <span className="text-[15px] font-extrabold leading-tight" style={{ color: leadInk }}>{leadName}</span>
      <span className="text-xl font-bold leading-none" style={{ color: tint.ink }}>{gate.name}</span>
    </div>
  )
}

export function EightGates({ gates }: { gates: DayDetailGate[] }) {
  const { placed, unplaced } = placeGates(gates)
  // แสดงเฉพาะประตูที่มีคีย์เวิร์ด (engine ส่ง gate-keyword.json มา) — ก่อน engine deploy = ว่าง → ซ่อนลิสต์เงียบๆ
  const gatesWithKeywords = gates.filter((g) => (g.keywords?.length ?? 0) > 0)
  return (
    <SectionCard title="8 ประตู 八門 · ทิศประจำวัน" testId="eight-gates">
      <div data-testid="gate-board" className="grid grid-cols-3 grid-rows-3 gap-2">
        {placed.map((p) => (
          <GateCell key={p.direction} direction={p.direction} gate={p.gate} />
        ))}
        {/* ช่องกลาง = "คุณ" (ผู้ดู) — ซินแส 2026-09-12: ตำราไม่มีประตูที่ 9 และช่องกลางคือ "ตัวเรา" ที่ยืนอยู่กลางเข็มทิศ.
            ทิศมงคล (財/โชคลาภ) ย้ายไปแสดงในการ์ด "ทิศ สีมงคล" แล้ว จึงไม่ซ้ำที่นี่ */}
        <div
          data-testid="gate-center"
          style={{ gridRow: CENTER.row, gridColumn: CENTER.col }}
          className="flex flex-col items-center justify-center gap-px rounded-[14px] bg-v3-sapphire px-1 py-2.5 leading-none text-white"
        >
          <span className="text-[18px] font-bold leading-6">คุณ</span>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-5 text-v3-text-muted">
        วางตามทิศที่ตำราระบุของวันนั้น — ประตู/เทพย้ายทิศทุกวัน · ทิศใต้อยู่บน ทิศเหนืออยู่ล่าง (ฮวงจุ้ยธรรมชาติ)
      </p>

      {/* "8 ประตู · คีย์เวิร์ด" — ลิสต์ใต้เข็มทิศ เหมือน "10 เทพ · คีย์เวิร์ด" (ผู้ใช้ 2026-09-12).
          chip = อักษรจีนประตู (สีตามพลังประตู GATE_TINT) · ชื่อไทยประตูทาสีตามพลัง · คีย์เวิร์ดจาก engine (gate-keyword.json). */}
      {gatesWithKeywords.length > 0 && (
        <div className="mt-4 border-t border-dashed border-v3-divider-dashed pt-4">
          <p className="mb-3 text-sm font-bold text-v3-navy">8 ประตู 八門 · คีย์เวิร์ด</p>
          <ul className="flex flex-col gap-3.5">
            {gatesWithKeywords.map((g, i) => {
              const tint = GATE_TINT[g.name.trim()] ?? GATE_DEFAULT
              return (
                <li key={`${g.name}-${i}`} data-testid="gate-keyword-row" className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="grid size-9 shrink-0 place-items-center rounded-[10px] text-[16px] font-bold leading-none"
                    style={{ backgroundColor: tint.bg, color: tint.ink }}
                  >
                    {g.name.trim()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: tint.ink }}>{g.meaning}</p>
                    <p className="mt-0.5 text-xs leading-5 text-v3-text-body">{(g.keywords ?? []).join(' · ')}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* A gate whose direction could not be read must be SEEN, not silently missing from the board — a
          board with seven cells looks complete to anyone who does not count. */}
      {unplaced.length > 0 && (
        <div data-testid="gate-unplaced" className="mt-3 rounded-xl bg-v3-cal-medium-bg px-3 py-2">
          <p className="text-[11px] font-semibold leading-5 text-v3-cal-medium">
            วางบนเข็มทิศไม่ได้ {unplaced.length} ประตู (ทิศซ้ำหรืออ่านไม่ออก)
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {unplaced.map((g, i) => (
              <li key={`${g.name}-${i}`} className="text-[11px] leading-5 text-v3-cal-medium">
                {g.name} · {g.direction || '—'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  )
}
