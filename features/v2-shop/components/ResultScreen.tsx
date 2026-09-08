// features/v2-shop/components/ResultScreen.tsx — what the user sees after trying to pay (mootech-fe#363).
//
// The words live in result-state.ts (one table, audited by scripts/result-state.test.ts). This file only
// arranges them, and its whole job is to make sure the ARRANGEMENT cannot contradict the table:
//   • the tick/cross comes from `paid`, never from the state name — so a new state cannot arrive with a
//     green tick because somebody pattern-matched on a string;
//   • the action offered comes from `retry`, so "ลองอีกครั้ง" cannot appear on a state where trying again
//     sends the user in a circle (a declined card).
import { RESULT_COPY, resultCopyFor, type ResultState } from '../result-state'
import Image from 'next/image'
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
  /** buy-qi: บรรทัดสิ่งที่ได้รับ ("แพ็กชี่ 200 ชี่") — โชว์เฉพาะสถานะ paid; สถานะอื่น/ไม่ส่ง = ไม่แสดง */
  successLine?: string | null
}

export function ResultScreen({ state, onRetrySame, onTryAnother, onDone, planName, successLine }: ResultScreenProps) {
  // #466 — resultCopyFor returns RESULT_COPY[state] untouched for every state that does not name a plan,
  // so the "one audited table" property this file relies on is unchanged.
  const copy = resultCopyFor(state, planName)
  const inFlight = state === 'PAYING'

  return (
    // 375:20499 / 402:22087 — cream ground, 24px column, everything centred; 14px between mark, words, card.
    <div data-testid="result-screen" data-state={state} data-paid={copy.paid ? '1' : '0'} className="flex w-full flex-col items-center gap-3.5 px-6 py-10 font-ibm">
      {/* The mark is derived from `paid`, not from the state's name — see the header.
          in flight → the frame's mascot export (300:2754, 72×90) · paid → check-circle 64 (402:22134) ·
          anything else → a plain "!" disc (no frame draws a failure, so nothing is invented for it). */}
      <span
        aria-hidden
        data-testid="result-mark"
        data-mark={inFlight ? 'paying' : copy.paid ? 'paid' : 'failed'}
        className={cn(
          'grid place-items-center',
          inFlight
            ? 'h-[90px] w-[72px]'
            : copy.paid
              ? 'size-16'
              : 'size-16 rounded-full bg-v3-ghost-white text-3xl text-v3-navy',
        )}
      >
        {inFlight ? (
          <Image src="/images/v2/shop/mascot-processing.png" alt="" width={72} height={90} className="h-[90px] w-[72px] object-contain" />
        ) : copy.paid ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/images/v2/shop/check-circle.svg" alt="" width={64} height={64} className="size-16" />
        ) : (
          '!'
        )}
      </span>

      {/* 402:22287 / 375:20503 — title 24 bold Sapphire; the line under it Pacific Cyan (16/24 bold in
          flight, 20/30 bold once paid). Words come from the table; only their colour is decided here. */}
      <div className="flex w-full flex-col gap-1 text-center">
        <h1 data-testid="result-title" role="status" aria-live="polite" className="text-2xl font-bold leading-normal text-v3-sapphire">
          {copy.title}
        </h1>
        <p
          data-testid="result-body"
          className={cn(
            'mx-auto max-w-sm font-bold text-v3-cyan',
            copy.paid && !inFlight ? 'text-xl leading-[30px] tracking-[0.2px]' : 'text-base leading-6',
          )}
        >
          {copy.body}
        </p>
      </div>
      {/* buy-qi — ชื่อแพ็กที่ซื้อ โชว์เฉพาะเมื่อเงินเข้าแล้วจริง (paid), อย่างอื่นเงียบไว้ก่อน */}
      {copy.paid && successLine ? (
        <p data-testid="result-success-line" className="rounded-full bg-v3-lime px-4 py-1 text-[13px] font-black text-v3-navy">
          {successLine}
        </p>
      ) : null}

      <div className="flex w-full max-w-sm flex-col gap-2 pt-0.5">
        {copy.retry === 'same' && onRetrySame && (
          <button type="button" data-testid="result-retry-same" onClick={onRetrySame} className="w-full rounded-pill bg-v3-sapphire px-5 py-[14px] text-base font-bold leading-6 text-v3-lime">
            ตรวจสอบอีกครั้ง
          </button>
        )}
        {copy.retry === 'new-qr' && onTryAnother && (
          // 🔴 NOT "ตรวจสอบอีกครั้ง". The gateway told us this QR is dead — asking again cannot revive it.
          // Same destination as "เลือกวิธีชำระเงินอื่น" (the package's checkout, which mints a new charge),
          // different words, because the words are the part that was wrong.
          <button type="button" data-testid="result-new-qr" onClick={onTryAnother} className="w-full rounded-pill bg-v3-sapphire px-5 py-[14px] text-base font-bold leading-6 text-v3-lime">
            ขอ QR ใหม่
          </button>
        )}
        {/* 🔴 #480 — THE ONE ROW THAT OFFERS TWO ACTIONS, because it is the one row that does not know
            which of two people is reading it: someone who never paid and needs a fresh QR, or someone
            whose money already left and whose row the reconciler is still working through. The sentence
            has addressed both since ฟีม เคาะทาง C (2026-08-24); only the buttons were missing.

            🔴 ORDER IS THE SAFETY DECISION, AND IT DELIBERATELY DOES NOT FOLLOW THE SENTENCE.
            The sentence leads with the unpaid case because it is the more common one. The FILLED button
            leads with checking because the two mistakes do not cost the same: an unpaid user who presses
            "ตรวจสอบอีกครั้ง" first loses a tap, while a paid user who presses "ขอ QR ใหม่" first can pay
            TWICE. This repo already made that trade once, in RECONCILING: "asking again is free, paying
            again is not." Both buttons are full width and plainly labelled, so the reader who wants the
            other one is not hunting for it — they are just not led into it. */}
        {copy.retry === 'new-qr-or-check' && (
          <>
            {onRetrySame && (
              <button type="button" data-testid="result-retry-same" onClick={onRetrySame} className="w-full rounded-pill bg-v3-sapphire px-5 py-[14px] text-base font-bold leading-6 text-v3-lime">
                ตรวจสอบอีกครั้ง
              </button>
            )}
            {onTryAnother && (
              // Same destination as the other 'new QR' routes (the package's checkout, which mints a new
              // charge). Outlined, not filled — see the order note above.
              <button type="button" data-testid="result-new-qr" onClick={onTryAnother} className="w-full rounded-pill border-[1.5px] border-v3-sapphire bg-white px-5 py-[14px] text-base font-bold leading-6 text-v3-sapphire">
                ขอ QR ใหม่
              </button>
            )}
          </>
        )}
        {copy.retry === 'buy-again' && onTryAnother && (
          // 🔴 NOT "ขอ QR ใหม่". This screen is reached by card payers too — a reversal is not a QR story.
          // Same destination as the other two (the package's checkout), different words, because the words
          // are what the reader acts on.
          <button type="button" data-testid="result-buy-again" onClick={onTryAnother} className="w-full rounded-pill bg-v3-sapphire px-5 py-[14px] text-base font-bold leading-6 text-v3-lime">
            ซื้ออีกครั้ง
          </button>
        )}
        {copy.retry === 'different' && onTryAnother && (
          // 🔴 NOT "ลองอีกครั้ง". The same card will be declined again; the way forward is another method.
          <button type="button" data-testid="result-try-another" onClick={onTryAnother} className="w-full rounded-pill bg-v3-sapphire px-5 py-[14px] text-base font-bold leading-6 text-v3-lime">
            เลือกวิธีชำระเงินอื่น
          </button>
        )}
        {!inFlight && onDone && (
          <button
            type="button"
            data-testid="result-done"
            onClick={onDone}
            className={cn(
              'w-full rounded-pill px-5 py-[14px] text-base font-bold leading-6',
              copy.retry === 'none' ? 'bg-v3-sapphire text-v3-lime' : 'border-[1.5px] border-v3-sapphire bg-white text-v3-sapphire',
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
