import { motion, useReducedMotion } from 'framer-motion'
import { elementColor, type BaziElement } from '@/lib/calculator/elements'
import { BadgeMarker } from '@/components/calculator/BadgeMarker'
import { capBadges, findPillarBadge, type BadgePoint } from '@/lib/calculator/badges'

const PILLAR_BADGE_CAP = 2

// F3 — 5 pillars, order frozen: ลัคนา | ยาม | วัน | เดือน | ปี (day = center, position 3 of 5).
// The day-stem glyph IS ดิถี (already shown solo in DitiHero above) — shown again here boxed
// differently (double border) with a connecting line up, per มุน's frame sheet.
//
// IMPORTANT data-access gotcha (verified live against the real backend, 2026-07-15):
// `summary.<pillar>.element` is NOT the glyph's element — it's a different field entirely
// (confirmed: summary.ascendant.element came back "WATER" while the actual above-glyph 甲 is
// WOOD and the below-glyph 申 is METAL). The correct per-glyph element/color comes from
// `detail.<pillar>Above.element` / `detail.<pillar>Below.element` — mirrors the existing
// box-chinese-table.tsx convention exactly. Using `summary.*.element` here would have colored
// every glyph wrong on a page where color IS data.
export type PillarSlot = { chinese_symbol: string; element: BaziElement } | null | undefined

export type PillarColumn = {
  key: string
  label: string
  above: PillarSlot
  below: PillarSlot
  isDay: boolean
}

function GlyphBox({ slot, isDay, badge }: { slot: PillarSlot; isDay: boolean; badge?: BadgePoint }) {
  if (!slot) {
    return (
      <div className="flex h-[36px] w-[36px] items-center justify-center rounded border border-dashed border-border_gray text-[10px] text-calc_muted lg:h-[44px] lg:w-[44px]">
        —
      </div>
    )
  }
  const color = elementColor(slot.element)
  return (
    <div className="relative">
      <div
        className={
          'flex h-[36px] w-[36px] items-center justify-center rounded bg-moumate_white lg:h-[44px] lg:w-[44px] ' +
          (isDay ? 'border-2' : 'border border-border_gray')
        }
        style={isDay ? { borderColor: color } : undefined}
      >
        <span
          className="text-[26px] leading-none lg:text-[34px]"
          style={{ color, filter: isDay ? undefined : 'saturate(75%)' }}
        >
          {slot.chinese_symbol}
        </span>
      </div>
      {/* ดิถี hero ห้ามมี badge เด็ดขาด — invariant enforced by isDay guard at the call site below,
          not just by the backend never emitting a pillar-day badge. */}
      {badge && !isDay && <BadgeMarker badge={badge} size={16} />}
    </div>
  )
}

export function PillarGrid({
  columns,
  reveal = true,
  badges = [],
}: {
  columns: PillarColumn[]
  reveal?: boolean
  badges?: BadgePoint[]
}) {
  const prefersReducedMotion = useReducedMotion()
  const playReveal = reveal && !prefersReducedMotion

  // Stagger from the center out: day (already revealed via hero) has no delay; month+time next;
  // year+ascendant last — symmetric per มุน's frame sheet.
  const dayIndex = columns.findIndex((c) => c.isDay)
  const staggerOrder = columns.map((_, i) => Math.abs(i - dayIndex))

  const { shown: shownBadges } = capBadges(badges, PILLAR_BADGE_CAP)

  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-5 gap-2 lg:max-w-2xl lg:gap-4" data-testid="pillar-grid">
      {columns.map((col, i) => {
        const badge = col.isDay ? undefined : findPillarBadge(shownBadges, col.key)
        return (
          <motion.div
            key={col.key}
            className="flex flex-col items-center gap-1"
            initial={playReveal ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
              playReveal
                ? { duration: 0.38, ease: [0.22, 1, 0.36, 1], delay: staggerOrder[i] * 0.08 }
                : { duration: 0.2 }
            }
            data-testid={`pillar-${col.key}`}
          >
            <span className="text-[12px] text-calc_muted lg:text-[13px]">{col.label}</span>
            <GlyphBox slot={col.above} isDay={col.isDay} badge={badge} />
            <GlyphBox slot={col.below} isDay={col.isDay} />
          </motion.div>
        )
      })}
    </div>
  )
}
