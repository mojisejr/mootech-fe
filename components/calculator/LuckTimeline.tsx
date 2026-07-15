import { useState } from 'react'
import { elementColor, elementLabel } from '@/lib/calculator/elements'
import type { AnnualLuckItem, DecadeLuckItem } from '@/lib/calculator/map-timeline'
import { findDecadePhasePair, findLiuNianForYear, thaiToBaziElement } from '@/lib/calculator/map-enrichment'
import { displayQi, displayReaction } from '@/lib/calculator/enrichment-labels'
import type { Enrichment } from '@/pages/api/calculator/compute'
import { BadgeMarker } from '@/components/calculator/BadgeMarker'
import { capBadges, findAnnualBadge, findDecadeBadge, type BadgePoint } from '@/lib/calculator/badges'

const TIMELINE_BADGE_CAP = 4

function ScrubStrip<T>({
  items,
  selectedIndex,
  onSelect,
  renderLabel,
  renderGlyph,
  renderMarker,
  renderBadge,
  testId,
}: {
  items: T[]
  selectedIndex: number
  onSelect: (i: number) => void
  renderLabel: (item: T) => string
  renderGlyph: (item: T) => { char: string; color: string }
  renderMarker?: (item: T) => string | undefined
  renderBadge?: (item: T) => BadgePoint | undefined
  testId: string
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2" data-testid={testId}>
      {items.map((item, i) => {
        const active = i === selectedIndex
        const g = renderGlyph(item)
        const badge = renderBadge?.(item)
        const markerColor = badge ? undefined : renderMarker?.(item)
        return (
          // Signal-gated badge marker is its own <button> (tappable, popover) — kept as a SIBLING
          // of the select-button, never nested, since <button> inside <button> is invalid HTML.
          <div key={i} className="relative shrink-0">
            <button
              type="button"
              onClick={() => onSelect(i)}
              className={
                'flex flex-col items-center rounded-xl border px-3 py-2 ' +
                (active ? 'border-2 border-moumate_blue bg-moumate_blue_light' : 'border-border_gray bg-moumate_white')
              }
            >
              {markerColor && (
                <span
                  aria-hidden="true"
                  className="absolute right-1.5 top-1.5 h-[6px] w-[6px] rounded-full"
                  style={{ backgroundColor: markerColor }}
                />
              )}
              <span className="text-[20px] leading-none" style={{ color: g.color }}>
                {g.char}
              </span>
              <span className="mt-1 text-[11px] text-calc_muted">{renderLabel(item)}</span>
            </button>
            {badge && <BadgeMarker badge={badge} size={16} />}
          </div>
        )
      })}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border_gray py-1.5 text-sm last:border-b-0">
      <span className="text-calc_muted">{label}</span>
      <span className="text-moumate_black">{value}</span>
    </div>
  )
}

