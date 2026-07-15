import { useState } from 'react'
import { elementColor, elementLabel } from '@/lib/calculator/elements'
import type { AnnualLuckItem, DecadeLuckItem } from '@/lib/calculator/map-timeline'
import { findDecadePhasePair, findLiuNianForYear } from '@/lib/calculator/map-enrichment'
import { displayQi, displayReaction } from '@/lib/calculator/enrichment-labels'
import type { Enrichment } from '@/pages/api/calculator/compute'
import { BadgeMarker } from '@/components/calculator/BadgeMarker'
import { DetailSheet } from '@/components/calculator/DetailSheet'
import { capBadges, findAnnualBadge, findDecadeBadge, type BadgePoint } from '@/lib/calculator/badges'

const TIMELINE_BADGE_CAP = 4

// F4 — วัยจร (decade) + ปีจร (annual) as swipeable card strips. Each card shows its glyph + 12-qi
// (เชี่ยงแซ) at a glance; tapping opens the DetailSheet with the full role/reaction/clash breakdown
// ("เทียบดิถี", fact-only, never prediction). The old inline "ดูรายละเอียด" toggle + tier2 panel was
// removed per ฟีม — the card IS the trigger now.
//
// `enrichment` is optional/null (bazi-sft-dataset call failed/timed out) — the strips still render
// with just the base pillars in that case; cards without detail are non-interactive.
function StageChip({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-border_gray bg-bg_gray/50 px-2 py-0.5 font-ibm text-[10.5px] leading-none text-moumate_black">
      {text}
    </span>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border_gray py-2 font-ibm text-[13px] last:border-b-0">
      <span className="text-calc_muted">{label}</span>
      <span className="text-moumate_black">{value}</span>
    </div>
  )
}

type SheetTarget = { kind: 'decade' | 'annual'; index: number } | null

