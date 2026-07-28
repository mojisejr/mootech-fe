// MuMate v2 — ปฏิทินดวง month view (Figma 375:16710). Behind the v2 gate (middleware + this SSR re-check).
// Phase 2 (Lamun · designed UI): the grade grid + legend + score card replace goo's Phase-0 scaffold; goo's
// hooks/routing (useCalendarMonth · dayCellTier · /v2/calendar/[date]) are unchanged. NO network (mock hooks).
// Phase 3a nav-seam: renders inside CalendarShell (shared CalendarMenu, state default) instead of AppShell,
// so the bottom bar matches /v2/calendar/[date]'s — consistent across the calendar flow (AppShell/Menubar
// untouched → /v2/service, /v2/shop unaffected).
import type { GetServerSideProps } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { CalendarShell } from '@/features/v2-calendar/components/CalendarShell'
import { useCalendarMonth, dayCellTier, CalendarMenuState, type CalendarDay } from '@/features/v2-calendar'
import { DAY_CELL_COLORS, SELECTED, CALENDAR_MARKER, GRADE_COLORS } from '@/features/v2-calendar/components/grade-colors'

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const THAI_DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

// One day tile — tier-tinted (DESIGN.md), grade + day + %, or sapphire-filled when selected. วันพระ = #9D85DA ring.
function DayCell({ cell, selected }: { cell: CalendarDay; selected: boolean }) {
  const tier = DAY_CELL_COLORS[dayCellTier(cell.percent)]
  const style = selected
    ? { backgroundColor: SELECTED.fill, color: SELECTED.text, boxShadow: undefined as string | undefined }
    : { backgroundColor: tier.tint, color: tier.text, boxShadow: cell.isBuddhistDay ? `inset 0 0 0 1.5px ${CALENDAR_MARKER}` : undefined }
  return (
    <Link
      href={`/v2/calendar/${cell.date}`}
      aria-label={`วันที่ ${cell.day} เกรด ${cell.grade} ${cell.percent}%`}
      className="flex aspect-square flex-col items-center justify-center rounded-[10px] leading-none"
      style={style}
    >
      <span className="flex w-full items-baseline justify-between px-1.5 pt-1 text-[13px] font-bold">
        <span>{cell.day}</span>
        <span className="text-[10px] font-semibold">{cell.grade}</span>
      </span>
      <span className="pb-1 text-[11px] font-medium">{cell.percent}%</span>
    </Link>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[11px] text-v3-text-body">
      <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

// The score-ring summary card for the selected day (Figma: donut ring + grade + headline + date).
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

  return (
    <CalendarShell title="ปฏิทินดวง" menuState={CalendarMenuState.Normal}>
      <div className="flex flex-col gap-4 px-4 pt-6">
        {/* month selector row (Figma: วันนี้ · เดือน · ปี พ.ศ.) — driven by goo's cursor */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={goToday} className="rounded-full bg-v3-sapphire px-4 py-1.5 text-sm font-semibold text-white">วันนี้</button>
          <button type="button" onClick={goPrev} aria-label="เดือนก่อน" className="grid size-8 place-items-center rounded-full bg-white text-v3-sapphire shadow-sm">‹</button>
          <span className="flex-1 text-center text-sm font-semibold text-v3-navy">{THAI_MONTHS[monthIndex - 1]} · {year + 543}</span>
          <button type="button" onClick={goNext} aria-label="เดือนถัดไป" className="grid size-8 place-items-center rounded-full bg-white text-v3-sapphire shadow-sm">›</button>
        </div>

        {/* grade grid */}
        <div className="rounded-2xl bg-white p-3 shadow-[0_4px_14px_rgba(26,38,77,0.06)]">
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-v3-text-body/70">
            {THAI_DOW.map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div data-testid="calendar-grid" className="grid grid-cols-7 gap-1">
            {month.weeks.flat().map((cell, i) =>
              cell.isPadding
                ? <span key={i} aria-hidden />
                : <DayCell key={cell.date} cell={cell} selected={cell.date === (todayISO ?? '')} />,
            )}
          </div>
          {/* legend (Figma: ≥60 · 40-59 · <40 · วันนี้) */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <LegendDot color={DAY_CELL_COLORS.good.text} label="≥60% ดี" />
            <LegendDot color={DAY_CELL_COLORS.medium.text} label="40–59%" />
            <LegendDot color={DAY_CELL_COLORS.bad.text} label="<40% น้อย" />
            <LegendDot color={SELECTED.fill} label="วันนี้" />
          </div>
        </div>

        {/* selected-day score card */}
        <ScoreCard day={cardDay} />

        {/* CTA → day detail (Phase 3) */}
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
