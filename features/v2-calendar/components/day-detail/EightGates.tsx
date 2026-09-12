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
// 2 · COLOUR IS "ธาตุของทิศ", NOT "ดี/ร้าย". The classics carry no good/bad level for the eight gates, so we
//     never tint by tier. What the shifu DID specify (2026-09-12): every compass point has a fixed 五行, and
//     the cell wears that element's colour (E/SE เขียว, S แดง, NE/SW น้ำตาล, W/NW ขาว-เทา, N ดำ-น้ำเงิน). When
//     the day's ประตู(八門) and เทพ(十神) that land on a cell share that same element, the three powers align →
//     the cell deepens one shade + a ⚡ "พลังแรง" mark. That is an element-match fact, NOT a claim about how
//     good the gate is. (See cellElementTint / DIR_ELEMENT in gate-compass.ts.)
//
// The other highlight is a different fact, labelled as such: `luckyDirection` (ทิศมงคล) is its own almanac
// field, marked on that direction with its own legend. It is not a claim about that gate.
import { useMemo, useState } from 'react'
import type { DayDetailGate } from '../../types'
import { SectionCard } from './SectionCard'
import { SPIRIT_STYLE } from './EightDeities'
import {
  DIR_CELL, CENTER, placeGates, cellElementTint, GATE_ELEMENT, ELEMENT_TINT,
  DIR_LABEL_TH, type Direction,
} from './gate-compass'

// สีของ chip อักษรประตูในลิสต์คีย์เวิร์ด = สีตามธาตุของประตูนั้น (五行 ของ 八門) — ให้ตรงกับสีธาตุบนเข็มทิศ.
const gateChipTint = (glyph: string): { bg: string; ink: string } => {
  const el = GATE_ELEMENT[glyph.trim()]
  return el ? { bg: ELEMENT_TINT[el].bg, ink: ELEMENT_TINT[el].ink } : { bg: '#F5F7FB', ink: '#0B305B' }
}

function GateCell({ direction, gate, highlight }: { direction: Direction; gate: DayDetailGate; highlight?: boolean }) {
  const cell = DIR_CELL[direction]
  // สีพื้น/เฉด = ธาตุของทิศ (เข้มขึ้นเมื่อธาตุ ประตู+เทพ+ทิศ ตรงกัน — cellElementTint). ⚡ = พลังแรง.
  const tint = cellElementTint(direction, gate.name, gate.deity)
  // ผู้ใช้ 2026-09-12: "เอาชื่อ(เทพ)ขึ้นก่อนตัวอักษรจีน และชื่อไทยใส่สีตามพลัง" — ชื่อเทพ 十神 นำหน้า (บน),
  // ทาสีตามพลังเทพ (SPIRIT_STYLE.ink); อักษรจีนประตูอยู่ล่าง. ไม่มี deity → ใช้ความหมายประตู + สีธาตุทิศ.
  const deityStyle = gate.deity ? SPIRIT_STYLE[gate.deity.trim()] : undefined
  const leadName = deityStyle?.th ?? gate.deity?.trim() ?? gate.meaning
  const leadInk = deityStyle?.ink ?? tint.ink
  return (
    <div
      data-testid="gate-cell"
      data-dir={direction}
      data-strong={tint.strong ? '1' : undefined}
      data-match={highlight ? '1' : undefined}
      // explicit coordinates — the whole point. Source order is now irrelevant to where this paints.
      style={{
        gridRow: cell.row,
        gridColumn: cell.col,
        backgroundColor: tint.bg,
        color: tint.ink,
      }}
      className={`relative flex flex-col items-center gap-0.5 rounded-2xl px-1 py-3 leading-none transition-shadow${
        highlight ? ' ring-2 ring-offset-1 ring-v3-sapphire' : ''
      }`}
    >
      {/* ผู้ใช้ 2026-09-12: "พลังแรง" บอกด้วยสีเข้มขึ้น (bgStrong) อย่างเดียว — ไม่มีไอคอน ⚡ */}
      <span className="text-[10px] font-bold text-v3-text-body">{direction}</span>
      <span className="text-[15px] font-extrabold leading-tight" style={{ color: leadInk }}>{leadName}</span>
      <span className="text-xl font-bold leading-none" style={{ color: tint.ink }}>{gate.name}</span>
    </div>
  )
}

