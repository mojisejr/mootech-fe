// MuMate v2 — ปฏิทิน · การแจ้งเตือนทั้งหมด (screen 6, §list แบบ ข). Behind the v2 gate.
//
// Phase 6 (Lamun · DESIGNED UI — this screen has NO Figma, so it is designed within DESIGN.md by BORROWING
// existing primitives, not inventing: CalendarShell + CalendarMenu, SectionCard (group cards), the day-detail
// row style (#F9F4F0), the DayHeader top-bar pattern, and v3 tokens only — no new colour, no bespoke component.
// goo's useReminders (list = upcoming/past/totalYams/totalDays + cancel) is UNCHANGED — the page only reads it;
// it adds NO useState of its own. Cancel is goo's client mutation. 0 network. ฟีม: empty state = แบบ ก (เรียบ).
import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import Link from 'next/link'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { AppHeader } from '@/features/v2-shell/components/AppHeader'
import { CalendarShell } from '@/features/v2-calendar/components/CalendarShell'
import { SectionCard } from '@/features/v2-calendar/components/day-detail/SectionCard'
import { useReminders, CalendarMenuState, type Reminder } from '@/features/v2-calendar'
import { InstallGuideSheet, type InstallGuideVariant } from '@/features/v2-calendar/components/InstallGuideSheet'
import { notifyStateFrom, guideVariantFor, NOTIFY_REASON, type NotifyState } from '@/features/v2-calendar/notify-state'
import { usePwaCapability } from '@/lib/pwa/capability'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

const THAI_MON_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
// #298: the per-row destination chip is gone — every reminder is ['mumate'] now, so the chip told nothing.

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

// #286 · แถบสถานะถาวร — ตอบคำถาม "แจ้งเตือนเปิดอยู่ไหม" โดยที่ผู้ใช้ไม่ต้องกดอะไรเลย
//
// 🔴 เหตุที่มันต้องอยู่บนหน้า *รายการ* ไม่ใช่แค่ในชีทตอนตั้ง: สิทธิ์แจ้งเตือนถูกปิดที่ตัวเครื่องได้
// ทีหลัง โดยที่รายการที่ตั้งไว้แล้วยังอยู่ครบ ⇒ จอที่โชว์ "ตั้งไว้ 5 อัน" เฉยๆ กำลังบอกความจริง
// ที่ไม่เป็นความจริงอีกต่อไป. แถบนี้คือที่ที่ความจริงข้อนั้นอยู่.
//
// "ยังไม่รู้" เป็นโครงว่าง ❌ ไม่ใช่แถบเทาที่เขียนว่าปิด — ปิดคือคำตอบ ยังไม่รู้ไม่ใช่คำตอบ
function NotifyStatusBar({ state, onShowGuide }: { state: NotifyState; onShowGuide: (v: InstallGuideVariant) => void }) {
  if (state === 'unknown') {
    return <div data-testid="notify-status-skeleton" aria-hidden className="h-[52px] animate-pulse rounded-2xl bg-black/[0.06]" />
  }

  const ok = state === 'granted'
  const reason = NOTIFY_REASON[state]
  const guide = guideVariantFor(state)

  return (
    <div
      data-testid="notify-status"
      data-notify-state={state}
      role="status"
      className={`flex items-start gap-3 rounded-2xl px-4 py-3 ${ok ? 'bg-v3-pastel-mint/50' : 'bg-v3-grade-yellow/40'}`}
    >
      <span aria-hidden className="text-base leading-6">{ok ? '🔔' : '🔕'}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-6 text-v3-navy">
          {ok ? 'การแจ้งเตือนเปิดอยู่' : state === 'default' ? 'ยังไม่ได้เปิดการแจ้งเตือน' : 'การแจ้งเตือนปิดอยู่'}
        </p>
        <p className="text-xs font-medium leading-5 text-v3-text-body">
          {ok
            ? 'ถึงเวลายามที่ตั้งไว้ เครื่องนี้จะเตือนคุณ'
            : /* ทุกสถานะที่ไม่ใช่ granted ต้องพูดผลลัพธ์ให้ชัดก่อน แล้วค่อยบอกวิธี —
                 ผู้ใช้ต้องรู้ว่า "รายการข้างล่างจะไม่ดัง" ไม่ใช่แค่ว่ามีบางอย่างตั้งค่าไม่ครบ */
              (reason ?? 'รายการข้างล่างจะยังไม่ดังจนกว่าจะเปิดการแจ้งเตือน')}
        </p>
      </div>
      {guide && (
        <button type="button" data-testid="notify-status-guide" onClick={() => onShowGuide(guide)} className="shrink-0 self-center rounded-full border border-v3-sapphire/30 px-3 py-1 text-xs font-bold text-v3-sapphire">
          ดูวิธี
        </button>
      )}
    </div>
  )
}

export default function V2CalendarNotificationsPage() {
  const { list, cancel } = useReminders()
  const notify = notifyStateFrom(usePwaCapability())
  const [guide, setGuide] = useState<InstallGuideVariant | null>(null)
  const isEmpty = list.upcoming.length === 0 && list.past.length === 0

  return (
    <CalendarShell title="การแจ้งเตือน" menuState={CalendarMenuState.Saved}>
      {/* top bar — the shared <AppHeader/> (ฟีม 2026-08-03: one header convention). The gradient strip is
          this flow's chrome and is unchanged.
          The multi-stop hex gradient is kept as-is; #C9E4F4 IS the v3-pastel-blue token value — do not
          "fix" it to a token. */}
      <div style={{ background: 'linear-gradient(105deg, #FFFFFF 40%, #C9E4F4 100%)' }} className="rounded-b-[20px]">
        <AppHeader testId="notifications-header" title="การแจ้งเตือนทั้งหมด" backHref="/v2/calendar" className="items-center px-4 pb-3 pt-2" />
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4">
        {/* แถบสถานะมาก่อนสรุปยอด — ถ้าแจ้งเตือนปิดอยู่ ยอด "5 ยาม" ข้างล่างคือตัวเลขที่จะไม่เกิดขึ้น
            ⇒ ผู้ใช้ต้องอ่านเงื่อนไขก่อนอ่านตัวเลข · แสดงทุกสถานะรวมทั้งตอนไม่มีรายการ */}
        <NotifyStatusBar state={notify} onShowGuide={setGuide} />

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
      {guide && <InstallGuideSheet variant={guide} onClose={() => setGuide(null)} />}
    </CalendarShell>
  )
}
