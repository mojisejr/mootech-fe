// features/v2-calendar/components/CalendarSkeleton.tsx — the calendar body's two non-month screens.
//
// Replaces goo's `if (!month || !cardDay) return null` (G-0b, explicitly labelled a compile guard and not a
// designed state). A blank screen while a personalised month is fetched reads as "this page is broken".
//
// TWO SCREENS, NOT ONE — and that distinction is the whole reason this file is careful. See
// calendar-view-state.ts: three of goo's settled branches end with no month at all (anon · user-row error ·
// no birth date), so `!month` is not "loading". Pulsing at a user who will never get a month is worse than
// the blank screen it replaces: blank reads as broken and they leave, a pulse reads as "any second now" and
// they wait. So `loading` pulses and `unavailable` does not — the animation IS the claim that work is
// happening, and it is only made when that is true.
//
// (V2HomeScreen's FortuneSkeleton keeps its pulse in the empty case. Diverging deliberately, not drifting:
// its empty state is one card inside an otherwise live screen, this one is the entire body.)
//
// SHAPE mirrors the real body — selector bar · grid card · fortune card — built from the SAME structural
// classes as the components it stands in for, so the heights come out of one box model instead of hand-typed
// pixel constants that rot the moment the real component changes. The week-row count is the one thing it
// cannot know (a month has 5 or 6 rows), so it reserves the maximum; the resulting shift is MEASURED and
// reported in the PR evidence rather than assumed to be fine.
const BLOCK = 'rounded bg-v3-border-card'

/** One placeholder week — seven cells with the real cell's padding and gap, so the row height is real. */
function SkeletonWeek() {
  return (
    <div className="flex w-full gap-[2px]" aria-hidden>
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} className="flex min-w-0 flex-1 flex-col items-center justify-center gap-px rounded-[11px] border-[1.6px] border-transparent py-[3px] leading-none">
          <span className={`block h-[13px] w-3/5 ${BLOCK}`} />
          <span className={`block h-[12px] w-2/5 ${BLOCK}`} />
        </span>
      ))}
    </div>
  )
}

/**
 * `state` is the verdict from calendarViewState — this component never re-derives it, so the rule CI proves
 * and the pixels a user sees cannot disagree.
 */
export function CalendarSkeleton({ state }: { state: 'loading' | 'unavailable' }) {
  const loading = state === 'loading'
  return (
    <div
      data-testid="calendar-skeleton"
      data-state={state}
      // aria-busy states the same thing the pulse does, for people who cannot see the pulse.
      aria-busy={loading || undefined}
      aria-live="polite"
      // No padding of its own: the page wraps BOTH this and the ready column in one container, so the two
      // states cannot drift apart geometrically. (First version padded itself and omitted the free-tier
      // promo that the ready column renders — so the month landing pushed the whole page down by a card.)
      className="flex flex-col gap-4"
    >
      {/* The scaffolding is drawn ONLY while loading. Turning the pulse off but leaving a full grey grid
          standing was the first version, and looking at the render settled it: an empty calendar frame is
          itself a promise that days are about to appear in it. The words underneath then read as a second,
          contradicting message. A settled screen with nothing to show says so and stops drawing furniture. */}
      {loading && (
      <div className="flex flex-col gap-4 animate-pulse">
        {/* selector bar — the real one shows a month, and showing the WRONG month (the cursor falls back to
            the fixture constants before it resolves) would be worse than showing none */}
        <div className="flex items-center gap-2">
          <span className={`h-[46px] flex-1 ${BLOCK}`} />
          <span className={`h-[46px] flex-1 ${BLOCK}`} />
          <span className={`h-[46px] flex-1 ${BLOCK}`} />
        </div>

        {/* grid card — same padding/gaps as MonthGrid's section, six rows reserved (the maximum a month
            occupies) because the real count is not knowable until the month lands */}
        <div className="flex flex-col gap-[14px] overflow-hidden rounded-[20px] bg-white p-4 shadow-[0_4px_14px_rgba(26,38,77,0.06)]">
          <div className="flex w-full">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i} className="flex flex-1 items-center justify-center pb-[6px] pt-[2px]">
                <span className={`block h-[18px] w-4 ${BLOCK}`} />
              </span>
            ))}
          </div>
          <div className="flex w-full flex-col gap-[2px]">
            {Array.from({ length: 6 }, (_, i) => <SkeletonWeek key={i} />)}
          </div>
          <hr className="border-t border-v3-border-card" />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className={`size-[14px] shrink-0 rounded-[5px] ${BLOCK}`} />
                <span className={`block h-[9px] w-12 ${BLOCK}`} />
              </span>
            ))}
          </div>
        </div>

        {/* fortune card — the ring is 90px in both variants, so this one number is safe to mirror */}
        <div className="flex flex-col gap-4 rounded-[20px] bg-white p-4 shadow-[0_4px_14px_rgba(26,38,77,0.06)]">
          <div className="flex items-center gap-4">
            <span className={`size-[90px] shrink-0 rounded-full bg-v3-border-card`} />
            <span className="min-w-0 flex-1 space-y-2">
              <span className={`block h-4 w-4/5 ${BLOCK}`} />
              <span className={`block h-4 w-3/5 ${BLOCK}`} />
            </span>
          </div>
          <span className={`block h-[52px] w-full rounded-full bg-v3-border-card`} />
        </div>
      </div>
      )}

      {/* The settled-empty screen SAYS something. It cannot say WHY (all three causes look identical at
          goo's seam — see calendar-view-state.ts), and inventing a cause here would be worse than being
          plain: a wrong instruction ("กรอกวันเกิด") sends someone who is actually hitting a network error to
          a settings page that will not help them. */}
      {!loading && (
        <div data-testid="calendar-unavailable" className="flex min-h-[320px] flex-col items-center justify-center gap-2 px-6 text-center">
          <span aria-hidden className="grid size-12 place-items-center rounded-full bg-white text-2xl shadow-[0_4px_14px_rgba(26,38,77,0.06)]">🗓️</span>
          <p className="text-base font-bold leading-6 text-v3-navy">ยังแสดงปฏิทินของคุณไม่ได้ตอนนี้</p>
          <p className="text-sm font-medium leading-6 text-v3-text-muted">
            ลองรีเฟรชอีกครั้ง หรือตรวจว่าโปรไฟล์มีวันเกิดครบแล้ว
          </p>
        </div>
      )}
    </div>
  )
}

export default CalendarSkeleton
