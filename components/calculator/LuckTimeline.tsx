import { useState } from 'react'
import { elementColor, elementLabel } from '@/lib/calculator/elements'
import type { AnnualLuckItem, DecadeLuckItem } from '@/lib/calculator/map-timeline'

function ScrubStrip<T>({
  items,
  selectedIndex,
  onSelect,
  renderLabel,
  renderGlyph,
  testId,
}: {
  items: T[]
  selectedIndex: number
  onSelect: (i: number) => void
  renderLabel: (item: T) => string
  renderGlyph: (item: T) => { char: string; color: string }
  testId: string
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2" data-testid={testId}>
      {items.map((item, i) => {
        const active = i === selectedIndex
        const g = renderGlyph(item)
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            className={
              'flex shrink-0 flex-col items-center rounded-xl border px-3 py-2 ' +
              (active ? 'border-2 border-moumate_blue bg-moumate_blue_light' : 'border-border_gray bg-moumate_white')
            }
          >
            <span className="text-[20px] leading-none" style={{ color: g.color }}>
              {g.char}
            </span>
            <span className="mt-1 text-[11px] text-calc_muted">{renderLabel(item)}</span>
          </button>
        )
      })}
    </div>
  )
}

// F4 — วัยจร (decade) + ปีจร (annual) as scrub timelines, not a static table. Tap an entry to
// see its pillar (above+below, F3-style glyph pair) compared against ดิถี.
export function LuckTimeline({
  decades,
  annual,
}: {
  decades: DecadeLuckItem[]
  annual: AnnualLuckItem[]
}) {
  const initialDecade = Math.max(
    0,
    decades.findIndex((d) => d.isCurrent),
  )
  const [decadeIndex, setDecadeIndex] = useState(initialDecade)
  const [yearIndex, setYearIndex] = useState(0)

  const selectedDecade = decades[decadeIndex]
  const selectedYear = annual[yearIndex]

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6" data-testid="luck-timeline">
      <section>
        <h2 className="mb-2 font-ibm text-sm font-semibold text-moumate_black">วัยจร</h2>
        <ScrubStrip
          items={decades}
          selectedIndex={decadeIndex}
          onSelect={setDecadeIndex}
          renderLabel={(d) => `${d.ageStart}-${d.ageEnd}`}
          renderGlyph={(d) => ({ char: d.chinese_symbol, color: elementColor(d.element) })}
          testId="decade-strip"
        />
        {selectedDecade && (
          <p className="mt-2 font-ibm text-sm text-calc_muted">
            ช่วงอายุ {selectedDecade.ageStart}-{selectedDecade.ageEnd} ปี · {elementLabel(selectedDecade.element)}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-ibm text-sm font-semibold text-moumate_black">ปีจร</h2>
        <ScrubStrip
          items={annual}
          selectedIndex={yearIndex}
          onSelect={setYearIndex}
          renderLabel={(y) => `+${y.year}`}
          renderGlyph={(y) => ({ char: y.above.chinese_symbol, color: elementColor(y.above.element) })}
          testId="annual-strip"
        />
        {selectedYear && (
          <div className="mt-3 flex items-center justify-center gap-4">
            <div className="flex flex-col items-center">
              <span className="text-[28px] leading-none" style={{ color: elementColor(selectedYear.above.element) }}>
                {selectedYear.above.chinese_symbol}
              </span>
              <span className="text-[28px] leading-none" style={{ color: elementColor(selectedYear.below.element) }}>
                {selectedYear.below.chinese_symbol}
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
