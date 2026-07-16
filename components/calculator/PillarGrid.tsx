import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { elementColor, type BaziElement } from '@/lib/calculator/elements'
import { hexToRgba } from '@/lib/calculator/color'
import { thaiToBaziElement } from '@/lib/calculator/map-enrichment'
import { BadgeMarker } from '@/components/calculator/BadgeMarker'
import { DetailSheet } from '@/components/calculator/DetailSheet'
import { badgeIcon, badgePopoverText, capBadges, type BadgePoint } from '@/lib/calculator/badges'
import Image from 'next/image'
import type { EnrichmentPillar, EnrichmentPillars } from '@/pages/api/calculator/compute'

const PILLAR_BADGE_CAP = 2

// F3 — 5 pillars, order frozen: ลัคนา | ยาม | วัน | เดือน | ปี (day = center). v-final
// (#calculator-reframe-v2): soft frosted tiles on the teal canvas + thin element accent. Tapping a
// pillar opens its 12-เชี่ยงแซ (บน/ล่าง/ตัวนั่ง). ดิถี (day) is the anchor — never tappable, no stage.
//
// Glyph SOURCE (data-correctness rule, FROZEN v2): when `enrichmentPillars` (bazi-sft's own pillars
// via public-calc PR-A) is present, the glyph AND its เชี่ยงแซ come from that ONE engine, so they can
// never mismatch. Fallback to `columns` (mootech-be `detail.*Above/Below`) when enrichment is
// null/absent — those render glyph-only (no เชี่ยงแซ), same as before Phase 2.
export type PillarSlot = { chinese_symbol: string; element: BaziElement } | null | undefined

export type PillarColumn = {
  key: string
  label: string
  above: PillarSlot
  below: PillarSlot
  isDay: boolean
}

type RenderColumn = PillarColumn & { detail?: EnrichmentPillar }

const PILLAR_ORDER: Array<{ key: keyof EnrichmentPillars; label: string; isDay: boolean }> = [
  { key: 'ascendant', label: 'ลัคนา', isDay: false },
  { key: 'hour', label: 'ยาม', isDay: false },
  { key: 'day', label: 'วัน', isDay: true },
  { key: 'month', label: 'เดือน', isDay: false },
  { key: 'year', label: 'ปี', isDay: false },
]

function slotFromDetail(sym: string, thaiElement: string): PillarSlot {
  if (!sym) return null
  return { chinese_symbol: sym, element: thaiToBaziElement(thaiElement) as BaziElement }
}

function toRenderColumns(columns: PillarColumn[], pillars?: EnrichmentPillars): RenderColumn[] {
  if (!pillars) return columns.map((c) => ({ ...c }))
  return PILLAR_ORDER.map(({ key, label, isDay }) => {
    const p = pillars[key]
    return {
      key,
      label,
      isDay,
      above: p ? slotFromDetail(p.stem, p.stemElement) : null,
      below: p ? slotFromDetail(p.branch, p.branchElement) : null,
      detail: p,
    }
  })
}

function Glyph({ slot }: { slot: PillarSlot }) {
  if (!slot) return <span className="text-[13px] leading-none text-calc_muted">—</span>
  return (
    <span className="font-chonburi text-[27px] leading-none lg:text-[32px]" style={{ color: elementColor(slot.element) }}>
      {slot.chinese_symbol}
    </span>
  )
}

function SheetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border_gray py-2 font-ibm text-[13px] last:border-b-0">
      <span className="text-calc_muted">{label}</span>
      <span className="text-moumate_black">{value}</span>
    </div>
  )
}

