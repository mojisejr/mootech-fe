import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

// Card — V3 primitive (DESIGN.md §6 "Card / Sheet / Nav").
// Contract: white bg, radius 16 (rounded-card), pad 16, FLAT (no drop shadow).
// Optional 1px border #E9EAEB (border-v3-border-card).
// Minimal, composable container — no internal layout opinions beyond padding.
export function Card({
  children,
  className,
  padded = true,
  border = false,
}: {
  children?: ReactNode
  className?: string
  /** Apply the contract's 16px padding. Set false for edge-to-edge content (e.g. media). Default: true. */
  padded?: boolean
  /** Add the optional 1px #E9EAEB hairline border. Default: false (flat, borderless). */
  border?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-card bg-white',
        padded && 'p-4',
        border && 'border border-v3-border-card',
        className,
      )}
    >
      {children}
    </div>
  )
}