// ── ข้อ 8: ช่องค้นหาบนตารางประตู — พิมพ์สิ่งที่จะทำ (เช่น "เปิดบริษัท") → เน้นประตู/บอกทิศที่ควรไป ─────────
const normSearch = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '')

/** แชร์ substring ยาว ≥ min ตัวอักษร — ช่วยจับคำใกล้เคียงแบบไม่ต้องตรงเป๊ะ (ภาษาไทยไม่มีเว้นวรรค).
 *  เช่น "ขอเงิน" ↔ "เงินทองงอกเงย" (แชร์ "เงิน"), "เปิดบริษัท" ↔ "เปิด". */
function sharesSubstring(a: string, b: string, min = 3): boolean {
  if (a.length < min || b.length < min) return false
  for (let i = 0; i + min <= a.length; i++) {
    for (let len = min; i + len <= a.length; len++) {
      if (b.includes(a.slice(i, i + len))) return true
    }
  }
  return false
}

/** สร้างดัชนีค้นหาจากประตูที่วางบนเข็มทิศ + จับคู่ query แบบ substring สองทาง + คำใกล้เคียง (แชร์คำ ≥3 ตัว). */
function useGateSearch(placed: { direction: Direction; gate: DayDetailGate }[], query: string) {
  return useMemo(() => {
    const nq = normSearch(query)
    if (!nq) return { active: false, dirs: new Set<Direction>(), rows: [] as { direction: Direction; gate: DayDetailGate }[] }
    const rows: { direction: Direction; gate: DayDetailGate }[] = []
    const dirs = new Set<Direction>()
    for (const p of placed) {
      const hay = [p.gate.meaning, ...(p.gate.keywords ?? [])].map(normSearch).filter(Boolean)
      // เจอเมื่อ keyword/ความหมาย มี query, หรือ query มี keyword, หรือแชร์คำยาว ≥3 ตัว (คำใกล้เคียง)
      if (hay.some((h) => h.includes(nq) || nq.includes(h) || sharesSubstring(nq, h))) {
        rows.push({ direction: p.direction, gate: p.gate })
        dirs.add(p.direction)
      }
    }
    return { active: true, dirs, rows }
  }, [placed, query])
}

