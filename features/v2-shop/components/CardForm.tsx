// features/v2-shop/components/CardForm.tsx — the card fields (mootech-fe#363), Figma 55159:5363.
//
// Order and wording come from the frame and are NOT the ones the ticket previously assumed:
//   ชื่อบนบัตร → หมายเลขบัตร → วันหมดอายุ + CVC     (and it says CVC, never CVV)
// The auto-renewal checkbox below is the frame's (55159:5541) with the tick REMOVED and the control inert:
// round one has no auto-renewal, so a checkbox the user can turn on would promise something we will not do.
import { cn } from '@/lib/utils/cn'

export type CardState = { name: string; number: string; expiry: string; cvc: string }

const FIELD = 'w-full rounded-pill border border-v3-border-input bg-white px-5 py-3.5 text-base leading-6 text-v3-text-filled outline-none placeholder:text-v3-placeholder focus:border-2 focus:border-v3-focus-border'
const LABEL = 'text-sm font-medium leading-5 text-v3-text-body-alt'

export const RENEWAL_LABEL = 'บันทึกบัตรนี้ไว้สำหรับการต่ออายุอัตโนมัติ'

export function CardForm({ value, onChange }: { value: CardState; onChange: (v: CardState) => void }) {
  const set = (k: keyof CardState) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value })
  return (
    <div data-testid="card-form" className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>ชื่อบนบัตร</span>
        <input data-testid="card-name" value={value.name} onChange={set('name')} placeholder="David Watson" autoComplete="cc-name" className={FIELD} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>หมายเลขบัตร</span>
        <input data-testid="card-number" value={value.number} onChange={set('number')} placeholder="4645 75345 4546 1345" inputMode="numeric" autoComplete="cc-number" className={FIELD} />
      </label>
      <div className="flex gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className={LABEL}>วันหมดอายุ</span>
          <input data-testid="card-expiry" value={value.expiry} onChange={set('expiry')} placeholder="04/2026" inputMode="numeric" autoComplete="cc-exp" className={FIELD} />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          {/* the frame says CVC. */}
          <span className={LABEL}>CVC</span>
          <input data-testid="card-cvc" value={value.cvc} onChange={set('cvc')} placeholder="457" inputMode="numeric" autoComplete="cc-csc" className={FIELD} />
        </label>
      </div>

      {/* 🔴 Present, faded, unticked and INERT — see the header. `disabled` also keeps it out of the tab order,
          so it cannot be switched on by keyboard either. */}
      <div className={cn('flex items-center gap-2 opacity-50')}>
        <input data-testid="card-renewal" type="checkbox" checked={false} disabled readOnly aria-label={RENEWAL_LABEL} className="size-4 rounded border-v3-border-checkbox" />
        <span className="text-sm leading-5 text-v3-text-body">{RENEWAL_LABEL}</span>
        <span data-testid="card-renewal-soon" className="rounded-full bg-v3-ghost-white px-2 py-0.5 text-xs text-v3-sapphire">เร็วๆ นี้</span>
      </div>
    </div>
  )
}

export default CardForm
