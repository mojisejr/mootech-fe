// MuMate v2 — ปฏิทิน · การแจ้งเตือนทั้งหมด (screen 6, §list แบบ ข). Behind the v2 gate.
//
// Phase 6 (Lamun · DESIGNED UI — this screen has NO Figma, so it is designed within DESIGN.md by BORROWING
// existing primitives, not inventing: CalendarShell + CalendarMenu, SectionCard (group cards), the day-detail
// row style (#F9F4F0), the DayHeader top-bar pattern, and v3 tokens only — no new colour, no bespoke component.
// goo's useReminders (list = upcoming/past/totalYams/totalDays + cancel) is UNCHANGED — the page only reads it;
// it adds NO useState of its own. Cancel is goo's client mutation. 0 network. ฟีม: empty state = แบบ ก (เรียบ).
import type { GetServerSideProps } from 'next'
import Link from 'next/link'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { CalendarShell } from '@/features/v2-calendar/components/CalendarShell'
import { SectionCard } from '@/features/v2-calendar/components/day-detail/SectionCard'
import { useReminders, CalendarMenuState, type Reminder, type ReminderDestination } from '@/features/v2-calendar'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

const THAI_MON_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const DEST_LABEL: Record<ReminderDestination, string> = { mumate: 'มู่เมท', google: 'Google', apple: 'Apple' }

function thaiShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return y && m && d ? `${d} ${THAI_MON_ABBR[m - 1]} ${y + 543}` : iso
}

// One reminder row — the day-detail row style (#F9F4F0). "เตือนไปแล้ว" (past) is faded + has no cancel.
function ReminderRow({ r, onCancel }: { r: Reminder; onCancel?: (id: string) => void }) {
  return (
    <li data-testid="notif-row" className={`flex items-center gap-3 rounded-2xl bg-v3-lemon-chiffon px-3.5 py-3 ${onCancel ? '' : 'opacity-60'}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-v3-pastel-blue/30 text-base" aria-hidden>🔔</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-v3-navy">{r.yamLabel}</p>
        <p className="mt-0.5 text-xs font-medium text-v3-text-body">{thaiShort(r.date)} · {r.window}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {r.destinations.map((d) => (
            <span key={d} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-v3-sapphire">{DEST_LABEL[d]}</span>
          ))}
        </div>
      </div>
      {onCancel && (
        <button
          type="button"
          data-testid="notif-cancel"
          onClick={() => onCancel(r.id)}
          className="shrink-0 self-start rounded-full border border-v3-navy/20 px-3 py-1 text-xs font-semibold text-v3-text-body"
        >
          ยกเลิก
        </button>
      )}
    </li>
  )
}

// สถานะว่าง แบบ ก — text + a button to the calendar (ฟีม: no mascot, no new illustration). Looks intentional.
function EmptyState() {
  return (
    <div data-testid="notif-empty" className="flex flex-col items-center gap-4 rounded-[20px] bg-white px-6 py-14 text-center shadow-[0_4px_14px_rgba(26,38,77,0.06)]">
      <span className="grid size-16 place-items-center rounded-full bg-v3-pastel-blue/40 text-3xl" aria-hidden>🔔</span>
      <div>
        <p className="text-base font-bold text-v3-navy">ยังไม่มีการแจ้งเตือน</p>
        <p className="mt-1 text-sm text-v3-text-body">ตั้งเวลามงคลจากหน้าปฏิทิน เพื่อรับการแจ้งเตือนในวันสำคัญของคุณ</p>
      </div>
      <Link href="/v2/calendar" className="rounded-full bg-v3-sapphire px-6 py-2.5 text-sm font-bold text-white">
        ไปที่ปฏิทิน
      </Link>
    </div>
  )
}

export default function V2CalendarNotificationsPage() {
  const { list, cancel } = useReminders()
  const isEmpty = list.upcoming.length === 0 && list.past.length === 0

  return (
    <CalendarShell title="การแจ้งเตือน" menuState={CalendarMenuState.Saved}>
      {/* top bar (DayHeader pattern).
          ANCHOR: inline-gradient — bug-ledger#inline-hex-gradient-tech-debt (ตู๋ · D2): this multi-stop
          linear-gradient uses inline hex (#FFFFFF, #C9E4F4) instead of DESIGN.md tokens (Tailwind can't express
          the multi-stop cleanly). Visually on-brand + verified, but logged as intentional debt to refactor into
          a token/utility later. #C9E4F4 IS the v3-pastel-blue token value; #FFFFFF is white. */}
      <header className="flex items-center gap-3 rounded-b-[20px] px-4 pb-3 pt-2" style={{ background: 'linear-gradient(105deg, #FFFFFF 40%, #C9E4F4 100%)' }}>
        <Link href="/v2/calendar" aria-label="ย้อนกลับ" className="grid size-9 place-items-center rounded-full text-v3-navy">
          <svg viewBox="0 0 20 20" className="size-6" fill="none" aria-hidden><path d="M12.5 5 7.5 10l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
        <h1 className="flex-1 text-xl font-extrabold text-v3-navy">การแจ้งเตือนทั้งหมด</h1>
      </header>

      <div className="flex flex-col gap-4 px-4 pt-4">
        {/* summary — hidden in the empty state (แบบ ก stays clean; no "0 ยาม" above "ยังไม่มีการแจ้งเตือน") */}
        {!isEmpty && (
          <div className="rounded-[20px] bg-v3-sapphire px-5 py-4 text-white shadow-[0_4px_14px_rgba(20,85,164,0.24)]">
            <p className="text-xs font-medium text-white/80">ตั้งแจ้งเตือนแล้ว</p>
            <p className="mt-0.5 text-lg font-extrabold">
              <span data-testid="notif-total-yams">{list.totalYams}</span> ยาม · <span data-testid="notif-total-days">{list.totalDays}</span> วัน
            </p>
          </div>
        )}

        {isEmpty ? (
          <EmptyState />
        ) : (
          <>
            <SectionCard title="กำลังจะถึง">
              {list.upcoming.length ? (
                <ul className="flex flex-col gap-2.5">
                  {list.upcoming.map((r) => <ReminderRow key={r.id} r={r} onCancel={cancel} />)}
                </ul>
              ) : (
                <p className="text-sm text-v3-text-body">ไม่มีการแจ้งเตือนที่กำลังจะถึง</p>
              )}
            </SectionCard>

            {list.past.length > 0 && (
              <SectionCard title="เตือนไปแล้ว">
                <ul className="flex flex-col gap-2.5">
                  {list.past.map((r) => <ReminderRow key={r.id} r={r} />)}
                </ul>
              </SectionCard>
            )}
          </>
        )}
      </div>
    </CalendarShell>
  )
}