export function PillarGrid({
  columns,
  enrichmentPillars,
  reveal = true,
  badges = [],
}: {
  columns: PillarColumn[]
  enrichmentPillars?: EnrichmentPillars
  reveal?: boolean
  badges?: BadgePoint[]
}) {
  const prefersReducedMotion = useReducedMotion()
  const playReveal = reveal && !prefersReducedMotion
  const [openKey, setOpenKey] = useState<string | null>(null)
  // which pillar's "many signals" badge list is open (the +N sticker → modal fallback)
  const [badgeListKey, setBadgeListKey] = useState<string | null>(null)

  const render = toRenderColumns(columns, enrichmentPillars)
  const dayIndex = render.findIndex((c) => c.isDay)
  const staggerOrder = render.map((_, i) => Math.abs(i - dayIndex))
  const dayGlyph = render[dayIndex]?.above?.chinese_symbol ?? ''
  const { shown: shownBadges } = capBadges(badges, PILLAR_BADGE_CAP)

  // a pillar is tappable only when it carries stage detail and isn't the ดิถี anchor
  const open = render.find((c) => c.key === openKey)
  const hasStages = (d?: EnrichmentPillar) => Boolean(d && (d.upperStageDisplay || d.lowerStageDisplay || d.sittingStage))

  // "+N" fallback — the full signal list for the pillar whose badge cluster was tapped
  const badgeListCol = render.find((c) => c.key === badgeListKey)
  const listBadges = badgeListKey ? shownBadges.filter((b) => b.point === 'pillar-' + badgeListKey) : []

  return (
    <>
      <div className="mx-auto grid w-full max-w-md grid-cols-5 gap-2 lg:max-w-2xl lg:gap-3" data-testid="pillar-grid">
        {render.map((col, i) => {
          // signal badge(s) for this pillar — the ดิถี anchor never carries one. Rendered at the CARD
          // top-right corner (below), stacked, OUTSIDE the tile <button> (a badge is itself a <button>,
          // so nesting it inside the tappable tile would be invalid DOM).
          const cardBadges = col.isDay ? [] : shownBadges.filter((b) => b.point === 'pillar-' + col.key)
          const accent = elementColor(col.above?.element)
          const tappable = !col.isDay && hasStages(col.detail)
          const tileStyle = col.isDay
            ? { borderColor: hexToRgba(accent, 0.55), boxShadow: `0 6px 20px ${hexToRgba(accent, 0.22)}` }
            : { borderColor: 'rgba(255,255,255,0.55)' }
          const inner = (
            <>
              <span aria-hidden="true" className="absolute inset-x-3 top-0 h-[3px] rounded-b-full" style={{ background: accent }} />
              <span className="mt-0.5 font-ibm text-[11px] font-medium text-calc_muted lg:text-[12px]">{col.label}</span>
              <Glyph slot={col.above} />
              <Glyph slot={col.below} />
            </>
          )
          const cls =
            'relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl border bg-white/90 px-1 pb-3 pt-2 shadow-custom backdrop-blur-md'
          return (
            <motion.div
              key={col.key}
              className="relative"
              initial={playReveal ? { opacity: 0, y: 12 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={playReveal ? { duration: 0.38, ease: [0.22, 1, 0.36, 1], delay: staggerOrder[i] * 0.08 } : { duration: 0.2 }}
              data-testid={`pillar-${col.key}`}
            >
              {tappable ? (
                <button type="button" onClick={() => setOpenKey(col.key)} className={`${cls} w-full`} style={tileStyle}>
                  {inner}
                </button>
              ) : (
                <div className={cls} style={tileStyle}>
                  {inner}
                </div>
              )}
              {/* badge(s) at the card corner — sibling of the tile button (never nested). Sticker
                  overhangs UP (-top-2) and hugs the right edge (right-1, NOT -right → would overlap
                  the adjacent pillar on the tight mobile 5-col grid). One signal = one BadgeMarker;
                  many = one sticker + a "+N" chip that opens a labeled modal (keeps the card calm). */}
              {cardBadges.length === 1 && (
                <div className="absolute -top-2 right-1 z-10">
                  <BadgeMarker badge={cardBadges[0]} size={28} />
                </div>
              )}
              {cardBadges.length > 1 && (
                <div className="absolute -top-2 right-1 z-10">
                  <button
                    type="button"
                    onClick={() => setBadgeListKey(col.key)}
                    aria-label={`สัญญาณ ${cardBadges.length} รายการ`}
                    className="flex items-center gap-0.5 rounded-full border-2 border-moumate_blue bg-moumate_white pl-0.5 pr-1.5 shadow-custom"
                    style={{ height: 28 }}
                  >
                    <Image src={badgeIcon(cardBadges[0].role)} width={18} height={18} alt="" aria-hidden="true" />
                    <span className="font-ibm text-[11px] font-semibold leading-none text-moumate_blue">
                      +{cardBadges.length - 1}
                    </span>
                  </button>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {enrichmentPillars && (
        <p className="mt-2.5 text-center font-ibm text-[11px] text-white/80">แตะเสาเพื่อดู 12 เชี่ยงแซ</p>
      )}

      <DetailSheet
        open={Boolean(open && hasStages(open.detail))}
        onClose={() => setOpenKey(null)}
        kicker={open ? `เสา${open.label} · เทียบดิถี ${dayGlyph}` : undefined}
        title={open ? `${open.above?.chinese_symbol ?? ''}${open.below?.chinese_symbol ?? ''} · ${open.label}` : ''}
      >
        {open?.detail && (
          <div className="rounded-xl border border-border_gray bg-bg_gray/40 p-3">
            {open.detail.upperStageDisplay && <SheetRow label="ราศีบน" value={open.detail.upperStageDisplay} />}
            {open.detail.lowerStageDisplay && <SheetRow label="ราศีล่าง" value={open.detail.lowerStageDisplay} />}
            {open.detail.sittingStage && <SheetRow label="ตัวนั่ง" value={open.detail.sittingStage} />}
          </div>
        )}
        <p className="mt-3 text-center font-ibm text-[11px] text-calc_muted">ข้อมูลเชิงโครงสร้าง — ไม่ใช่คำทำนาย</p>
      </DetailSheet>

      {/* "+N" signal list — every badge on this pillar, each with its own clear label */}
      <DetailSheet
        open={Boolean(badgeListKey && listBadges.length > 0)}
        onClose={() => setBadgeListKey(null)}
        kicker={badgeListCol ? `เสา${badgeListCol.label} · สัญญาณ` : undefined}
        title={badgeListCol ? `สัญญาณทั้งหมด · ${listBadges.length} รายการ` : ''}
      >
        <div className="space-y-2">
          {listBadges.map((b, bi) => (
            <div key={bi} className="flex items-start gap-2.5 rounded-xl border border-border_gray bg-bg_gray/40 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-moumate_blue bg-moumate_white">
                <Image src={badgeIcon(b.role)} width={16} height={16} alt="" aria-hidden="true" />
              </span>
              <p className="font-ibm text-[13px] leading-snug text-moumate_black">{badgePopoverText(b)}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center font-ibm text-[11px] text-calc_muted">ข้อมูลเชิงโครงสร้าง — ไม่ใช่คำทำนาย</p>
      </DetailSheet>
    </>
  )
}
