import { motion, useReducedMotion } from 'framer-motion'
import { elementColor, type BaziElement } from '@/lib/calculator/elements'
import { hexToRgba } from '@/lib/calculator/color'
import { BadgeMarker } from '@/components/calculator/BadgeMarker'
import { capBadges, findPillarBadge, type BadgePoint } from '@/lib/calculator/badges'

const PILLAR_BADGE_CAP = 2

// F3 — 5 pillars, order frozen: ลัคนา | ยาม | วัน | เดือน | ปี (day = center). v-final
// (#calculator-reframe-v2): each pillar is a soft frosted tile on the teal canvas (no big white
// card) with a thin element-color accent on top. The ดิถี (day) tile is emphasised with an element
// ring — but the big hero circle above is the primary ดิถี statement, so this stays a supporting
// anchor, never competing.
//
// IMPORTANT data-access gotcha (verified live 2026-07-15): `summary.<pillar>.element` is NOT the
// glyph's element — the correct per-glyph element/color comes from `detail.<pillar>Above/Below`.
// (Phase 2 will switch the glyph source to enrichment.pillars from bazi-sft, keeping glyph + เชี่ยงแซ
// on the same engine — see FROZEN v2 data-correctness rule.)
export type PillarSlot = { chinese_symbol: string; element: BaziElement } | null | undefined

export type PillarColumn = {
  key: string
  label: string
  above: PillarSlot
  below: PillarSlot
  isDay: boolean
}

function Glyph({ slot }: { slot: PillarSlot }) {
  if (!slot) {
    return <span className="text-[13px] leading-none text-calc_muted">—</span>
  }
  return (
    <span
      className="font-chonburi text-[27px] leading-none lg:text-[32px]"
      style={{ color: elementColor(slot.element) }}
    >
      {slot.chinese_symbol}
    </span>
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

  const dayIndex = columns.findIndex((c) => c.isDay)
  const staggerOrder = columns.map((_, i) => Math.abs(i - dayIndex))

  const { shown: shownBadges } = capBadges(badges, PILLAR_BADGE_CAP)

  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-5 gap-2 lg:max-w-2xl lg:gap-3" data-testid="pillar-grid">
      {columns.map((col, i) => {
        const badge = col.isDay ? undefined : findPillarBadge(shownBadges, col.key)
        const accent = elementColor(col.above?.element)
        return (
          <motion.div
            key={col.key}
            className="relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl border bg-white/90 px-1 pb-3 pt-2 shadow-custom backdrop-blur-md"
            style={
              col.isDay
                ? { borderColor: hexToRgba(accent, 0.55), boxShadow: `0 6px 20px ${hexToRgba(accent, 0.22)}` }
                : { borderColor: 'rgba(255,255,255,0.55)' }
            }
            initial={playReveal ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
              playReveal
                ? { duration: 0.38, ease: [0.22, 1, 0.36, 1], delay: staggerOrder[i] * 0.08 }
                : { duration: 0.2 }
            }
            data-testid={`pillar-${col.key}`}
          >
            {/* thin element-color accent on top of the tile */}
            <span aria-hidden="true" className="absolute inset-x-3 top-0 h-[3px] rounded-b-full" style={{ background: accent }} />
            <span className="mt-0.5 font-ibm text-[11px] font-medium text-calc_muted lg:text-[12px]">{col.label}</span>
            <div className="relative">
              <Glyph slot={col.above} />
              {badge && <BadgeMarker badge={badge} size={18} />}
            </div>
            <Glyph slot={col.below} />
          </motion.div>
        )
      })}
    </div>
  )
}
