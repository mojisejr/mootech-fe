import { useEffect, useRef, useState } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'
import { elementColor, elementLabel } from '@/lib/calculator/elements'
import { hexToRgba } from '@/lib/calculator/color'
import type { AnnualLuckItem, DecadeLuckItem } from '@/lib/calculator/map-timeline'
import { findDecadePhasePair, findLiuNianForYear, thaiToBaziElement } from '@/lib/calculator/map-enrichment'
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

type Glyph = { sym: string; color: string }

function CurrentCard({
  label,
  sub,
  above,
  below,
  qi,
}: {
  label: string
  sub: string
  above: Glyph
  below?: Glyph
  qi?: string
}) {
  return (
    <div
      className="flex flex-col items-center gap-1.5 rounded-2xl border bg-white/90 p-3 shadow-custom backdrop-blur-md"
      style={{ borderColor: hexToRgba(above.color, 0.4) }}
    >
      <span className="font-prompt text-[13px] font-semibold text-moumate_black">{label}</span>
      <span className="font-ibm text-[11px] text-calc_muted">{sub}</span>
      <div className="flex flex-col items-center leading-none">
        <span className="font-chonburi text-[28px]" style={{ color: above.color }}>
          {above.sym}
        </span>
        {below && (
          <span className="font-chonburi text-[28px]" style={{ color: below.color }}>
            {below.sym}
          </span>
        )}
      </div>
      {qi && <StageChip text={qi} />}
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

  // ราศีบน + ล่าง for a decade. When enriched, BOTH come from bazi-sft's daYun pair (same engine as
  // the qi) — mootech-be's DecadeLuckItem only carries the stem, so the branch needs the pair anyway.
  const decadeGlyphs = (d: DecadeLuckItem): { above: Glyph; below?: Glyph } => {
    if (enrichment) {
      const pair = findDecadePhasePair(enrichment.daYun, d)
      if (pair.upper) {
        return {
          above: { sym: pair.upper.symbol, color: elementColor(thaiToBaziElement(pair.upper.element)) },
          below: pair.lower ? { sym: pair.lower.symbol, color: elementColor(thaiToBaziElement(pair.lower.element)) } : undefined,
        }
      }
    }
    return { above: { sym: d.chinese_symbol, color: elementColor(d.element) } }
  }
  // ค.ศ. + พ.ศ. for an annual year (real calendar year lives on the matched liuNian row).
  const annualYears = (y: AnnualLuckItem): { ce: number; be: number } | null => {
    if (!enrichment) return null
    const row = findLiuNianForYear(enrichment.liuNian, y)
    return row ? { ce: row.year, be: row.year + 543 } : null
  }

  // 2 "ตอนนี้" summary cards — prominent but frosted + element-accent only (NOT element-filled), so
  // priority stays: ดิถี hero ≫ current cards > strips (มุน balance per freeze).
  const currentDecade = decades.find((d) => d.isCurrent)
  const currentAnnual = annual[0]

  // ③/C When the timeline first scrolls into view, the two strips ROLL-CONVERGE on "now": each
  // animates its scrollLeft to center its CURRENT card, but from OPPOSITE starting edges — วัยจร
  // rolls in from the left, ปีจร rolls in from the right — so they meet at the present. This also
  // fixes ปีจร (current = index 0 = already at the start → scrollIntoView produced no motion): we
  // start it fully scrolled right and roll left to current. reduced-motion → jump, no roll.
  const prefersReducedMotion = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const inView = useInView(rootRef, { once: true, amount: 0.2 })
  const decadeStripRef = useRef<HTMLDivElement>(null)
  const annualStripRef = useRef<HTMLDivElement>(null)
  const decadeCurRef = useRef<HTMLDivElement>(null)
  const annualCurRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!inView) return
    // center a card within its strip (clamped to the scrollable range)
    const centerTarget = (strip: HTMLDivElement, card: HTMLDivElement) => {
      const max = strip.scrollWidth - strip.clientWidth
      const raw = card.offsetLeft - (strip.clientWidth - card.clientWidth) / 2
      return Math.max(0, Math.min(raw, max))
    }
    const rollTo = (strip: HTMLDivElement | null, card: HTMLDivElement | null, from: 'left' | 'right') => {
      if (!strip || !card) return
      const target = centerTarget(strip, card)
      if (prefersReducedMotion) {
        strip.scrollLeft = target
        return
      }
      const start = from === 'left' ? 0 : strip.scrollWidth - strip.clientWidth
      // snap fights a programmatic scrollLeft tween — disable it for the roll, restore after
      strip.style.scrollSnapType = 'none'
      strip.scrollLeft = start
      let startTs: number | null = null
      const step = (ts: number) => {
        if (startTs === null) startTs = ts
        const p = Math.min(1, (ts - startTs) / 700)
        const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic — deliberate, นวลๆ (not จ๊าบ)
        strip.scrollLeft = start + (target - start) * eased
        if (p < 1) requestAnimationFrame(step)
        else strip.style.scrollSnapType = 'x mandatory'
      }
      requestAnimationFrame(step)
    }
    rollTo(decadeStripRef.current, decadeCurRef.current, 'left')
    rollTo(annualStripRef.current, annualCurRef.current, 'right')
  }, [inView, prefersReducedMotion])

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
    <div ref={rootRef} className="w-full space-y-6" data-testid="luck-timeline">
      {/* 2 "ตอนนี้" cards — prominent (frosted + accent), priority below the ดิถี hero */}
      {(currentAnnual || currentDecade) && (
        <div className="grid grid-cols-2 gap-3" data-testid="current-luck-cards">
          {currentAnnual && (
            <CurrentCard
              label="ปีจรปีนี้"
              sub={annualYears(currentAnnual) ? `${annualYears(currentAnnual)!.ce} · พ.ศ. ${annualYears(currentAnnual)!.be}` : `อีก ${currentAnnual.year} ปี`}
              above={{ sym: currentAnnual.above.chinese_symbol, color: elementColor(currentAnnual.above.element) }}
              below={{ sym: currentAnnual.below.chinese_symbol, color: elementColor(currentAnnual.below.element) }}
              qi={annualQi(currentAnnual)}
            />
          )}
          {currentDecade && (
            <CurrentCard
              label="วัยจรปีนี้"
              sub={`${currentDecade.ageStart}-${currentDecade.ageEnd} ปี`}
              above={decadeGlyphs(currentDecade).above}
              below={decadeGlyphs(currentDecade).below}
              qi={decadeQi(currentDecade)}
            />
          )}
        </div>
      )}

      {/* วัยจร */}
      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <h2 className="font-prompt text-[15px] font-semibold text-white">วัยจร</h2>
          <span className="ml-auto font-ibm text-[11px] text-white/80">แตะช่วงอายุเพื่อดูรายละเอียด</span>
        </div>
        <div ref={decadeStripRef} className="no-scrollbar flex gap-2.5 overflow-x-auto pb-2 pt-3" data-testid="decade-strip" style={{ scrollSnapType: 'x mandatory' }}>
          {decades.map((d, i) => {
            const active = i === decadeIndex
            const qi = decadeQi(d)
            const g = decadeGlyphs(d)
            const badge = enrichment ? findDecadeBadge(shownTimelineBadges, enrichment.daYun, d.ageStart) : undefined
            const interactive = Boolean(qi || (enrichment && findDecadePhasePair(enrichment.daYun, d).upper))
            return (
              <div key={i} ref={d.isCurrent ? decadeCurRef : undefined} className="relative shrink-0" style={{ scrollSnapAlign: 'start' }}>
                <button
                  type="button"
                  disabled={!interactive}
                  onClick={() => openSheet('decade', i)}
                  className={
                    'flex min-w-[92px] flex-col items-center gap-2 rounded-2xl border px-3 py-3 transition-colors ' +
                    (active
                      ? 'border-2 border-moumate_blue bg-moumate_blue_light'
                      : 'border-border_gray bg-moumate_white') +
                    (d.isCurrent ? ' ring-2 ring-moumate_blue/50' : '') +
                    (interactive ? '' : ' cursor-default opacity-90')
                  }
                >
                  <span className="font-ibm text-[11px] font-semibold text-calc_muted">
                    {d.ageStart}-{d.ageEnd}
                  </span>
                  <div className="flex flex-col items-center leading-none">
                    <span className="font-chonburi text-[22px]" style={{ color: g.above.color }}>
                      {g.above.sym}
                    </span>
                    {g.below && (
                      <span className="font-chonburi text-[22px]" style={{ color: g.below.color }}>
                        {g.below.sym}
                      </span>
                    )}
                  </div>
                  {qi ? <StageChip text={qi} /> : <span className="h-[17px]" />}
                </button>
                {badge && (
                  <div className="absolute -top-2 right-1 z-10">
                    <BadgeMarker badge={badge} size={26} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ปีจร */}
      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <h2 className="font-prompt text-[15px] font-semibold text-white">ปีจร</h2>
          <span className="ml-auto font-ibm text-[11px] text-white/80">แตะปีเพื่อดูรายละเอียด</span>
        </div>
        <div ref={annualStripRef} className="no-scrollbar flex gap-2.5 overflow-x-auto pb-2 pt-3" data-testid="annual-strip" style={{ scrollSnapType: 'x mandatory' }}>
          {annual.map((y, i) => {
            const active = i === yearIndex
            const qi = annualQi(y)
            const years = annualYears(y)
            const badge = enrichment ? findAnnualBadge(shownTimelineBadges, y.year) : undefined
            const row = enrichment ? findLiuNianForYear(enrichment.liuNian, y) : undefined
            const interactive = Boolean(row)
            return (
              <div key={i} ref={i === 0 ? annualCurRef : undefined} className="relative shrink-0" style={{ scrollSnapAlign: 'start' }}>
                <button
                  type="button"
                  disabled={!interactive}
                  onClick={() => openSheet('annual', i)}
                  className={
                    'flex min-w-[92px] flex-col items-center gap-2 rounded-2xl border px-3 py-3 transition-colors ' +
                    (active
                      ? 'border-2 border-moumate_blue bg-moumate_blue_light'
                      : 'border-border_gray bg-moumate_white') +
                    (i === 0 ? ' ring-2 ring-moumate_blue/50' : '') +
                    (interactive ? '' : ' cursor-default opacity-90')
                  }
                >
                  <span className="text-center font-ibm text-[10.5px] font-semibold leading-tight text-calc_muted">
                    {years ? (
                      <>
                        {years.ce}
                        <br />
                        พ.ศ. {years.be}
                      </>
                    ) : (
                      `อีก ${y.year} ปี`
                    )}
                  </span>
                  <div className="flex flex-col items-center leading-none">
                    <span className="font-chonburi text-[22px]" style={{ color: elementColor(y.above.element) }}>
                      {y.above.chinese_symbol}
                    </span>
                    <span className="font-chonburi text-[22px]" style={{ color: elementColor(y.below.element) }}>
                      {y.below.chinese_symbol}
                    </span>
                  </div>
                  {qi ? <StageChip text={qi} /> : <span className="h-[17px]" />}
                </button>
                {badge && (
                  <div className="absolute -top-2 right-1 z-10">
                    <BadgeMarker badge={badge} size={26} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {timelineBadgeOverflow > 0 && (
          <p className="mt-1 text-right font-ibm text-[11px] text-white/80" data-testid="timeline-badge-overflow">
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
