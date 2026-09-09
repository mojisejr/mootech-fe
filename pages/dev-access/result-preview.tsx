// DEV-ONLY — the payment RESULT screen in every state, no login, no charge, no database.
//
// WHY THIS HARNESS EXISTS. Two bugs on this screen were found in a PHOTOGRAPH and by nothing else:
//   mootech-fe#455  QR_EXPIRED said "ขอ QR ใหม่ได้เลย" while drawing only "ตรวจสอบอีกครั้ง"
//   mootech-fe#480  QR_MAYBE_EXPIRED promised two actions and drew one
// Both had a full green suite. Unit tests read the table and the DOM; they cannot see that a sentence
// names a button that is not there, or that a Thai line wraps badly at 393 (mootech-fe#414's class).
// Reaching this screen for real needs a session, a charge and a webhook, so the only way anyone looked
// at it was to buy something. That is why nobody looked.
//
// Open /dev-access/result-preview to see every state at once, or ?state=QR_MAYBE_EXPIRED for one.
import { useRouter } from 'next/router'
import { ResultScreen } from '@/features/v2-shop/components/ResultScreen'
import { RESULT_COPY, type ResultState } from '@/features/v2-shop/result-state'

const STATES = Object.keys(RESULT_COPY) as ResultState[]
const noop = () => {}

export default function ResultPreviewPage() {
  const router = useRouter()
  const q = typeof router.query.state === 'string' ? router.query.state : ''
  const only = STATES.includes(q as ResultState) ? (q as ResultState) : null
  const shown = only ? [only] : STATES

  return (
    <main className="min-h-screen bg-v3-bg-cream">
      {shown.map((s) => (
        <section key={s} data-preview-state={s} className="border-b border-v3-border-card">
          {/* Not part of the screen — the label is here so a screenshot of all thirteen is readable. */}
          {!only && <p className="px-6 pt-4 text-xs font-bold text-v3-cyan">{s}</p>}
          <ResultScreen
            state={s}
            onRetrySame={noop}
            onTryAnother={noop}
            onDone={noop}
            planName={s === 'ALREADY_ON_THIS_TIER' || s === 'CANNOT_DOWNGRADE' ? 'Mumate Pro' : null}
            successLine={RESULT_COPY[s].paid ? 'แพ็กชี่ 200 ชี่' : null}
          />
        </section>
      ))}
    </main>
  )
}
