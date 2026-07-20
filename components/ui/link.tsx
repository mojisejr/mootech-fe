import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

// TextLink — MuMate V3 primitive (DESIGN.md v3 §6, Links component 284-1037).
// Poppins SemiBold, NORMAL case (not uppercase — unlike Button).
//   type="subtle" — sapphire #1455A4 · medium(14) no underline / small(12) underline
//   type="legal"  — link-legal #004CC4 · small(12) underline
// Focus: 2px ring (#222 subtle / #004CC4 legal), rounded 2–4. Optional trailing icon (gap 4).

export type TextLinkType = 'subtle' | 'legal'
export type TextLinkSize = 'medium' | 'small'

type TextLinkProps = {
  type?: TextLinkType
  size?: TextLinkSize
  /** Trailing icon (e.g. arrow-right 16px), rendered after the label with a 4px gap. */
  trailingIcon?: ReactNode
} & AnchorHTMLAttributes<HTMLAnchorElement>

export function TextLink({
  type = 'subtle',
  size = 'medium',
  trailingIcon,
  className,
  children,
  ...rest
}: TextLinkProps) {
  const legal = type === 'legal'
  const small = size === 'small'

  return (
    <a
      data-link-type={type}
      className={cn(
        'inline-flex select-none items-center gap-1 font-poppins-v3 font-semibold normal-case transition',
        small ? 'text-xs leading-[18px] underline' : 'text-sm leading-5',
        legal ? 'text-v3-link-legal' : 'text-v3-sapphire',
        'focus-visible:outline-none focus-visible:ring-2',
        legal
          ? 'rounded-[2px] focus-visible:ring-v3-link-legal'
          : 'rounded focus-visible:ring-v3-shade-02',
        className,
      )}
      {...rest}
    >
      {children}
      {trailingIcon ? (
        <span className="inline-flex shrink-0 items-center" aria-hidden="true">
          {trailingIcon}
        </span>
      ) : null}
    </a>
  )
}

export default TextLink
