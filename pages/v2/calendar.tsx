// MuMate v2 — ปฏิทิน (calendar) month view. Behind the v2 gate (middleware + this SSR re-check).
//
// PHASE 0 (goo · routing + state, NO designed UI, NO network): this page mounts the calendar state
// layer (useCalendarMonth) and renders a THIN scaffold so the flow is navigable and its 0-app-fetch is
// verifiable. The real month UI (grade cells, legend, score card — Figma 375:16710) replaces the
// scaffold body in Lamun's Phase 2; the hooks/routing here do not change.
import type { GetServerSideProps } from 'next'
import Link from 'next/link'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { AppShell } from '@/features/v2-shell/components/AppShell'
import { useCalendarMonth, dayCellTier } from '@/features/v2-calendar'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2CalendarPage() {
  const { month, year, monthIndex, todayISO, goPrev, goNext, goToday } = useCalendarMonth()

  return (
    <AppShell title="ปฏิทิน">
      <section data-testid="calendar-month" className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs text-neutral-400">
          Phase 0 scaffold — โครงข้อมูล/state/เส้นทาง (goo). UI จริงมาใน Phase ถัดไป (Lamun).
        </p>
        <div className="flex items-center justify-between">
          <button type="button" onClick={goPrev} aria-label="เดือนก่อน" className="px-2">‹</button>
          <span className="font-semibold text-v3-sapphire">{monthIndex}/{year}</span>
          <button type="button" onClick={goNext} aria-label="เดือนถัดไป" className="px-2">›</button>
        </div>
        <button type="button" onClick={goToday} className="mt-1 text-xs text-v3-sapphire underline">
          วันนี้
        </button>

        <table className="mt-3 w-full table-fixed text-center text-xs">
          <tbody>
            {month.weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((cell, ci) =>
                  cell.isPadding ? (
                    <td key={ci} className="p-1 text-neutral-300" />
                  ) : (
                    <td key={ci} className="p-1" data-tier={dayCellTier(cell.percent)}>
                      <Link href={`/v2/calendar/${cell.date}`} className="block">
                        <span className={todayISO === cell.date ? 'font-bold underline' : ''}>{cell.day}</span>
                        <span className="block text-[9px] text-neutral-500">{cell.ganzhi}</span>
                        <span className="block text-[9px]">{cell.percent}%</span>
                      </Link>
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <Link href="/v2/calendar/notifications" className="mt-3 block text-sm text-v3-sapphire underline">
          การแจ้งเตือนทั้งหมด →
        </Link>
      </section>
    </AppShell>
  )
}
