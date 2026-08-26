// features/v2-account/components/HistoryCard.tsx — การ์ด "ประวัติการซื้อ" ของจอ #365.
//
// Its own file so it can be RENDERED in a test without mounting AccountScreen, which pulls useV2User →
// next/config → the whole identity stack. The bug ตู๋ found at 8cbe56b (a failed fetch rendering as
// "ยังไม่มีรายการ") was invisible to the suite precisely because nothing could render this card on its own.
import type { HistoryState } from '../payment-history'

const CARD = 'flex w-full flex-col gap-4 rounded-[20px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]'

export function HistoryCard({ state, onRetry }: { state: HistoryState; onRetry: () => void }) {
  return (
    <>
      <h2 className="mt-6 text-base font-bold leading-6 text-v3-navy">ประวัติการซื้อ</h2>
      <section data-testid="account-history" className={`${CARD} mt-3 font-ibm`}>
        {state.kind === 'loading' && (
          <div data-testid="account-history-loading" aria-hidden className="h-5 w-2/3 animate-pulse rounded bg-v3-border-card" />
        )}

        {/* 🔴 THE WHOLE POINT OF THIS BRANCH: a failed read is OUR failure, and it must not be reported as a
            fact about the person. "ยังไม่มีรายการ" tells a paying member they never bought anything, on the
            screen they opened to confirm that they did. Different words, and a way to try again. */}
        {state.kind === 'error' && (
          <div data-testid="account-history-error" className="flex w-full flex-col gap-3">
            <p className="text-sm leading-[22px] text-v3-text-body">โหลดประวัติการซื้อไม่สำเร็จ</p>
            <button
              type="button"
              data-testid="account-history-retry"
              onClick={onRetry}
              className="self-start text-sm font-bold leading-5 text-v3-cyan"
            >
              ลองอีกครั้ง
            </button>
          </div>
        )}

        {/* An empty list says so — hiding the card would make a member who HAS bought something wonder
            whether the screen failed. This is only reached when the request actually SUCCEEDED. */}
        {state.kind === 'empty' && (
          <p data-testid="account-history-empty" className="text-sm leading-[22px] text-v3-text-body">ยังไม่มีรายการ</p>
        )}

        {state.kind === 'items' &&
          state.items.map((it, i) => (
            <div key={it.key} className="flex w-full flex-col gap-2">
              {i > 0 && <hr className="w-full border-t border-v3-border-card" />}
              <p className="text-sm font-bold leading-5 text-v3-navy">{it.title}</p>
              <div className="flex w-full items-baseline justify-between text-sm">
                <p className="leading-[22px] text-v3-text-body">{it.dateText}</p>
                <p className="font-bold leading-5 text-v3-navy">{it.amountText}</p>
              </div>
            </div>
          ))}
      </section>
      <p className="mt-2 px-1 text-xs leading-[18px] text-v3-text-body">ใบเสร็จส่งไปที่อีเมลของคุณแล้ว</p>
    </>
  )
}
