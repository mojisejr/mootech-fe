import type { InputHTMLAttributes, ReactNode } from 'react'
import { useId } from 'react'
import { cn } from '@/lib/utils/cn'

// Input / Field — V3 pill primitive (DESIGN.md §6 "Input / Field — pill").
// h52 · radius pill · pad 20H/14V · bg white · placeholder 16/24 #9CA3AF · filled value #212121.
// States: default/hover 1px #E5E7EB · focus 2px #3475E2 · error 2px #E73E3E (+ label/helper #E73E3E).
// Exports both `Input` (bare control, no label) and `Field` (label + input + helper wrapper).

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  /** Red 2px border + is surfaced by Field on the label/helper too. */
  error?: boolean
  /** Trailing glyph, rendered at 20×20 inside the pill. */
  trailingIcon?: ReactNode
  /** Class on the outer pill container (border/bg live here so focus-within works with a trailing icon). */
  containerClassName?: string
}

// Bare pill control — the border/focus/error styling lives on a container so a trailing
// icon can sit inside the same pill and focus-within can light the whole field.
export function Input({ error, trailingIcon, containerClassName, className, disabled, ...rest }: InputProps) {
  return (
    <div
      className={cn(
        'flex h-[52px] items-center rounded-pill bg-moumate_white px-5 py-[14px] transition-colors',
        // default/hover 1px → focus 2px #3475E2. error overrides to 2px #E73E3E.
        error
          ? 'border-2 border-v3-error'
          : 'border border-v3-border-input focus-within:border-2 focus-within:border-v3-focus-border',
        disabled && 'opacity-50',
        containerClassName,
      )}
    >
      <input
        disabled={disabled}
        aria-invalid={error || undefined}
        className={cn(
          'min-w-0 flex-1 bg-transparent font-ibm text-base leading-6 text-v3-text-filled outline-none',
          'placeholder:text-v3-placeholder disabled:cursor-not-allowed',
          className,
        )}
        {...rest}
      />
      {trailingIcon != null && (
        <span
          aria-hidden="true"
          className="ml-3 flex h-5 w-5 shrink-0 items-center justify-center text-v3-placeholder [&_svg]:h-5 [&_svg]:w-5"
        >
          {trailingIcon}
        </span>
      )}
    </div>
  )
}

export type FieldProps = InputProps & {
  /** Label above the input, 14/20 SemiBold. Turns #E73E3E on error. */
  label?: string
  /** Helper text below, 12px. Turns #E73E3E on error. */
  helper?: string
}

// Full field: label above + Input + helper below. Wires htmlFor/aria-describedby for a11y.
export function Field({ label, helper, error, id, className, containerClassName, ...inputProps }: FieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const helperId = helper ? `${inputId}-helper` : undefined

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className={cn(
            'mb-2 block font-ibm text-sm font-semibold leading-5',
            error ? 'text-v3-error' : 'text-v3-text-body',
          )}
        >
          {label}
        </label>
      )}
      <Input
        id={inputId}
        error={error}
        aria-describedby={helperId}
        className={className}
        containerClassName={containerClassName}
        {...inputProps}
      />
      {helper && (
        <p
          id={helperId}
          className={cn(
            'mt-2 font-ibm text-xs leading-[18px]',
            error ? 'text-v3-error' : 'text-v3-text-muted',
          )}
        >
          {helper}
        </p>
      )}
    </div>
  )
}
