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
import { useCalendarMonth, useDayDetail, CalendarMenuState } from '@/features/v2-calendar'
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
      <AppHeader title="ปฏิทินดวง" subtitle="ฤกษ์ดี วันมงคล ดิถีจีนรายวัน" className="items-start px-4 pb-2 pt-4" />

      <div className="flex flex-col gap-4 px-4 pt-2">
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
