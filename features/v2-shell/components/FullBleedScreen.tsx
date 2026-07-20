import type { CSSProperties, ReactNode } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils/cn'

// FullBleedScreen — MuMate v2 container-contract (DESIGN.md §layout).
// The OTHER half of AppScreen: a screen that OWNS the full viewport — its own photographic
// background, no bottom Menubar, no max-width column. Onboarding / login / register live here
// (pre-app, photo bg per DESIGN.md v3 §13).
//
// WHY THIS EXISTS (slice-1 post-mortem): full-bleed screens were mounted inside the app shell's
// `max-w-md` column, so a `min-h-screen` + `Image fill` background filled a 448px box, not the
// viewport → squished bg. This typed wrapper makes the container contract structural: use
// FullBleedScreen and you CANNOT be width-clamped; the bg is handled here, once, correctly.
// Rule: a page is either <FullBleedScreen> or <AppScreen> — never hand-rolled, never both.
export function FullBleedScreen({
  children,
  /** Photographic bg (e.g. /images/v2/bg/BG01.png). 404-safe: falls back to `bgFallback`. */
  bgSrc,
  /** CSS background shown under/instead of the photo (gradient placeholder until the asset lands). */
  bgFallback,
  /** Extra classes on the content column (padding etc.). */
  contentClassName,
  className,
}: {
  children: ReactNode
  bgSrc?: string
  bgFallback?: CSSProperties['background']
  contentClassName?: string
  className?: string
}) {
  return (
    <div
      className={cn('relative flex min-h-[100dvh] w-full flex-col overflow-hidden', className)}
      style={bgFallback ? { background: bgFallback } : undefined}
    >
      {bgSrc ? (
        <Image
          src={bgSrc}
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="100vw"
          className="pointer-events-none select-none object-cover"
          // keep the fallback background if the asset isn't in /public yet
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
      ) : null}

      {/* content owns the whole viewport width — NO max-w clamp here by design */}
      <div className={cn('relative z-10 flex min-h-[100dvh] flex-col', contentClassName)}>
        {children}
      </div>
    </div>
  )
}

export default FullBleedScreen
