// features/v2-shop/components/DiscountCodeField.tsx — the discount-code block on checkout (mootech-fe#363).
// Figma: component 55159:5611 (State=Default | Success | Error) · read via get_design_context, not from a
// screenshot — the three states differ in ways a picture does not spell out (see the button note below).
//
// 🔴 THIS COMPONENT NEVER COMPUTES MONEY. It renders what the server already decided and reports the user's
// intent upward. The saved amount in the chip and in the helper line is `savedText`, handed in by the caller
// from the /api/v2/payment/preview response — the screen has no arithmetic in it at all (ticket rule: "ทุกยอด
// บนจอตรงกับที่ server คำนวณ — จอไม่คิดเลขเอง"). A component that can add is a component that can disagree.
//
// WHY NOT <Input/> (components/ui/input.tsx): that primitive is the 52px pill from DESIGN.md §6, and this
// field is drawn at ~40px because it shares a row with the ใช้ button inside a card. Forcing the tall pill
// here would either break the row or silently restyle every other Field in the app. Same TOKENS, different
// size — the design system is the palette and the shapes, not one fixed height.
//
// 🔹 The ใช้ button is OUTLINED in Default and FILLED in Error — that is what the component actually says
//    (55159:5584 vs 55159:5606), not something added here. It reads as intent: in the error state, retrying
//    is the one thing to do next, so the control that retries stops being quiet.
import { cn } from '@/lib/utils/cn'

export type DiscountState = 'default' | 'success' | 'error'

export type DiscountCodeFieldProps = {
  /**
   * 🔴 `inline` IS THE REAL USAGE, and getting this wrong was a card-in-card on the checkout screen.
   * Component 55159:5611 is drawn WITH card chrome because a component sheet shows things standing alone.
   * Where it is actually used — 55162:352, inside the Order Summary Card — it has no background, no border,
   * no radius and no padding: it is a label row and an input row between two summary lines. Building from
   * the component and skipping the instance produced a white bordered box floating inside another white
   * bordered box. Caught by looking at the rendered screen next to the frame, not by any assertion.
   */
  variant?: 'inline' | 'card'
  state: DiscountState
  /** The code the user typed / the code that was applied. Controlled — checkout owns it. */
  value: string
  onChange: (v: string) => void
  /** ใช้ — hand the current value to the caller, which asks the SERVER whether it is honourable. */
  onApply: () => void
  /** ✕ on the applied chip — drop the code and re-price. Success state only. */
  onClear: () => void
  /** Server-formatted saved amount, e.g. "฿159". Absent in default/error. NEVER derived here. */
  savedText?: string
  /** Server's reason, shown verbatim under the field. Falls back to the design's copy. */
  errorText?: string
  busy?: boolean
}

// 55162:352 — the instance: a plain column, 10px gaps, nothing drawn around it.
const INLINE = 'flex w-full flex-col gap-2.5 font-ibm'
// 55159:5611 — the standalone component, kept for anywhere it is shown on its own (the showcase page).
const CARD = 'flex w-full flex-col gap-3 rounded-[20px] border-[0.5px] border-v3-border-input bg-white p-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.04)] font-ibm'
// instance sizes (55162:358/360): 13px text, 14/8 and 16/8 padding — smaller than the standalone's 14/16 & 10.
const PILL = 'flex min-w-0 flex-1 items-center rounded-pill bg-white px-3.5 py-2 text-[13px] leading-normal'
const APPLY = 'shrink-0 rounded-pill px-4 py-2 text-[13px] font-medium leading-normal transition-colors disabled:opacity-50'

/** The design's own words. Kept as a constant so the copy audit in the PR has one place to point at. */
export const DISCOUNT_ERROR_FALLBACK = 'โค้ดไม่ถูกต้องหรือหมดอายุแล้ว'
export const DISCOUNT_LABEL = 'โค้ดส่วนลด (ถ้ามี)'
export const DISCOUNT_PLACEHOLDER = 'กรอกโค้ดส่วนลด'

export function DiscountCodeField({ variant = 'inline', state, value, onChange, onApply, onClear, savedText, errorText, busy = false }: DiscountCodeFieldProps) {
  const isError = state === 'error'
  const isSuccess = state === 'success'

  return (
    <section data-testid="discount-field" data-state={state} data-variant={variant} className={variant === 'card' ? CARD : INLINE} aria-label={DISCOUNT_LABEL}>
      <div className="flex items-center gap-1.5">
        {/* 🔥 is decoration in the design (55162:355) — aria-hidden so a screen reader reads the label once. */}
        <span aria-hidden className="text-base leading-none">🔥</span>
        <span className="text-sm font-medium text-v3-sapphire">{DISCOUNT_LABEL}</span>
      </div>

      {!isSuccess && (
        <div className="flex items-center gap-2">
          <div className={cn(PILL, isError ? 'border-[1.5px] border-v3-error' : 'border border-v3-border-input')}>
            <input
              data-testid="discount-input"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={DISCOUNT_PLACEHOLDER}
              aria-invalid={isError || undefined}
              aria-describedby={isError ? 'discount-helper' : undefined}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className={cn(
                'min-w-0 flex-1 bg-transparent outline-none placeholder:text-v3-text-muted',
                isError ? 'text-v3-error-legacy' : 'text-v3-text-filled',
              )}
            />
          </div>
          <button
            type="button"
            data-testid="discount-apply"
            onClick={onApply}
            // Empty code + ใช้ would ask the server to price nothing. Untouched-and-empty is the resting
            // state, so the control is inert rather than an error waiting to happen.
            disabled={busy || value.trim() === ''}
            className={cn(
              APPLY,
              isError
                ? 'bg-v3-sapphire text-white'
                : 'border-[1.5px] border-v3-sapphire bg-white text-v3-sapphire',
            )}
          >
            ใช้
          </button>
        </div>
      )}

      {isSuccess && (
        <div data-testid="discount-chip" className="flex w-full items-center gap-2 rounded-pill border border-v3-success-border bg-v3-success-bg px-3 py-2">
          <span aria-hidden className="grid size-4 shrink-0 place-items-center rounded-lg bg-v3-success-border text-[10px] font-bold text-white">✓</span>
          <span className="text-sm font-bold text-v3-success-text">{value}</span>
          <span className="h-px min-w-0 flex-1" />
          <span data-testid="discount-saved" className="text-sm font-bold text-v3-success-text">−{savedText}</span>
          <button type="button" data-testid="discount-clear" onClick={onClear} aria-label="เอาโค้ดส่วนลดออก" className="text-sm font-medium text-v3-success-text">
            ✕
          </button>
        </div>
      )}

      {(isSuccess || isError) && (
        <p id="discount-helper" data-testid="discount-helper" role={isError ? 'alert' : 'status'} className="flex items-center gap-1 text-[13px] leading-normal">
          {isSuccess ? (
            <>
              <span aria-hidden>✨</span>
              <span className="text-v3-success-text">ใช้โค้ดสำเร็จ! ประหยัด {savedText}</span>
            </>
          ) : (
            <>
              <span aria-hidden className="size-3.5 shrink-0 rounded-[7px] bg-v3-error" />
              <span className="text-v3-error-legacy">{errorText || DISCOUNT_ERROR_FALLBACK}</span>
            </>
          )}
        </p>
      )}
    </section>
  )
}

export default DiscountCodeField