function GateSearch({
  placed,
  query,
  setQuery,
}: {
  placed: { direction: Direction; gate: DayDetailGate }[]
  query: string
  setQuery: (v: string) => void
}) {
  const { active, rows } = useGateSearch(placed, query)
  // ชิปแนะนำ = คีย์เวิร์ดจากประตูของวันนี้ (สูงสุด 8) — คลิกเพื่อค้นด้วยคำนั้น
  const suggestions = useMemo(() => {
    const set = new Set<string>()
    for (const p of placed) for (const k of p.gate.keywords ?? []) { if (k) set.add(k); if (set.size >= 8) break }
    return Array.from(set).slice(0, 8)
  }, [placed])
  const notFound = active && rows.length === 0
  return (
    <div data-testid="gate-search" className="mb-3">
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-v3-text-muted">🔍</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="พิมพ์สิ่งที่จะทำ เช่น เปิดบริษัท / ขอเงิน"
          aria-label="ค้นหาว่าควรไปทิศไหน"
          className="w-full rounded-xl border border-v3-divider bg-white py-2.5 pl-9 pr-3 text-sm text-v3-navy placeholder:text-v3-text-muted focus:border-v3-sapphire focus:outline-none"
        />
      </div>
      {active && rows.length > 0 && (
        <ul data-testid="gate-search-hit" className="mt-2 flex flex-col gap-1">
          {rows.map((r, i) => (
            <li key={`${r.direction}-${i}`} className="text-xs leading-5 text-v3-navy">
              ควรไปทิศ <b>{DIR_LABEL_TH[r.direction]}</b> ({r.direction}) · ประตู <b>{r.gate.meaning || r.gate.name}</b>
            </li>
          ))}
        </ul>
      )}
      {notFound && (
        <p data-testid="gate-search-empty" className="mt-2 text-xs leading-5 text-v3-text-body">
          ไม่พบคำนี้ — ลองแตะคำแนะนำด้านล่าง หรือพิมพ์ให้ใกล้เคียงขึ้น
        </p>
      )}
      {/* ผู้ใช้ 2026-09-12: "คำแนะนำไม่มีเลยถ้าไม่ใช่คีย์ ใช้ยาก" → โชว์ชิปคำค้นตลอด (แม้ยังไม่พิมพ์)
          เพื่อให้กดใช้ได้ทันทีโดยไม่ต้องเดาคีย์เวิร์ด */}
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-v3-text-muted">ลองค้นหา:</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setQuery(s)}
              className="rounded-full bg-v3-cal-medium-bg px-2.5 py-1 text-[11px] leading-none text-v3-navy"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function EightGates({ gates }: { gates: DayDetailGate[] }) {
  const { placed, unplaced } = placeGates(gates)
  const [query, setQuery] = useState('')
  const { dirs: matchedDirs } = useGateSearch(placed, query)
  // แสดงเฉพาะประตูที่มีคีย์เวิร์ด (engine ส่ง gate-keyword.json มา) — ก่อน engine deploy = ว่าง → ซ่อนลิสต์เงียบๆ
  const gatesWithKeywords = gates.filter((g) => (g.keywords?.length ?? 0) > 0)
  return (
    <SectionCard title="ประตู · เทพ · ทิศ · ประจำวัน" testId="eight-gates">
      {/* ข้อ 4: หัวข้อรวม "ประตู · เทพ · ทิศ · ประจำวัน" (SectionCard title) เหนือ subtitle เดิม + ช่องค้นหา */}
      <p className="mb-2 text-xs font-semibold text-v3-text-muted">8 ประตู 八門 · ทิศประจำวัน</p>

      {/* ข้อ 8: ช่องค้นหา — วางเหนือเข็มทิศ ตามที่ผู้ใช้วาด (รูป 9) */}
      {placed.length > 0 && <GateSearch placed={placed} query={query} setQuery={setQuery} />}

      <div data-testid="gate-board" className="grid grid-cols-3 grid-rows-3 gap-2">
        {placed.map((p) => (
          <GateCell key={p.direction} direction={p.direction} gate={p.gate} highlight={matchedDirs.has(p.direction)} />
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
        · พื้นช่องคือธาตุของทิศ · ช่องสีเข้มกว่า = ธาตุ ประตู·เทพ·ทิศ ตรงกัน (พลังแรง)
      </p>

      {/* "8 ประตู · คีย์เวิร์ด · การกระทำ" — ลิสต์ใต้เข็มทิศ เหมือน "10 เทพ · คีย์เวิร์ด" (ผู้ใช้ 2026-09-12).
          chip = อักษรจีนประตู (สีตามธาตุของประตู) · ชื่อไทยประตูทาสีธาตุ · คีย์เวิร์ดจาก engine (gate-keyword.json). */}
      {gatesWithKeywords.length > 0 && (
        <div className="mt-4 border-t border-dashed border-v3-divider-dashed pt-4">
          <p className="mb-3 text-sm font-bold text-v3-navy">8 ประตู 八門 · คีย์เวิร์ด · การกระทำ</p>
          <ul className="flex flex-col gap-3.5">
            {gatesWithKeywords.map((g, i) => {
              const tint = gateChipTint(g.name)
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