// F4 — วัยจร (decade) + ปีจร (annual) as scrub timelines, not a static table. Tap an entry to
// see its pillar (above+below, F3-style glyph pair) compared against ดิถี.
//
// 3-tier progressive disclosure (#calculator-enrichment-FROZEN-v1, too+มุน scope): Tier0 strip
// unchanged (+ small reaction marker dot) → Tier1 summary line (12-qi + reaction, auto-shown on
// select) → Tier2 tap-to-expand (5yr upper/lower split + clash/harm flag). `enrichment` is
// optional and can be null (bazi-sft-dataset call failed/timed out) — timeline still works with
// just the base pillars in that case, same as before this feature existed. No 0-3 star grade
// anywhere here — that was explicitly cut (interpretation, not calculation).
export function LuckTimeline({
  decades,
  annual,
  enrichment,
}: {
  decades: DecadeLuckItem[]
  annual: AnnualLuckItem[]
  enrichment?: Enrichment | null
}) {
  const initialDecade = Math.max(
    0,
    decades.findIndex((d) => d.isCurrent),
  )
  const [decadeIndex, setDecadeIndex] = useState(initialDecade)
  const [yearIndex, setYearIndex] = useState(0)
  const [decadeExpanded, setDecadeExpanded] = useState(false)

  const selectedDecade = decades[decadeIndex]
  const selectedYear = annual[yearIndex]

  const decadePhases = enrichment && selectedDecade ? findDecadePhasePair(enrichment.daYun, selectedDecade) : {}
  const yearEnrichment = enrichment && selectedYear ? findLiuNianForYear(enrichment.liuNian, selectedYear) : undefined

  // Signal-gated timeline badges, ≤4 combined across decade+annual (มุน design, FRD §5) — capped
  // BEFORE either strip renders so the two strips share one ceiling, not 4 each.
  const timelineBadgeCandidates = (enrichment?.badges ?? []).filter(
    (b) => b.point.startsWith('decade-') || b.point.startsWith('annual-'),
  )
  const { shown: shownTimelineBadges, overflow: timelineBadgeOverflow } = capBadges(timelineBadgeCandidates, TIMELINE_BADGE_CAP)

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6" data-testid="luck-timeline">
      <section>
        <h2 className="mb-2 font-ibm text-sm font-semibold text-moumate_black">วัยจร</h2>
        <ScrubStrip
          items={decades}
          selectedIndex={decadeIndex}
          onSelect={(i) => {
            setDecadeIndex(i)
            setDecadeExpanded(false)
          }}
          renderLabel={(d) => `${d.ageStart}-${d.ageEnd}`}
          renderGlyph={(d) => ({ char: d.chinese_symbol, color: elementColor(d.element) })}
          renderMarker={
            enrichment
              ? (d) => {
                  const pair = findDecadePhasePair(enrichment.daYun, d)
                  const el = pair.upper ? thaiToBaziElement(pair.upper.element) : undefined
                  return el ? elementColor(el) : undefined
                }
              : undefined
          }
          renderBadge={
            enrichment ? (d) => findDecadeBadge(shownTimelineBadges, enrichment.daYun, d.ageStart) : undefined
          }
          testId="decade-strip"
        />
        {selectedDecade && (
          <div className="mt-2 space-y-2">
            <p className="font-ibm text-sm text-calc_muted" data-testid="decade-tier1">
              ช่วงอายุ {selectedDecade.ageStart}-{selectedDecade.ageEnd} ปี · {elementLabel(selectedDecade.element)}
              {decadePhases.upper && (
                <>
                  {' '}
                  · เชี่ยงแซ: {displayQi(decadePhases.upper.qi)} · {displayReaction(decadePhases.upper.reaction)} (ดิถี)
                </>
              )}
            </p>
            {(decadePhases.upper || decadePhases.lower) && (
              <>
                <button
                  type="button"
                  onClick={() => setDecadeExpanded((v) => !v)}
                  className="font-ibm text-xs text-moumate_blue underline underline-offset-2"
                  data-testid="decade-expand-toggle"
                >
                  {decadeExpanded ? 'ซ่อนรายละเอียด ⌃' : 'ดูรายละเอียด ⌄'}
                </button>
                {decadeExpanded && (
                  <div className="rounded-lg border border-border_gray bg-bg_gray/40 p-3" data-testid="decade-tier2">
                    {decadePhases.upper && (
                      <div className="mb-2">
                        <p className="mb-1 text-xs font-semibold text-calc_muted">
                          {decadePhases.upper.ageRange} ({decadePhases.upper.place})
                        </p>
                        <DetailRow label="สัญลักษณ์" value={`${decadePhases.upper.symbol} · ${decadePhases.upper.element}`} />
                        <DetailRow label="เชี่ยงแซ" value={displayQi(decadePhases.upper.qi)} />
                        <DetailRow label="ปฏิกิริยา (ดิถี)" value={displayReaction(decadePhases.upper.reaction)} />
                      </div>
                    )}
                    {decadePhases.lower && (
                      <div>
                        <p className="mb-1 text-xs font-semibold text-calc_muted">
                          {decadePhases.lower.ageRange} ({decadePhases.lower.place})
                        </p>
                        <DetailRow label="สัญลักษณ์" value={`${decadePhases.lower.symbol} · ${decadePhases.lower.element}`} />
                        <DetailRow label="เชี่ยงแซ" value={displayQi(decadePhases.lower.qi)} />
                        <DetailRow label="ปฏิกิริยา (ดิถี)" value={displayReaction(decadePhases.lower.reaction)} />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
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
          renderMarker={
            enrichment
              ? (y) => {
                  const row = findLiuNianForYear(enrichment.liuNian, y)
                  return row && (row.clash || row.harm) ? '#8B5F20' : undefined
                }
              : undefined
          }
          renderBadge={enrichment ? (y) => findAnnualBadge(shownTimelineBadges, y.year) : undefined}
          testId="annual-strip"
        />
        {timelineBadgeOverflow > 0 && (
          <p className="mt-1 text-right font-ibm text-[11px] text-calc_muted" data-testid="timeline-badge-overflow">
            +{timelineBadgeOverflow} เพิ่มเติม
          </p>
        )}
        {selectedYear && (
          <div className="mt-3">
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center">
                <span className="text-[28px] leading-none" style={{ color: elementColor(selectedYear.above.element) }}>
                  {selectedYear.above.chinese_symbol}
                </span>
                <span className="text-[28px] leading-none" style={{ color: elementColor(selectedYear.below.element) }}>
                  {selectedYear.below.chinese_symbol}
                </span>
              </div>
            </div>
            {yearEnrichment && (
              <p className="mt-2 text-center font-ibm text-sm text-calc_muted" data-testid="annual-tier1">
                เชี่ยงแซ: {displayQi(yearEnrichment.qi)} · {displayReaction(yearEnrichment.reaction)} (ดิถี)
                {(yearEnrichment.clash || yearEnrichment.harm) && (
                  <>
                    {' '}
                    · {yearEnrichment.clash ? 'ปีนี้ชนดิถี' : 'ปีนี้ให้ร้ายกับดิถี'}
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
