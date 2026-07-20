import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

// Button — MuMate V3 primitive (DESIGN.md v3 §6).
// Pill (radius 100). Icon gap 4px. Disabled = #DDDDDD + white Poppins SemiBold. Loading = dots.
// Focus is PER-VARIANT (not one rule):
//   primary      — sapphire fill + lime label · hover #10427F · focus 2px lime ring on #222
//   secondary    — lime fill + sapphire label · hover/pressed do NOT darken · focus 2px #D3D3D3 on lime
//   tertiary     — outline (1px sapphire) + sapphire label · hover 5% ink tint · focus 2px sapphire
//   cta-cyan     — cyan fill + WHITE label + soft cyan shadow · h56 · normal case (e.g. PDF)
//   cta-sapphire — sapphire fill + WHITE label + soft sapphire shadow · h56 · normal case (e.g. Share)
// primary/secondary/tertiary = UPPERCASE Bold(full)/SemiBold(small); cta = IBM Bold 16, normal case.
// Text links are a separate primitive — see ./link.tsx.

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'cta-cyan'
  | 'cta-sapphire'
export type ButtonSize = 'full' | 'small'

type ButtonProps = {
  variant?: ButtonVariant
  /** `full` = full-width (default) · `small` = inline compact. Ignored by cta-* (always h56 full). */
  size?: ButtonSize
  /** Shows dots, disables interaction, paints the #DDDDDD disabled surface. */
  loading?: boolean
  /** Optional icon before the label (icon↔label gap = 4px). */
  leadingIcon?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

const isCta = (v: ButtonVariant) => v === 'cta-cyan' || v === 'cta-sapphire'

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
    </span>
  )
}

// Per-variant surface (non-disabled, non-loading). Focus differs per variant (§6).
function variantSurface(variant: ButtonVariant): string {
  switch (variant) {
    case 'secondary':
      // lime fill + sapphire label; hover/pressed stay lime (no darken); focus grey ring on lime.
      return cn(
        'bg-v3-lime text-v3-sapphire',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3D3D3]',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-v3-lime',
      )
    case 'tertiary':
      // transparent + 1px sapphire border + sapphire label; hover = 5% ink tint; focus 2px sapphire.
      return cn(
        'border border-v3-sapphire bg-transparent text-v3-sapphire',
        'hover:bg-[rgba(34,34,34,0.05)] active:bg-[rgba(34,34,34,0.05)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v3-sapphire focus-visible:ring-offset-0',
      )
    case 'cta-cyan':
      return cn(
        'bg-v3-cyan text-white shadow-cta-cyan hover:brightness-95 active:brightness-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v3-cyan focus-visible:ring-offset-2',
      )
    case 'cta-sapphire':
      return cn(
        'bg-v3-sapphire text-white shadow-cta-sapphire hover:brightness-95 active:brightness-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v3-sapphire focus-visible:ring-offset-2',
      )
    case 'primary':
    default:
      return cn(
        'bg-v3-sapphire text-v3-lime',
        'hover:bg-v3-sapphire-hover',
        'active:bg-v3-sapphire', // pressed = #1455A4
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v3-lime',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-v3-shade-02',
      )
  }
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
  const cta = isCta(variant)

  // Layout: cta = full-width fixed 56px height; else full/small per size. No font-weight here
  // (kept in fontClass) so cn never has two competing weights.
  const sizeLayout = cta
    ? 'w-full min-h-14 px-6 text-base leading-6' // h56, 16/24
    : size === 'small'
      ? 'px-6 py-4 text-sm leading-5' // 24H / 16V, 14/20
      : 'w-full px-6 py-[14px] text-base leading-6' // full-width, padY 14, 16/24

  // Exactly one font branch applies.
  const fontClass = disabled
    ? 'font-poppins-v3 font-semibold' // disabled: white Poppins SemiBold
    : loading
      ? 'font-ibm'
      : cta
        ? 'font-ibm font-bold' // cta: IBM Bold 16 (normal case)
        : size === 'small'
          ? 'font-ibm font-semibold' // small: SemiBold 14/20
          : 'font-ibm font-bold' // full: Bold 16/24

  const stateClass = disabled
    ? 'bg-v3-disabled-bg text-white cursor-not-allowed'
    : loading
      ? 'bg-v3-disabled-bg text-v3-shade-02 cursor-wait'
      : variantSurface(variant)

  return (
    <button
      type={type}
      data-variant={variant}
      disabled={isInert}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center gap-1 rounded-pill transition',
        cta ? 'normal-case' : 'uppercase',
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
