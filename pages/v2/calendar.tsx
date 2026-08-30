// MuMate v2 — ปฏิทินดวง month view (Figma Free-1 368:9750 / Paid-1 375:16710). Behind the v2 gate.
// Phase 3b (Lamun · Figma fidelity): the selector row and the grid are now components built from
// `get_design_context` — <DateSelector/> (ฟีม's SVG export) and <MonthGrid/> (368:9832). goo's hooks and
// routing (useCalendarMonth · dayCellTier · /v2/calendar/[date]) are untouched; NO network (mock hooks).
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { v2RedirectIfUnauthed, isV2TeamPreview } from '@/lib/v2/gate'
import { CalendarShell } from '@/features/v2-calendar/components/CalendarShell'
import { AppHeader } from '@/features/v2-shell/components/AppHeader'
import { DateSelector } from '@/features/v2-calendar/components/DateSelector'
import { MonthGrid } from '@/features/v2-calendar/components/MonthGrid'
import { CalendarSkeleton } from '@/features/v2-calendar/components/CalendarSkeleton'
import { calendarViewState } from '@/features/v2-calendar/components/calendar-view-state'
import { monthRefusalSurface } from '@/features/v2-calendar/refusal-view'
import { CalendarRefusalCard } from '@/features/v2-calendar/components/refusal/CalendarRefusalCard'
import { DailyFortuneCard } from '@/features/v2-shell/components/DailyFortuneCard'
import { PersonalCalendarPromo } from '@/features/v2-calendar/components/upsell/PersonalCalendarPromo'
import { useCalendarMonth, useDayDetail, CalendarMenuState } from '@/features/v2-calendar'
import { useClientTier } from '@/features/v2-shell/hooks/useClientTier'
import { formatThaiLongDate } from '@/utils/formate-date-thai'

export const getServerSideProps: GetServerSideProps<{ teamPreview: boolean }> = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  // Past the gate ⇒ team member — relay so the client-side ?tier= override can key off it (issue #225).
  return { props: { teamPreview: isV2TeamPreview(ctx.req) } }
}

