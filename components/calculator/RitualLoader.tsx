import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ELEMENT_COLOR } from '@/lib/calculator/elements'

const MOTE_COLORS = Object.values(ELEMENT_COLOR)
// Fixed scatter positions (not random per render — random would make automated/visual testing
// nondeterministic and could occasionally place a mote awkwardly off-canvas).
const MOTE_START = [
  { x: -70, y: -40 },
  { x: 60, y: -55 },
  { x: -50, y: 45 },
  { x: 65, y: 50 },
  { x: 0, y: -70 },
]

// F1 — compute ritual. Skippable (click/tap), auto-completes at 1200ms. Repeat runs (try-another
// loop) complete faster (600ms) per มุน's spec. reduced-motion: skip straight to onComplete.
export function RitualLoader({
  onComplete,
  isRepeat = false,
}: {
  onComplete: () => void
  isRepeat?: boolean
}) {
  const prefersReducedMotion = useReducedMotion()
  const firedRef = useRef(false)

  const duration = isRepeat ? 600 : 1200

  useEffect(() => {
    if (prefersReducedMotion) {
      if (!firedRef.current) {
        firedRef.current = true
        onComplete()
      }
      return
    }
    const t = setTimeout(() => {
      if (!firedRef.current) {
        firedRef.current = true
        onComplete()
      }
    }, duration)
    return () => clearTimeout(t)
  }, [duration, onComplete, prefersReducedMotion])

  const skip = () => {
    if (!firedRef.current) {
      firedRef.current = true
      onComplete()
    }
  }

  if (prefersReducedMotion) return null

  return (
    <button
      type="button"
      onClick={skip}
      aria-label="ข้ามการคำนวณ"
      className="relative flex h-[220px] w-full items-center justify-center"
      data-testid="ritual-loader"
    >
      <div className="relative h-[140px] w-[140px]">
        {MOTE_COLORS.map((color, i) => (
          <motion.span
            key={color}
            className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full"
            style={{ backgroundColor: color, filter: 'blur(1px)' }}
            initial={{ x: MOTE_START[i].x, y: MOTE_START[i].y, opacity: 0.9, scale: 1 }}
            animate={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
            transition={{ duration: duration / 1000, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </div>
      <p className="absolute bottom-0 font-ibm text-sm text-calc_muted">กำลังคำนวณ…</p>
    </button>
  )
}