export function LuckTimeline({
  decades,
  annual,
  enrichment,
}: {
  decades: DecadeLuckItem[]
  annual: AnnualLuckItem[]
  enrichment?: Enrichment | null
}) {
  const initialDecade = Math.max(0, decades.findIndex((d) => d.isCurrent))
  const [decadeIndex, setDecadeIndex] = useState(initialDecade)
  const [yearIndex, setYearIndex] = useState(0)
  const [sheet, setSheet] = useState<SheetTarget>(null)

  // Signal-gated timeline badges, ≤4 combined across decade+annual (มุน design, FRD §5) — capped
  // BEFORE either strip renders so the two strips share one ceiling, not 4 each.
  const timelineBadgeCandidates = (enrichment?.badges ?? []).filter(
    (b) => b.point.startsWith('decade-') || b.point.startsWith('annual-'),
  )
  const { shown: shownTimelineBadges, overflow: timelineBadgeOverflow } = capBadges(timelineBadgeCandidates, TIMELINE_BADGE_CAP)

  const decadeQi = (d: DecadeLuckItem): string | undefined => {
    if (!enrichment) return undefined
    const pair = findDecadePhasePair(enrichment.daYun, d)
    return pair.upper ? displayQi(pair.upper.qi) : undefined
  }
  const annualQi = (y: AnnualLuckItem): string | undefined => {
    if (!enrichment) return undefined
    const row = findLiuNianForYear(enrichment.liuNian, y)
    return row ? displayQi(row.qi) : undefined
  }

  const openSheet = (kind: 'decade' | 'annual', index: number) => {
    if (kind === 'decade') setDecadeIndex(index)
    else setYearIndex(index)
    setSheet({ kind, index })
  }

  // --- sheet content ---
  const sheetDecade = sheet?.kind === 'decade' ? decades[sheet.index] : undefined
  const sheetDecadePhases = enrichment && sheetDecade ? findDecadePhasePair(enrichment.daYun, sheetDecade) : {}
  const sheetAnnual = sheet?.kind === 'annual' ? annual[sheet.index] : undefined
  const sheetAnnualRow = enrichment && sheetAnnual ? findLiuNianForYear(enrichment.liuNian, sheetAnnual) : undefined

  return (
    <div className="w-full space-y-6" data-testid="luck-timeline">
      {/* วัยจร */}
      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <h2 className="font-prompt text-[15px] font-semibold text-moumate_black">วัยจร</h2>
          <span className="ml-auto font-ibm text-[11px] text-calc_muted">แตะช่วงอายุเพื่อดูรายละเอียด</span>
        </div>
        <div className="flex gap-2.5 overflow-x-auto pb-2" data-testid="decade-strip" style={{ scrollSnapType: 'x mandatory' }}>
          {decades.map((d, i) => {
            const active = i === decadeIndex
            const qi = decadeQi(d)
            const badge = enrichment ? findDecadeBadge(shownTimelineBadges, enrichment.daYun, d.ageStart) : undefined
            const interactive = Boolean(qi || (enrichment && findDecadePhasePair(enrichment.daYun, d).upper))
            return (
              <div key={i} className="relative shrink-0" style={{ scrollSnapAlign: 'start' }}>
                <button
                  type="button"
                  disabled={!interactive}
                  onClick={() => openSheet('decade', i)}
                  className={
                    'flex min-w-[92px] flex-col items-center gap-2 rounded-2xl border px-3 py-3 transition-colors ' +
                    (active
                      ? 'border-2 border-moumate_blue bg-moumate_blue_light'
                      : 'border-border_gray bg-moumate_white') +
                    (interactive ? '' : ' cursor-default opacity-90')
                  }
                >
                  <span className="font-ibm text-[11px] font-semibold text-calc_muted">
                    {d.ageStart}-{d.ageEnd}
                  </span>
                  <span className="font-chonburi text-[23px] leading-none" style={{ color: elementColor(d.element) }}>
                    {d.chinese_symbol}
                  </span>
                  {qi ? <StageChip text={qi} /> : <span className="h-[17px]" />}
                </button>
                {badge && <BadgeMarker badge={badge} size={20} />}
              </div>
            )
          })}
        </div>
      </section>

      {/* ปีจร */}
      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <h2 className="font-prompt text-[15px] font-semibold text-moumate_black">ปีจร</h2>
          <span className="ml-auto font-ibm text-[11px] text-calc_muted">แตะปีเพื่อดูรายละเอียด</span>
        </div>
        <div className="flex gap-2.5 overflow-x-auto pb-2" data-testid="annual-strip" style={{ scrollSnapType: 'x mandatory' }}>
          {annual.map((y, i) => {
            const active = i === yearIndex
            const qi = annualQi(y)
            const badge = enrichment ? findAnnualBadge(shownTimelineBadges, y.year) : undefined
            const row = enrichment ? findLiuNianForYear(enrichment.liuNian, y) : undefined
            const interactive = Boolean(row)
            return (
              <div key={i} className="relative shrink-0" style={{ scrollSnapAlign: 'start' }}>
                <button
                  type="button"
                  disabled={!interactive}
                  onClick={() => openSheet('annual', i)}
                  className={
                    'flex min-w-[92px] flex-col items-center gap-2 rounded-2xl border px-3 py-3 transition-colors ' +
                    (active
                      ? 'border-2 border-moumate_blue bg-moumate_blue_light'
                      : 'border-border_gray bg-moumate_white') +
                    (interactive ? '' : ' cursor-default opacity-90')
                  }
                >
                  <span className="font-ibm text-[11px] font-semibold text-calc_muted">+{y.year}</span>
                  <span className="font-chonburi text-[23px] leading-none" style={{ color: elementColor(y.above.element) }}>
                    {y.above.chinese_symbol}
                  </span>
                  {qi ? <StageChip text={qi} /> : <span className="h-[17px]" />}
                </button>
                {badge && <BadgeMarker badge={badge} size={20} />}
              </div>
            )
          })}
        </div>
        {timelineBadgeOverflow > 0 && (
          <p className="mt-1 text-right font-ibm text-[11px] text-calc_muted" data-testid="timeline-badge-overflow">
            +{timelineBadgeOverflow} เพิ่มเติม
          </p>
        )}
      </section>

      {/* tap-to-expand detail (replaces the removed "ดูรายละเอียด" toggle) */}
      <DetailSheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        kicker={
          sheetDecade
            ? `วัยจร · เทียบดิถี`
            : sheetAnnual
              ? `ปีจร · เทียบดิถี`
              : undefined
        }
        title={
          sheetDecade
            ? `ช่วงอายุ ${sheetDecade.ageStart}-${sheetDecade.ageEnd} ปี`
            : sheetAnnual
              ? `${sheetAnnual.above.chinese_symbol}${sheetAnnual.below.chinese_symbol} · อีก ${sheetAnnual.year} ปี`
              : ''
        }
      >
        {sheetDecade && (
          <div className="space-y-3" data-testid="decade-sheet">
            <p className="font-ibm text-[13px] text-calc_muted">{elementLabel(sheetDecade.element)}</p>
            {sheetDecadePhases.upper && (
              <div className="rounded-xl border border-border_gray bg-bg_gray/40 p-3">
                <p className="mb-1 font-ibm text-xs font-semibold text-calc_muted">
                  {sheetDecadePhases.upper.ageRange} · {sheetDecadePhases.upper.place}
                </p>
                <DetailRow label="สัญลักษณ์" value={`${sheetDecadePhases.upper.symbol} · ${sheetDecadePhases.upper.element}`} />
                <DetailRow label="เชี่ยงแซ" value={displayQi(sheetDecadePhases.upper.qi)} />
                <DetailRow label="ปฏิกิริยา (ดิถี)" value={displayReaction(sheetDecadePhases.upper.reaction)} />
              </div>
            )}
            {sheetDecadePhases.lower && (
              <div className="rounded-xl border border-border_gray bg-bg_gray/40 p-3">
                <p className="mb-1 font-ibm text-xs font-semibold text-calc_muted">
                  {sheetDecadePhases.lower.ageRange} · {sheetDecadePhases.lower.place}
                </p>
                <DetailRow label="สัญลักษณ์" value={`${sheetDecadePhases.lower.symbol} · ${sheetDecadePhases.lower.element}`} />
                <DetailRow label="เชี่ยงแซ" value={displayQi(sheetDecadePhases.lower.qi)} />
                <DetailRow label="ปฏิกิริยา (ดิถี)" value={displayReaction(sheetDecadePhases.lower.reaction)} />
              </div>
            )}
            <p className="text-center font-ibm text-[11px] text-calc_muted">ข้อมูลเชิงโครงสร้าง — ไม่ใช่คำทำนาย</p>
          </div>
        )}

        {sheetAnnual && (
          <div className="space-y-3" data-testid="annual-sheet">
            <div className="flex items-center justify-center gap-4">
              <span className="font-chonburi text-[30px] leading-none" style={{ color: elementColor(sheetAnnual.above.element) }}>
                {sheetAnnual.above.chinese_symbol}
              </span>
              <span className="font-chonburi text-[30px] leading-none" style={{ color: elementColor(sheetAnnual.below.element) }}>
                {sheetAnnual.below.chinese_symbol}
              </span>
            </div>
            {sheetAnnualRow && (
              <div className="rounded-xl border border-border_gray bg-bg_gray/40 p-3">
                <DetailRow label="เชี่ยงแซ" value={displayQi(sheetAnnualRow.qi)} />
                <DetailRow label="ปฏิกิริยา (ดิถี)" value={displayReaction(sheetAnnualRow.reaction)} />
                {(sheetAnnualRow.clash || sheetAnnualRow.harm) && (
                  <DetailRow label="สัญญาณ" value={sheetAnnualRow.clash ? 'ปีนี้ชนดิถี' : 'ปีนี้ให้ร้ายกับดิถี'} />
                )}
              </div>
            )}
            <p className="text-center font-ibm text-[11px] text-calc_muted">ข้อมูลเชิงโครงสร้าง — ไม่ใช่คำทำนาย</p>
          </div>
        )}
      </DetailSheet>
    </div>
  )
}