export default function V2CalendarPage({ teamPreview }: { teamPreview: boolean }) {
  const { month, loading, refusal, year, monthIndex, todayISO, selectedDate, selectDay, goPrev, goNext, goToday } = useCalendarMonth()
  const router = useRouter()
  // Zone 4 — the paid rule lives once in goo's lib/v2/tier.ts; this page only reads the verdict.
  // `null` = not determined yet, and it is wrong to guess in EITHER direction, so both the pill and the
  // promo stay away until the tier is actually known. See the note on the promo below.
  const tier = useClientTier(teamPreview)
  const { isPaid } = tier
  // M-B — the card follows the SELECTED day, not today. goo's hook already owns the rule (selection.ts:
  // today if today is in view, else day 1, re-applied on month change), so this is a one-word change from
  // `todayISO` to `selectedDate` and NOT a second copy of the rule. Before this, tapping a day moved the
  // grid highlight while the card underneath kept describing today — one widget, two answers.
  const cardDay = month ? (month.days.find((d) => d.date === selectedDate) ?? month.days[0] ?? null) : null
  // the same payload the day-detail screen binds to — headline + the two facet lists live there, so the
  // card shows real copy instead of the hardcoded sentence the little local card carried.
  const { detail } = useDayDetail(cardDay?.date ?? '')

  // Jump to an arbitrary month by STEPPING goo's cursor, so his hook keeps the exact signature it shipped
  // with (goPrev/goNext/goToday) — the seam stays his. React batches the functional updates, so N calls
  // land as a single render.
  const goTo = (y: number, m: number) => {
    if (year === null || monthIndex === null) return // no cursor to step from (pre-mount); the row is disabled then
    const delta = (y - year) * 12 + (m - monthIndex)
    const step = delta > 0 ? goNext : goPrev
    for (let i = 0; i < Math.abs(delta); i++) step()
  }

  // M-A — the real body state, replacing goo's G-0b `return null` compile guard.
  //
  // `cardDay ? month : null` is not a trick: a month that yielded no usable day cannot paint the card, so
  // for THIS screen it is the same as having no month. Folding it in here keeps the rule total (and unit-
  // testable) instead of leaving a second, untested `|| !cardDay` guard next to it.
  const viewState = calendarViewState({ month: cardDay ? month : null, loading })
  // #530 — the server named WHICH refusal this is; the rule for what that becomes on screen lives in
  // refusal-view.ts, shared with the day screen (#529), so the two routes cannot answer differently.
  // `null` for every other empty month, so all five existing causes keep the neutral face below.
  const refusalSurface = monthRefusalSurface(refusal)

  return (
    <CalendarShell title="ปฏิทินดวง" menuState={CalendarMenuState.Normal}>
      <AppHeader title="ปฏิทินดวง" subtitle="ฤกษ์ดี วันมงคล ดิถีจีนรายวัน" membership={tier} className="items-start px-4 pb-2 pt-4" />

      {/* Nothing below the header paints until the tier is known, and that is a LAYOUT decision, not a
          loading nicety. The alternatives were both measured on this screen: let the promo arrive late and
          the grid gets shoved (ΔCLS 0.146 on a screen whose main control is a field of tap targets);
          reserve the promo's height instead and the shift simply moves to paid members when the
          reservation collapses (0.018 → 0.143). Painting the column ONCE, in its final position, is the
          only version where nobody's grid moves under their thumb — a shift needs something already
          painted to move, and here nothing is. The cost is one fetch's wait before the body appears, and
          the spinner is out of flow so it cannot shift anything either.
          The version with no wait at all is resolving the tier in getServerSideProps — goo's lane, logged
          as A2 and dispatched, not smuggled into a UI PR. */}
      {isPaid === null && (
        <div data-testid="calendar-tier-pending" aria-live="polite" className="pointer-events-none absolute inset-x-0 top-1/3 grid place-items-center">
          <span className="size-8 animate-spin rounded-full border-[3px] border-v3-sapphire/20 border-t-v3-sapphire" />
          <span className="sr-only">กำลังโหลดปฏิทิน</span>
        </div>
      )}

      {/* ONE container for every post-tier state. The skeleton and the ready column share this box on
          purpose: anything rendered here (the free-tier promo) is identical in both, so the month landing
          cannot push the page down. Keeping them in separate wrappers is what made the first version shift
          — the promo appeared only in the ready branch. */}
      {isPaid !== null && (
      <div className="flex flex-col gap-4 px-4 pt-2">
        {/* Figma Free-1 368:9750 places this between the header and the selector; Paid-1 375:16710 has no
            such card. KNOWN-free only — see the layout note above for why the undetermined tier withholds
            the whole column rather than this one card. It does NOT depend on the month, so it paints in
            both states rather than being stood in for by a grey block. */}
        {isPaid === false && <PersonalCalendarPromo />}

        {/* selector-always (2026-08-07) — OUTSIDE the ready branch, and that position is the whole PR.
            It used to live inside it, so the row of controls disappeared exactly when it was the only way
            out: month in flight, month 500, account with no birth date. Measured on main a4560da before
            the move — present in 1 of 6 states, and absent for 53 straight frames (~865ms, as long as the
            fetch takes) on an ordinary month change. It survives here because it binds to goo's CURSOR
            (year/monthIndex/goToday), which is real in every state, and never to `month`.
            Order is unchanged: promo · selector · body — so the skeleton→ready swap below cannot move it. */}
        <DateSelector year={year} monthIndex={monthIndex} onToday={goToday} onPick={goTo} />

        {/* M-A — the body is a skeleton until a month is in hand. Rendered, not merely hidden, when ready:
            the card below dereferences `cardDay` on every prop, so a `hidden` column would still evaluate
            them and crash on the very states the skeleton exists for. */}
        {/* #530 — a NAMED refusal replaces the neutral notice, and only a named one. The month arrow
            used to answer both "your package stops here" and "we cannot tell who you are" with
            CalendarSkeleton's "ลองรีเฟรชอีกครั้ง หรือตรวจว่าโปรไฟล์มีวันเกิดครบแล้ว" — two instructions
            that are wrong for both of them, on the screen we are trying to sell from.
            The DateSelector above stays put in every state (selector-always), so the way back to a month
            they CAN see is already on screen and this card points at it rather than adding a control. */}
        {viewState !== 'ready' && refusalSurface && <CalendarRefusalCard surface={refusalSurface} />}
        {viewState !== 'ready' && !refusalSurface && <CalendarSkeleton state={viewState} />}

        {viewState === 'ready' && month && cardDay && (
        <>
        <MonthGrid weeks={month.weeks} selectedDate={selectedDate} onSelect={selectDay} />

        {/* Figma 375:11100 — the card and its CTA are ONE card; the CTA was a separate button below it. */}
        {/* goo · G-2 minimal compile-guard (NOT a designed loading state — M-B/M-D own the real one): the
            day-detail fetch is async so `detail` is null while it loads. The RING falls back to the month
            cell (cardDay) so grade/% are correct from the FIRST frame (จังหวะ-1, never blank); the TEXT
            (headline/suitable/avoid) is simply empty until the fetch lands (จังหวะ-2). No layout here. */}
        <DailyFortuneCard
          variant="calendar"
          testId="calendar-daily-card"
          ring={{ grade: detail?.grade ?? cardDay.grade, percent: detail?.percent ?? cardDay.percent }}
          headline={detail?.summary ?? ''}
          dateLine={`${cardDay.date === todayISO ? 'วันนี้ · ' : ''}${formatThaiLongDate(cardDay.date) || `วันที่ ${cardDay.day}`}`}
          ganzhi={detail?.ganzhi ?? cardDay.ganzhi}
          wanPhra={cardDay.isBuddhistDay}
          suitable={detail?.suitable.slice(0, 2) ?? []}
          avoid={detail?.avoid.slice(0, 2) ?? []}
          footer={
            <button
              type="button"
              onClick={() => router.push(`/v2/calendar/${cardDay.date}`)}
              className="w-full rounded-full bg-v3-sapphire py-[14px] text-[16px] font-bold uppercase leading-6 text-v3-lime"
            >
              {/* the label has to follow the selection too. Left as "วันนี้" it becomes a quiet lie the
                  moment a user taps any other day — the card would describe the 20th under a button
                  promising today's detail, and the page it opens is the 20th. */}
              {cardDay.date === todayISO ? 'ดูรายละเอียดวันนี้' : `ดูรายละเอียดวันที่ ${cardDay.day}`}
            </button>
          }
        />
        </>
        )}
      </div>
      )}
    </CalendarShell>
  )
}
