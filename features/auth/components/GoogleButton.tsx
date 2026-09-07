import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

// GoogleButton — MuMate v2 LOGIN 1-off (DESIGN.md v3, Figma 302:259).
// NOT a Button variant: the Figma frame is a WHITE pill with a 1px #E5E7EB (border-input) stroke and
// an Oxford-navy SemiBold label — Button/tertiary (transparent + sapphire outline + sapphire Bold
// UPPERCASE) is a different component. Pill h52, px 24, icon↔label gap 12, IBM SemiBold 16/24.
export function GoogleButton({
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
        'inline-flex h-[52px] w-full select-none items-center justify-center gap-3 rounded-pill px-6',
        'border border-v3-border-input bg-white font-ibm text-base font-semibold leading-6 text-v3-navy transition',
        'hover:bg-[rgba(34,34,34,0.05)] active:bg-[rgba(34,34,34,0.05)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v3-sapphire focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-v3-disabled-bg disabled:text-white',
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

export default GoogleButton
