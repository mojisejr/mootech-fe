import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ELEMENT_COLOR } from '@/lib/calculator/elements'

const MOTE_COLORS = Object.values(ELEMENT_COLOR)
// Fixed scatter positions (not random per render — deterministic for visual testing).
const MOTE_POS = [
  { x: -58, y: -30 },
  { x: 56, y: -46 },
  { x: -46, y: 42 },
  { x: 58, y: 40 },
  { x: 0, y: -62 },
]

// F1 — compute ritual. v-final (#calculator-hero-flow, ฟีม froze): NO white card — the 5 element
// motes ORBIT + PULSE in a continuous loop directly on the teal canvas (not a single fade), with
// enlarged white copy. The loop runs for as long as this stays mounted (parent keeps phase='ritual'
// through the fetch), so it naturally "loops until data". Still skippable (tap) and auto-completes
// at 1200ms (a min grace); reduced-motion skips straight to onComplete.
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
      className="relative flex min-h-[60vh] w-full flex-col items-center justify-center gap-8"
      data-testid="ritual-loader"
    >
      {/* orbiting cluster (slow rotate) with each mote breathing (scale + opacity pulse) */}
      <motion.div
        className="relative h-[150px] w-[150px]"
        animate={{ rotate: 360 }}
        transition={{ duration: 9, ease: 'linear', repeat: Infinity }}
      >
        {MOTE_COLORS.map((color, i) => (
          <motion.span
            key={color}
            className="absolute left-1/2 top-1/2 h-3.5 w-3.5 rounded-full"
            style={{ backgroundColor: color, x: MOTE_POS[i].x, y: MOTE_POS[i].y, filter: 'blur(0.5px)' }}
            animate={{ scale: [0.65, 1.25, 0.65], opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity, delay: i * 0.22 }}
          />
        ))}
      </motion.div>
      <div className="text-center text-white">
        <p className="font-prompt text-xl font-semibold lg:text-2xl">กำลังอ่านผังของคุณ…</p>
        <p className="mt-1 font-ibm text-sm text-white/80">ธาตุกำลังเรียงตัว</p>
      </div>
    </button>
  )
}
