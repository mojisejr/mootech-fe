import { useLayoutEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { badgeIcon, badgePopoverText, type BadgePoint } from '@/lib/calculator/badges'

const POPOVER_WIDTH = 200
const POPOVER_EST_HEIGHT = 88 // fact-only text is 2–3 lines; used only to decide flip direction
const VIEWPORT_MARGIN = 8

// Signal-gated badge marker (#calculator-badge-mood-FROZEN-v1) — states: shown (idle icon) <->
// tapped (popover open). "hidden" (no badge at all) is the caller's responsibility: only render
// this component when a badge genuinely exists for that point — calm/no-badge is a valid, common
// state, not something this component itself represents.
//
// Popover text is fact-only, always phrased against ดิถี, no promise/prediction language (too's
// word-ban list — see lib/calculator/badges.ts's badgePopoverText for the exact wording rule).
export function BadgeMarker({ badge, size = 22 }: { badge: BadgePoint; size?: number }) {
  const [tapped, setTapped] = useState(false)
  const [offsetX, setOffsetX] = useState(0)
  const [flipUp, setFlipUp] = useState(false)
  const markerRef = useRef<HTMLSpanElement>(null)

  // Collision-aware positioning, both axes. Horizontal: a fixed "right-0" offset overflows off-screen
  // for markers near the left edge (ascendant column, 390px). Vertical: the default below-placement
  // clips at the bottom edge for markers low in the viewport (ฟีม sent a real cutoff) — flip above
  // when there isn't room below but there is above. Recompute on open (position depends on scroll).
  useLayoutEffect(() => {
    if (!tapped || !markerRef.current) return
    const rect = markerRef.current.getBoundingClientRect()
    const idealLeft = rect.right - POPOVER_WIDTH
    const clampedLeft = Math.max(VIEWPORT_MARGIN, Math.min(idealLeft, window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN))
    setOffsetX(clampedLeft - idealLeft)

    const roomBelow = window.innerHeight - rect.bottom
    const roomAbove = rect.top
    setFlipUp(roomBelow < POPOVER_EST_HEIGHT + VIEWPORT_MARGIN && roomAbove > roomBelow)
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
        // Deliberately bolder than the plain ambient reaction-dot (6px, no border, flat color) —
        // found live that at thumbnail scale a same-language small dot reads as decorative noise,
        // undermining "badge = signal, most blocks stay calm" (มุน's PR#58 review finding). A
        // filled accent ring + larger icon makes "there's a real signal here" unmistakable.
        className="flex items-center justify-center rounded-full border-2 border-moumate_blue bg-moumate_white shadow-custom"
        style={{ width: size, height: size }}
      >
        <Image src={badgeIcon(badge.role)} width={size - 8} height={size - 8} alt="" aria-hidden="true" />
      </button>

      {tapped && (
        <div
          role="tooltip"
          className={
            'absolute z-20 rounded-lg border border-border_gray bg-moumate_white px-3 py-2 text-left font-ibm text-xs text-moumate_black shadow-custom ' +
            (flipUp ? 'bottom-full mb-1' : 'top-full mt-1')
          }
          style={{ right: 0, width: POPOVER_WIDTH, transform: `translateX(${offsetX}px)` }}
        >
          {badgePopoverText(badge)}
        </div>
      )}
    </span>
  )
}
