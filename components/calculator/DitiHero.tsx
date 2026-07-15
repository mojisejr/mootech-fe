import { motion, useReducedMotion } from 'framer-motion'
import { elementColor, elementLabel, type BaziElement } from '@/lib/calculator/elements'
import { hexToRgba } from '@/lib/calculator/color'

// ดิถี (day stem) = "ตัวเรา" — must read as the most prominent element in every state
// (reveal/settled/mobile/reduced-motion). Doctrine invariant per มุน's design review, verified
// pixel-measurable: glyph size, aura saturation, and DOM/reveal order are all fixed here, not
// left to CSS cascade accidents.
//   - glyph: 2.25x the baseline pillar-stem glyph size (28px mobile / 36px desktop) -> 64/80px
//   - aura: radial gradient sized ~2.2x the glyph box (~145px mobile / ~180px desktop)
//
// The aura+medallion live in their own fixed-size, concentric `relative` wrapper — NOT the outer
// flex-col wrapper that also holds the label below. Centering the aura against the outer wrapper
// (which grows taller once the label text is added) pulls it downward off-center from the glyph;
// caught this by screenshotting before shipping, not by assumption.
export function DitiHero({
  glyph,
  element,
  reveal = true,
}: {
  glyph: string
  element: BaziElement | undefined
  reveal?: boolean
}) {
  const prefersReducedMotion = useReducedMotion()
  const color = elementColor(element)
  const playReveal = reveal && !prefersReducedMotion

  return (
    <div className="flex flex-col items-center" data-testid="diti-hero">
      <div className="relative flex h-[145px] w-[145px] items-center justify-center lg:h-[180px] lg:w-[180px]">
        {/* radial element-aura — concentric with the medallion, sized to fill this wrapper */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${hexToRgba(color, 0.38)} 0%, ${hexToRgba(color, 0.14)} 45%, ${hexToRgba(color, 0)} 72%)`,
          }}
          initial={playReveal ? { opacity: 0, scale: 0.6 } : false}
          animate={{ opacity: 0.38, scale: 1 }}
          transition={playReveal ? { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.08 } : { duration: 0.2 }}
        />

        {/* glyph, with medallion ring + brand elevation */}
        <motion.div
          className="relative z-10 flex h-[88px] w-[88px] items-center justify-center rounded-full bg-moumate_white shadow-custom lg:h-[108px] lg:w-[108px]"
          style={{ border: `2px solid ${hexToRgba(color, 0.6)}` }}
          initial={playReveal ? { opacity: 0, scale: 0.7 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={playReveal ? { duration: 0.45, ease: [0.22, 1, 0.36, 1] } : { duration: 0.2 }}
        >
          <span
            className="font-chonburi leading-none text-[64px] lg:text-[80px]"
            style={{ color }}
            data-testid="diti-glyph"
          >
            {glyph}
          </span>
        </motion.div>
      </div>

      <p className="mt-3 text-xs text-calc_muted lg:text-[13px]" data-testid="diti-element-label">
        {elementLabel(element)}
      </p>
    </div>
  )
}
