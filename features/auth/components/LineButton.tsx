import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

// LineButton — MuMate v2 LOGIN 1-off (DESIGN.md v3, Figma 302-238).
// NOT a standard Button variant: LINE brand green #06C755 + white label + LINE glyph.
// Pill h52, IBM SemiBold 16/24, non-uppercase (social button). Icon↔label gap 4.
export function LineButton({
  leadingIcon,
  className,
  children,
  type = 'button',
  ...rest
}: {
  leadingIcon?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-[52px] w-full select-none items-center justify-center gap-1 rounded-pill px-6',
        'bg-[#06C755] font-ibm text-base font-semibold leading-6 text-white transition',
        'hover:brightness-95 active:brightness-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06C755] focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:bg-v3-disabled-bg',
        className,
      )}
      {...rest}
    >
      {leadingIcon ? (
        <span className="inline-flex shrink-0 items-center" aria-hidden="true">
          {leadingIcon}
        </span>
      ) : null}
      {children}
    </button>
  )
}

export default LineButton
