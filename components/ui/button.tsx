import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

// Button — MuMate V3 primitive (DESIGN.md §6).
// Pill, UPPERCASE label. Sapphire fill + lime label (IBM Plex Sans Thai Bold 16/24).
// hover #10427F · pressed #1455A4 · focus = 2px lime ring on a #222 backing ·
// disabled = #DDDDDD bg + WHITE Poppins SemiBold label · loading = animated dots.
// Sizes: `full` (full-width, padY 14) · `small` (pad 24H/16V, SemiBold 14/20).

export type ButtonVariant = 'primary'
export type ButtonSize = 'full' | 'small'

type ButtonProps = {
  /** Only `primary` exists in the V3 contract today; kept for forward-compat. */
  variant?: ButtonVariant
  /** `full` = full-width (default) · `small` = inline, compact padding. */
  size?: ButtonSize
  /** Shows dots, disables interaction, and paints the #DDDDDD disabled surface. */
  loading?: boolean
  /** Optional icon rendered before the label (e.g. an <Image /> or SVG node). */
  leadingIcon?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
    </span>
  )
}

export function Button({
  variant = 'primary',
  size = 'full',
  loading = false,
  leadingIcon,
  disabled = false,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  const isInert = disabled || loading

  // Padding / width / text-size + line-height per size. No font-weight here so it
  // never conflicts with the per-state weight below (cn does not dedupe utilities).
  const sizeLayout =
    size === 'small'
      ? 'px-6 py-4 text-sm leading-5' // 24H / 16V, 14/20
      : 'w-full px-6 py-[14px] text-base leading-6' // full-width, padY 14, 16/24

  // Exactly one font branch applies — avoids two competing font-weight classes.
  const fontClass = disabled
    ? 'font-poppins-v3 font-semibold' // disabled label: WHITE Poppins SemiBold
    : loading
      ? 'font-ibm'
      : size === 'small'
        ? 'font-ibm font-semibold' // Button Small: SemiBold 14/20
        : 'font-ibm font-bold' // Button Primary: Bold 16/24

  const stateClass = disabled
    ? 'bg-v3-disabled-bg text-white cursor-not-allowed'
    : loading
      ? 'bg-v3-disabled-bg text-v3-shade-02 cursor-wait'
      : cn(
          'bg-v3-sapphire text-v3-lime',
          'hover:bg-v3-sapphire-hover',
          'active:bg-v3-sapphire', // pressed = #1455A4
          // focus: 2px lime ring sitting on a #222 backing
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v3-lime',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-v3-shade-02',
        )

  return (
    <button
      type={type}
      data-variant={variant}
      disabled={isInert}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 rounded-pill uppercase transition-colors',
        sizeLayout,
        fontClass,
        stateClass,
        className,
      )}
      {...rest}
    >
      {loading ? (
        <LoadingDots />
      ) : (
        <>
          {leadingIcon ? (
            <span className="inline-flex shrink-0 items-center" aria-hidden="true">
              {leadingIcon}
            </span>
          ) : null}
          {children}
        </>
      )}
    </button>
  )
}

export default Button
