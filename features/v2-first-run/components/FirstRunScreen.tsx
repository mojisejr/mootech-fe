import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { DotsPager } from '@/features/onboarding/components/DotsPager'
import { FullBleedScreen } from '@/features/v2-shell/components/FullBleedScreen'
import { cn } from '@/lib/utils/cn'

// FirstRunScreen — shared chrome for the three post-first-login screens (issue #215).
// Figma: 02-intent-check 300:1548 · 04-pdpa 300:1582/300:2137 · 05 ผลธาตุ 300:2356.
//
// NOT features/onboarding/ — that name is taken by the 4-page marketing carousel that runs BEFORE
// login and is already shipped. These three run AFTER the first login and collect data, so they
// live in their own feature (บอง's naming, confirmed in the issue).
//
// The nav row is identical across all three (back · 3 dots · spacer), so it lives here once. The
// Figma status bar and home indicator are DEVICE chrome in the mockup, not our UI — no shipped v2
// screen paints them, and neither does this one.
//
// ⚠️ known Figma delta (issue #215, deliberate): Figma draws all three dots as 8×8 circles and
// signals the active one with colour alone; DotsPager (reused per the issue, and features/onboarding
// is off-limits) draws the active dot as a 20px capsule. Reuse won over pixel-match by instruction.

export const FIRST_RUN_STEPS = 3

// All three screens sit on flat ghost-white #ECF0FD.
//
// 05 was briefly built on a cream radial gradient, because a per-node SVG export of one of its icons
// carried a 375×1853 rect filled #FAF7F4 with a radial overlay — and the maths on that rect's
// transform landed exactly on the frame's centre and half-extents, which made it look conclusive.
// It was a NEIGHBOURING frame on the canvas: exporting a node whose card has a backdrop-filter drags
// the backdrop in, and the backdrop here included the artboard next door. The rendered screenshot of
// 300:2356 shows ghost-white, same as 02 and 04. Coordinates inferred from an export are a proxy;
// the render is the ground truth, and where they disagree the render wins.
const PAGE_BG = '#ECF0FD'

export function FirstRunScreen({
  step,
  onBack,
  children,
  footer,
  contentClassName,
}: {
  /** 0-based index into the 3-dot pager. */
  step: number
  onBack?: () => void
  children: ReactNode
  /** Sits under the content with a capped gap (<=48px); pushed below the fold when the content is long. */
  footer: ReactNode
  contentClassName?: string
}) {
  return (
    <FullBleedScreen
      bgFallback={PAGE_BG}
      // Core spacing classes only. An arbitrary Tailwind class containing a comma (e.g.
      // pb-[max(2rem,env(safe-area-inset-bottom))]) silently kills the NEXT class in the same
      // string — the trap already documented in OnboardingCarousel. Same rhythm as that screen.
      contentClassName="pt-3 pb-10"
    >
      {/* nav — back · dots · spacer (the spacer keeps the dots optically centred) */}
      <div className="flex items-center justify-between px-6">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="ย้อนกลับ"
            className="-m-1 flex size-6 items-center justify-center rounded p-1 text-v3-text-price focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v3-sapphire"
          >
            <ArrowLeft className="size-6" strokeWidth={2} aria-hidden="true" />
          </button>
        ) : (
          <span className="size-6" />
        )}
        <DotsPager count={FIRST_RUN_STEPS} active={step} />
        <span className="size-6" />
      </div>

      {/* Content no longer absorbs ALL the free space. It used to (`flex-1`), which pinned `footer`
          to the bottom on a short screen — measured on 02-intent-check at 393x852: the goal grid ends
          at y=540 and the button started at y=760, a 220px void that reads as a gap nobody drew
          (ฟีม, issue #563). The two long screens never had that void: their content already exceeds
          the viewport, so `flex-1` had no free space to hand them. Proven, not assumed — before/after
          box measurements for all three screens are in the PR.

          Now the gap is CAPPED instead: the spacer takes whatever free space exists, up to 48px. On
          04-pdpa and 05-ผลธาตุ there is none to take, so it collapses to 0 and neither screen moves. */}
      <div className={cn('flex flex-col', contentClassName)}>{children}</div>

      <div aria-hidden className="max-h-12 flex-1" />

      <div className="px-8 pt-6">{footer}</div>
    </FullBleedScreen>
  )
}

export default FirstRunScreen
