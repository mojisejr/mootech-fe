// features/v2-shop/components/ResultScreen.tsx — what the user sees after trying to pay (mootech-fe#363).
//
// The words live in result-state.ts (one table, audited by scripts/result-state.test.ts). This file only
// arranges them, and its whole job is to make sure the ARRANGEMENT cannot contradict the table:
//   • the tick/cross comes from `paid`, never from the state name — so a new state cannot arrive with a
//     green tick because somebody pattern-matched on a string;
//   • the action offered comes from `retry`, so "ลองอีกครั้ง" cannot appear on a state where trying again
//     sends the user in a circle (a declined card).
import { RESULT_COPY, resultCopyFor, type ResultState } from '../result-state'
import { cn } from '@/lib/utils/cn'

export type ResultScreenProps = {
  state: ResultState
  /** offered when retry is 'same' — poll once more / re-open the same QR. */
  onRetrySame?: () => void
  /** offered when retry is 'different' — back to the method picker, not to the same card. */
  onTryAnother?: () => void
  /** always available once nothing is in flight: go use the thing they bought (or came back for). */
  onDone?: () => void
  /** #466 — the plan to NAME in a refusal ("คุณเป็นสมาชิก Mumate + อยู่แล้ว"). Absent/unknown ⇒ the table's
   *  tier-less wording, which is still true. Ignored by the other seven states. */
  planName?: string | null
}

export function ResultScreen({ state, onRetrySame, onTryAnother, onDone, planName }: ResultScreenProps) {
  // #466 — resultCopyFor returns RESULT_COPY[state] untouched for every state that does not name a plan,
  // so the "one audited table" property this file relies on is unchanged.
  const copy = resultCopyFor(state, planName)
  const inFlight = state === 'PAYING'

  return (
    <div data-testid="result-screen" data-state={state} data-paid={copy.paid ? '1' : '0'} className="flex w-full flex-col items-center gap-4 px-4 py-10 font-ibm">
      {/* The mark is derived from `paid`, not from the state's name — see the header. */}
      <span
        aria-hidden
        data-testid="result-mark"
        className={cn(
          'grid size-16 place-items-center rounded-full text-3xl',
          inFlight ? 'bg-v3-ghost-white text-v3-sapphire' : copy.paid ? 'bg-v3-success-bg text-v3-success-text' : 'bg-v3-ghost-white text-v3-navy',
        )}
      >
        {inFlight ? '…' : copy.paid ? '✓' : '!'}
      </span>

      <h1 data-testid="result-title" role="status" aria-live="polite" className="text-center text-2xl font-bold leading-8 text-v3-navy">
        {copy.title}
      </h1>
      <p data-testid="result-body" className="max-w-sm text-center text-sm leading-[22px] text-v3-text-body">
        {copy.body}
      </p>

      <div className="flex w-full max-w-sm flex-col gap-2">
        {copy.retry === 'same' && onRetrySame && (
          <button type="button" data-testid="result-retry-same" onClick={onRetrySame} className="w-full rounded-pill bg-v3-sapphire px-5 py-3 text-sm font-medium text-white">
            ตรวจสอบอีกครั้ง
          </button>
        )}
        {copy.retry === 'new-qr' && onTryAnother && (
          // 🔴 NOT "ตรวจสอบอีกครั้ง". The gateway told us this QR is dead — asking again cannot revive it.
          // Same destination as "เลือกวิธีชำระเงินอื่น" (the package's checkout, which mints a new charge),
          // different words, because the words are the part that was wrong.
          <button type="button" data-testid="result-new-qr" onClick={onTryAnother} className="w-full rounded-pill bg-v3-sapphire px-5 py-3 text-sm font-medium text-white">
            ขอ QR ใหม่
          </button>
        )}
        {copy.retry === 'different' && onTryAnother && (
          // 🔴 NOT "ลองอีกครั้ง". The same card will be declined again; the way forward is another method.
          <button type="button" data-testid="result-try-another" onClick={onTryAnother} className="w-full rounded-pill bg-v3-sapphire px-5 py-3 text-sm font-medium text-white">
            เลือกวิธีชำระเงินอื่น
          </button>
        )}
        {!inFlight && onDone && (
          <button
            type="button"
            data-testid="result-done"
            onClick={onDone}
            className={cn(
              'w-full rounded-pill px-5 py-3 text-sm font-medium',
              copy.retry === 'none' ? 'bg-v3-sapphire text-white' : 'border-[1.5px] border-v3-sapphire bg-white text-v3-sapphire',
            )}
          >
            {copy.paid ? 'เริ่มใช้งาน' : 'กลับหน้าแพ็กเกจ'}
          </button>
        )}
      </div>
    </div>
  )
}

export default ResultScreen
