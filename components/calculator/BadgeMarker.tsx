import { useLayoutEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { badgeIcon, badgePopoverText, type BadgePoint } from '@/lib/calculator/badges'

const POPOVER_WIDTH = 200
const VIEWPORT_MARGIN = 8

// Signal-gated badge marker (#calculator-badge-mood-FROZEN-v1) — states: shown (idle icon) <->
// tapped (popover open). "hidden" (no badge at all) is the caller's responsibility: only render
// this component when a badge genuinely exists for that point — calm/no-badge is a valid, common
// state, not something this component itself represents.
//
// Popover text is fact-only, always phrased against ดิถี, no promise/prediction language (too's
// word-ban list — see lib/calculator/badges.ts's badgePopoverText for the exact wording rule).
export function BadgeMarker({ badge, size = 18 }: { badge: BadgePoint; size?: number }) {
  const [tapped, setTapped] = useState(false)
  const [offsetX, setOffsetX] = useState(0)
  const markerRef = useRef<HTMLSpanElement>(null)

  // Clamp the popover within the viewport — a fixed "right-0" offset overflows off-screen for
  // markers near the left edge (found live: ascendant column badges got clipped on a 390px
  // viewport). Recompute on open since the marker's screen position depends on layout/scroll.
  useLayoutEffect(() => {
    if (!tapped || !markerRef.current) return
    const rect = markerRef.current.getBoundingClientRect()
    const idealLeft = rect.right - POPOVER_WIDTH
    const clampedLeft = Math.max(VIEWPORT_MARGIN, Math.min(idealLeft, window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN))
    setOffsetX(clampedLeft - idealLeft)
  }, [tapped])

  return (
    <span ref={markerRef} className="absolute -right-1 -top-1 z-10" data-testid="badge-marker">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setTapped((v) => !v)
        }}
        aria-label={badgePopoverText(badge)}
        aria-expanded={tapped}
        className="flex items-center justify-center rounded-full bg-moumate_white shadow-custom"
        style={{ width: size, height: size }}
      >
        <Image src={badgeIcon(badge.role)} width={size - 4} height={size - 4} alt="" aria-hidden="true" />
      </button>

      {tapped && (
        <div
          role="tooltip"
          className="absolute top-full z-20 mt-1 rounded-lg border border-border_gray bg-moumate_white px-3 py-2 text-left font-ibm text-xs text-moumate_black shadow-custom"
          style={{ right: 0, width: POPOVER_WIDTH, transform: `translateX(${offsetX}px)` }}
        >
          {badgePopoverText(badge)}
        </div>
      )}
    </span>
  )
}
