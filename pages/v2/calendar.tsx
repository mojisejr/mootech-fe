// MuMate v2 — ปฏิทินดวง month view (Figma Free-1 368:9750 / Paid-1 375:16710). Behind the v2 gate.
// Phase 3b (Lamun · Figma fidelity): the selector row and the grid are now components built from
// `get_design_context` — <DateSelector/> (ฟีม's SVG export) and <MonthGrid/> (368:9832). goo's hooks and
// routing (useCalendarMonth · dayCellTier · /v2/calendar/[date]) are untouched; NO network (mock hooks).
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { CalendarShell } from '@/features/v2-calendar/components/CalendarShell'
import { AppHeader } from '@/features/v2-shell/components/AppHeader'
import { DateSelector } from '@/features/v2-calendar/components/DateSelector'
import { MonthGrid } from '@/features/v2-calendar/components/MonthGrid'
import { DailyFortuneCard } from '@/features/v2-shell/components/DailyFortuneCard'
import { PersonalCalendarPromo } from '@/features/v2-calendar/components/upsell/PersonalCalendarPromo'
import { useCalendarMonth, useDayDetail, CalendarMenuState } from '@/features/v2-calendar'
import { useClientTier } from '@/features/v2-shell/hooks/useClientTier'
import { formatThaiLongDate } from '@/utils/formate-date-thai'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2CalendarPage() {
  const { month, year, monthIndex, todayISO, goPrev, goNext, goToday } = useCalendarMonth()
  const router = useRouter()
  // Zone 4 — the paid rule lives once in goo's lib/v2/tier.ts; this page only reads the verdict.
  // `null` = not determined yet, and it is wrong to guess in EITHER direction, so both the pill and the
  // promo stay away until the tier is actually known. See the note on the promo below.
  const { isPaid } = useClientTier()
  // selected/summary day = today if it's in view (fenced: null until mount), else the month's reference day.
  const cardDay = month.days.find((d) => d.date === todayISO) ?? month.days[13] ?? month.days[0]
  // the same payload the day-detail screen binds to — headline + the two facet lists live there, so the
  // card shows real copy instead of the hardcoded sentence the little local card carried.
  const { detail } = useDayDetail(cardDay.date)

  // Jump to an arbitrary month by STEPPING goo's cursor, so his hook keeps the exact signature it shipped
  // with (goPrev/goNext/goToday) — the seam stays his. React batches the functional updates, so N calls
  // land as a single render.
  const goTo = (y: number, m: number) => {
    const delta = (y - year) * 12 + (m - monthIndex)
    const step = delta > 0 ? goNext : goPrev
    for (let i = 0; i < Math.abs(delta); i++) step()
  }

  return (
    <CalendarShell title="ปฏิทินดวง" menuState={CalendarMenuState.Normal}>
      <AppHeader title="ปฏิทินดวง" subtitle="ฤกษ์ดี วันมงคล ดิถีจีนรายวัน" showUpgrade={isPaid === false} className="items-start px-4 pb-2 pt-4" />

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

      <div className={`flex flex-col gap-4 px-4 pt-2 ${isPaid === null ? 'hidden' : ''}`}>
        {/* Figma Free-1 368:9750 places this between the header and the selector; Paid-1 375:16710 has no
            such card. KNOWN-free only — see the layout note above for why the undetermined tier withholds
            the whole column rather than this one card. */}
        {isPaid === false && <PersonalCalendarPromo />}

        <DateSelector year={year} monthIndex={monthIndex} onToday={goToday} onPick={goTo} />

        <MonthGrid weeks={month.weeks} todayISO={todayISO} />

        {/* Figma 375:11100 — the card and its CTA are ONE card; the CTA was a separate button below it. */}
        <DailyFortuneCard
          variant="calendar"
          testId="calendar-daily-card"
          ring={{ grade: detail.grade, percent: detail.percent }}
          headline={detail.summary}
          dateLine={`${cardDay.date === todayISO ? 'วันนี้ · ' : ''}${formatThaiLongDate(cardDay.date) || `วันที่ ${cardDay.day}`}`}
          ganzhi={detail.ganzhi}
          wanPhra={cardDay.isBuddhistDay}
          suitable={detail.suitable.slice(0, 2)}
          avoid={detail.avoid.slice(0, 2)}
          footer={
            <button
              type="button"
              onClick={() => router.push(`/v2/calendar/${cardDay.date}`)}
              className="w-full rounded-full bg-v3-sapphire py-[14px] text-[16px] font-bold uppercase leading-6 text-v3-lime"
            >
              ดูรายละเอียดวันนี้
            </button>
          }
        />
      </div>
    </CalendarShell>
  )
}
