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
import { useCalendarMonth, CalendarMenuState, type CalendarDay } from '@/features/v2-calendar'
import { GRADE_COLORS } from '@/features/v2-calendar/components/grade-colors'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

// The score-ring summary for the selected day. STILL the small local card, deliberately: Figma's real one
// (375:11100 `daily-session-card`) is a superset of home's <ScoreRingCard/> — same 90px ring, plus a 干支
// chip, a วันพระ row, two lines per column and a CTA. Extracting that one card so home and the calendar
// share it MOVES HOME'S PIXELS, so it rides with the tier work in the next PR instead of hiding inside a
// grid refactor. Written down so this reads as a deferral, not an oversight.
function ScoreCard({ day }: { day: CalendarDay }) {
  const c = GRADE_COLORS[day.grade]
  const R = 26, C = 2 * Math.PI * R
  const dashPct = Math.max(0, Math.min(100, day.percent))
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[0_4px_14px_rgba(26,38,77,0.06)]">
      <div className="relative grid size-16 shrink-0 place-items-center">
        <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
          <circle cx="32" cy="32" r={R} fill="none" stroke="#E9EEF5" strokeWidth="7" />
          <circle cx="32" cy="32" r={R} fill="none" stroke={c.accent} strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - dashPct / 100)} />
        </svg>
        <span className="absolute flex flex-col items-center leading-none">
          <span className="text-base font-bold" style={{ color: c.accent === '#CDDC39' ? '#374151' : c.accent }}>{day.grade}</span>
          <span className="text-[10px] font-semibold text-v3-text-body">{day.percent}%</span>
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-5 text-v3-navy">วันดวงดีมาก แค่เริ่มก็สำเร็จแล้ว</p>
        <p className="mt-1 text-xs font-medium text-v3-text-body">วันที่ {day.day} {day.ganzhi} · {day.percent}%</p>
      </div>
    </div>
  )
}

export default function V2CalendarPage() {
  const { month, year, monthIndex, todayISO, goPrev, goNext, goToday } = useCalendarMonth()
  const router = useRouter()
  // selected/summary day = today if it's in view (fenced: null until mount), else the month's reference day.
  const cardDay = month.days.find((d) => d.date === todayISO) ?? month.days[13] ?? month.days[0]

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

        <ScoreCard day={cardDay} />

        <button
          type="button"
          onClick={() => router.push(`/v2/calendar/${cardDay.date}`)}
          className="w-full rounded-full bg-v3-sapphire py-3 text-sm font-bold text-white"
        >
          ดูรายละเอียดวันนี้
        </button>
      </div>
    </CalendarShell>
  )
}
