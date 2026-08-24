// features/v2-shop/components/PaymentMethodPicker.tsx — how the user pays (mootech-fe#363).
// Figma 55159:5349 gives the SHAPE (three equal tiles, icon chip over a 12/18 label, selected = 1.5px
// sapphire ring). It does NOT give the CONTENTS: the frame offers Credit/debit · Bank Transfer · Cash App,
// and we sell Credit/debit · PromptPay. So two tiles leave and one that was never drawn arrives.
//
// 🔴 "ซ่อน ไม่ลบออกจากโค้ด" (ticket). The two we do not sell keep their definitions below with
// `enabled: false` — turning either back on is one word — but they are NOT RENDERED, so they cannot be
// tapped, read by a screen reader, or found by a test that only looks at the DOM. Hiding with CSS would
// have left them tappable to a keyboard and audible to assistive tech, which is not hidden, it is invisible.
//
// 🔴 THE PROMPTPAY TILE IS DRAWN, NOT EXPORTED — and its icon is deliberately NOT a PromptPay logo.
// The design has no PromptPay anything, and this repo has no PromptPay brand asset (searched public/ and
// v1's QR flow). At a payment step people recognise a method by its mark, so the RIGHT fix is the official
// asset; the wrong fix is a logo I redrew from memory, which is a counterfeit mark on a payment screen.
// Until the asset exists this tile carries a neutral QR glyph plus the word พร้อมเพย์, which claims nothing
// it cannot back. Flagged in the PR as a known gap, not as done.
import { cn } from '@/lib/utils/cn'

export type PayMethod = 'card' | 'promptpay'

type MethodDef = { id: string; label: string; enabled: boolean }

/** The full menu the design drew, plus ours. `enabled` is the only switch — see the note above. */
export const METHODS: MethodDef[] = [
  { id: 'card', label: 'Credit/debit', enabled: true },
  { id: 'promptpay', label: 'พร้อมเพย์', enabled: true },
  { id: 'bank', label: 'Bank Transfer', enabled: false }, // drawn (55159:5355) — we do not sell it
  { id: 'cashapp', label: 'Cash App', enabled: false }, // drawn (55159:5359) — we do not sell it
]

function CardGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

// A QR mark, not a brand mark — see the header note.
function QrGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 14h3v3h-3zM19 19h2v2h-2zM14 19h2v2h-2zM19 14h2v2h-2z" fill="currentColor" />
    </svg>
  )
}

const GLYPH: Record<string, () => JSX.Element> = { card: CardGlyph, promptpay: QrGlyph }

export function PaymentMethodPicker({ value, onChange }: { value: PayMethod; onChange: (m: PayMethod) => void }) {
  const shown = METHODS.filter((m) => m.enabled)
  return (
    <div data-testid="method-picker" role="radiogroup" aria-label="วิธีชำระเงิน" className="flex w-full items-start gap-2 font-ibm">
      {shown.map((m) => {
        const selected = m.id === value
        const Glyph = GLYPH[m.id] ?? CardGlyph
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={selected}
            data-testid={`method-${m.id}`}
            onClick={() => onChange(m.id as PayMethod)}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center justify-center gap-2.5 rounded-2xl p-3 transition-colors',
              selected ? 'border-[1.5px] border-v3-sapphire' : 'border border-v3-border-input',
            )}
          >
            {/* icon chip. #F3F4F6 is 5.1 RGB from v3-tab-focus — invisibly close, but that token's NAME is
                about tabs. One use does not earn a new token; a second one will. Recorded in the PR. */}
            <span className={cn('rounded-lg bg-[#F3F4F6] p-1.5', selected ? 'text-v3-sapphire' : 'text-v3-navy')}>
              <Glyph />
            </span>
            <span className="w-full text-center text-xs leading-[18px] text-v3-navy">{m.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default PaymentMethodPicker
