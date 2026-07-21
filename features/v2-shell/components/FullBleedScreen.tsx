import type { CSSProperties, ReactNode } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils/cn'

// FullBleedScreen — MuMate v2 container-contract (DESIGN.md §9.1 responsive standard).
// A screen that OWNS the full viewport. Two independent layers (the fix to slice-1's coupling):
//   • BG = full-bleed at EVERY width (Image fill + object-cover, focal via `bgPosition`).
//   • CONTENT = a centered column capped at `contentMaxWidth` — comfortable on 320px, and on a
//     wide/desktop screen the bg stays full-bleed while the content sits centered (ฟีม decision).
// Responsive by default 320 → 1280+. Onboarding / login / register live here.
//
// WHY: slice-1 removed the content max-w to fix a squished bg — which then let content SPREAD on
// wide screens (non-responsive). Root cause was coupling bg-width to content-width. Here they're
// separate: bg fills the viewport; content is a bounded, centered column. Rule: a page is
// <FullBleedScreen> or <AppScreen> — never hand-rolled, never both.
export function FullBleedScreen({
  children,
  /** Photographic bg (e.g. /images/v2/bg/BG01.png). 404-safe: falls back to `bgFallback`. */
  bgSrc,
  /** CSS background shown under/instead of the photo (gradient placeholder until the asset lands). */
  bgFallback,
  /** object-position for the bg photo (focal point when cropped). Default 'center'. */
  bgPosition = 'center',
  /** Max width of the centered content column. Default `max-w-md` (448px, mobile-comfortable).
   *  Use a CORE Tailwind width class (max-w-*) — an arbitrary `max-w-[NNNpx]` in a default
   *  param value is not reliably extracted by the JIT scanner (it silently resolves to none). */
  contentMaxWidth = 'max-w-md',
  /** Extra classes on the content column (padding etc.). */
  contentClassName,
  className,
}: {
  children: ReactNode
  bgSrc?: string
  bgFallback?: CSSProperties['background']
  bgPosition?: string
  contentMaxWidth?: string
  contentClassName?: string
  className?: string
}) {
  return (
    <div
      // min-h-screen (100vh) — reliable full-viewport height. `dvh` measured short (671 on a
      // 852 viewport) in headless render, leaving a white gap; vh fills correctly. min-h (not
      // fixed h) so a taller screen (long form) scrolls gracefully instead of clipping.
      className={cn('relative flex min-h-screen w-full flex-col overflow-hidden', className)}
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
          style={{ objectPosition: bgPosition }}
          className="pointer-events-none select-none object-cover"
          // keep the fallback background if the asset isn't in /public yet
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
      ) : null}

      {/* content = a centered column capped at contentMaxWidth (bg stays full-bleed behind it) */}
      <div
        className={cn(
          'relative z-10 mx-auto flex min-h-screen w-full flex-col',
          contentMaxWidth,
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}

export default FullBleedScreen
