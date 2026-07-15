import { motion, useReducedMotion } from 'framer-motion'
import { ditiFillBackground, ditiGlyphColor, elementColor, elementLabel, type BaziElement } from '@/lib/calculator/elements'
import { hexToRgba } from '@/lib/calculator/color'

// ดิถี (day stem) = "ตัวเรา". v-final (#calculator-reframe-v2): the hero is a CIRCLE filled with the
// element color (gold gradient for METAL) with a contrast-flipped glyph, so "คุณเป็นคนธาตุ…" reads
// instantly. It floats on the teal canvas (no white card). Doctrine invariant: still the single most
// prominent glyph on the page (2.25×+ the pillar-stem glyph, first in DOM/reveal order).
//   - circle: 112px mobile / 140px desktop; glyph 60/76px (pillar stem is 26/34px → ratio ≥2.2×)
//   - a soft element-color halo sits behind it on teal (decorative, not a data surface)
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
  const playReveal = reveal && !prefersReducedMotion
  const color = elementColor(element)

  return (
    <div className="flex flex-col items-center" data-testid="diti-hero">
      <div className="relative flex h-[140px] w-[140px] items-center justify-center lg:h-[172px] lg:w-[172px]">
        {/* soft element halo on the teal canvas — decorative glow, gives the circle lift */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full blur-2xl"
          style={{ background: hexToRgba(color, 0.55) }}
          initial={playReveal ? { opacity: 0, scale: 0.6 } : false}
          animate={{ opacity: 0.45, scale: 1 }}
          transition={playReveal ? { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.08 } : { duration: 0.2 }}
        />

        {/* the element-filled circle + contrast glyph */}
        <motion.div
          className="relative z-10 flex h-[112px] w-[112px] items-center justify-center rounded-full shadow-custom ring-1 ring-white/40 lg:h-[140px] lg:w-[140px]"
          style={{ background: ditiFillBackground(element) }}
          initial={playReveal ? { opacity: 0, scale: 0.7 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={playReveal ? { duration: 0.45, ease: [0.22, 1, 0.36, 1] } : { duration: 0.2 }}
        >
          <span
            className="font-chonburi text-[60px] leading-none lg:text-[76px]"
            style={{ color: ditiGlyphColor(element) }}
            data-testid="diti-glyph"
          >
            {glyph}
          </span>
        </motion.div>
      </div>

      <p className="mt-3 font-ibm text-sm text-white lg:text-[15px]" data-testid="diti-element-label">
        {elementLabel(element)}
      </p>
    </div>
  )
}
