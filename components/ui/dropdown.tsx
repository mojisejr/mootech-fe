import { useId, type ChangeEvent } from 'react'
import { cn } from '@/lib/utils/cn'

// Dropdown — MuMate V3 design-system primitive (DESIGN.md §6, node 300-591).
//
// Contract-exact:
//   container radius 8px (NOT pill) · full width · pad 12H / 16V · bg white
//   placeholder 16px #222 · optional label 12px #717171 above · trailing chevron 16px
//   States — default/hover: border 1px #B0B0B0 · focus: border 2px #222 · loading: ellipses
//
// Native <select> under the hood: keyboard/screen-reader accessible for free, custom chevron
// via appearance-none. Thai UI text renders in IBM Plex Sans Thai (font-ibm) per the V3 ramp
// (the Figma master shows Poppins only because it uses a Latin placeholder).

export type DropdownOption = { label: string; value: string }

export type DropdownState = 'default' | 'loading'

type DropdownProps = {
  options?: DropdownOption[]
  value?: string
  onChange?: (value: string) => void
  label?: string
  placeholder: string
  state?: DropdownState
  /** Optional explicit id — otherwise a stable auto-id links label ↔ control. */
  id?: string
  disabled?: boolean
  className?: string
}

export function Dropdown({
  options = [],
  value,
  onChange,
  label,
  placeholder,
  state = 'default',
  id,
  disabled,
  className,
}: DropdownProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  const isLoading = state === 'loading'
  const isDisabled = disabled || isLoading
  const hasValue = value !== undefined && value !== ''

  // Controlled only when an onChange handler is supplied. If `value` is passed
  // without one, drive the native <select> uncontrolled (defaultValue) so React
  // neither warns about a missing handler nor silently locks the field.
  const controlProps: {
    value?: string
    defaultValue?: string
    onChange?: (e: ChangeEvent<HTMLSelectElement>) => void
  } = onChange
    ? { value: value ?? '', onChange: (e) => onChange(e.target.value) }
    : { defaultValue: value ?? '' }

  return (
    <div className={cn('w-full font-ibm', className)}>
      {label && (
        <label
          htmlFor={selectId}
          className="mb-2 block text-xs leading-tight text-v3-dropdown-label"
        >
          {label}
        </label>
      )}

      <div className="relative w-full">
        <select
          id={selectId}
          {...controlProps}
          disabled={isDisabled}
          aria-label={label ?? placeholder}
          aria-busy={isLoading || undefined}
          className={cn(
            // shape + box: 8px radius, full width, 12H/16V padding, white surface
            'w-full appearance-none rounded-lg bg-white px-3 py-4',
            // type: 16px, IBM Plex Sans Thai; leave room for the trailing chevron
            'pr-10 text-base leading-6',
            // default/hover border 1px #B0B0B0 → focus border 2px #222 (border-box: no outer shift)
            'border border-v3-border-dropdown outline-none',
            'focus:border-2 focus:border-v3-shade-02',
            // filled value #212121, placeholder #222 (both dark per contract)
            hasValue ? 'text-v3-text-filled' : 'text-v3-shade-02',
            // Non-interactive while loading OR disabled — but only the `disabled`
            // prop dims to opacity-60. Loading keeps full opacity (border + ellipses
            // are the only loading affordance per DESIGN §6); it must not grey out.
            isDisabled && 'cursor-not-allowed',
            disabled && 'opacity-60',
          )}
        >
          {!hasValue && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Trailing 16px indicator — ellipsis while loading, chevron otherwise. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-v3-shade-02"
        >
          {isLoading ? (
            <span className="flex items-center gap-1">
              <span className="h-1 w-1 animate-pulse rounded-full bg-current [animation-delay:-0.2s]" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-current" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-current [animation-delay:0.2s]" />
            </span>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      </div>
    </div>
  )
}
