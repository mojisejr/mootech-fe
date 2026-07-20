import { cn } from '@/lib/utils/cn'

// DotsPager — MuMate v2 onboarding progress dots (DESIGN.md v3 §7, node 40×32).
// Active dot = cyan (#1B9AAF), inactive = ghost-white-ish. Presentational only.
export function DotsPager({
  count,
  active,
  className,
}: {
  count: number
  active: number
  className?: string
}) {
  return (
    <div
      className={cn('flex items-center justify-center gap-2', className)}
      role="tablist"
      aria-label="ความคืบหน้า"
    >
      {Array.from({ length: count }).map((_, i) => {
        const on = i === active
        return (
          <span
            key={i}
            aria-hidden="true"
            className={cn(
              'h-2 rounded-full transition-all',
              on ? 'w-5 bg-v3-cyan' : 'w-2 bg-v3-cyan/30',
            )}
          />
        )
      })}
    </div>
  )
}

export default DotsPager
