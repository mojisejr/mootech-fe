// MuMate v2 — ปฏิทิน · การแจ้งเตือนทั้งหมด (screen 6). Behind the v2 gate.
//
// 2026-09-07 Figma parity (frames 636:10221 / 421:901 — "การแจ้งเตือนทั้งหมด"): this screen now HAS a Figma.
// Layout = teal (#1B9AAF) ground + white 24/32 title + close chip (#1190A5 · 40 r44) → cream sheet
// (#F9F4F0 r-t28 pt32 pb120 gap18) holding: navy status card (0B305B · shadow 0/8/20) → a push-notification
// preview ("M" chip · "⏰ ยามมงคลเริ่มแล้ว · HH:MM-HH:MM") → one calendar-event card per reminder
// ("🔮 ยามมงคล — <label>" · "<อ. 14 ก.ค. 2569> · <window>" · hairline · "เปิดใน Mumate ›" · destination chip).
// Every string on screen is read from goo's useReminders (list = upcoming/past/totalYams/totalDays + cancel)
// — the page adds NO useState of its own beyond the guide sheet. Cancel is goo's client mutation. 0 network.
// ❌ Not invented: the Figma body copy "วันนี้ 己丑 ดิถีสะสม ทิศโชคลาภ W" / "รายละเอียด: วัน 己丑 · …" is day-detail
// data the Reminder row does not carry, so those lines are NOT rendered (the sheet says only what it holds).
// The "เพิ่มลง Google ปฏิทิน เรียบร้อย" line + "📅 Google ปฏิทิน · จาก Mumate" chip appear only when a reminder
// really has 'google' in destinations (#298: today every row is ['mumate'] → the in-app copy shows instead).
import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import Link from 'next/link'
import { Boxes, X } from 'lucide-react'
import { v2RedirectIfUnauthed, isV2TeamPreview } from '@/lib/v2/gate'
import { AppHeader } from '@/features/v2-shell/components/AppHeader'
import { useClientTier } from '@/features/v2-shell/hooks/useClientTier'
import { CalendarShell } from '@/features/v2-calendar/components/CalendarShell'
import { useReminders, CalendarMenuState, type Reminder } from '@/features/v2-calendar'
import { InstallGuideSheet, type InstallGuideVariant } from '@/features/v2-calendar/components/InstallGuideSheet'
import { NotifyStatusBar } from '@/features/v2-calendar/components/NotifyStatusBar'
import { notifyStateFrom } from '@/features/v2-calendar/notify-state'
import { usePwaCapability, CAPABILITY_CHANGED } from '@/lib/pwa/capability'
import { requestPushSubscription } from '@/lib/pwa/subscribe'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: { teamPreview: isV2TeamPreview(ctx.req) } }
}

const THAI_MON_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const THAI_DOW_ABBR = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

/** "อ. 14 ก.ค. 2569" — the Figma event-card date line (weekday abbr + day + month abbr + พ.ศ.). */
export function thaiEventDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const dow = THAI_DOW_ABBR[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${dow} ${d} ${THAI_MON_ABBR[m - 1]} ${y + 543}`
}

/** "09:00-10:59" → "09:00 – 10:59" (Figma event line uses a spaced en-dash; the push line keeps the raw window). */
function spacedWindow(w: string): string {
  return w.replace(/\s*-\s*/, ' – ')
}

const hasGoogle = (r: Reminder) => r.destinations.includes('google')

// ตั้งเวลาเอง (free-time) rows are stored as a synthetic ยาม id `c<HHMM>` (reminder-plan.ts).
const isCustom = (r: Reminder) => /^c\d{3,4}$/.test(r.yamId)
// custom window is "HH:MM-HH:MM" with start==end ⇒ show the single time; ยาม windows keep the range.
function displayWindow(r: Reminder): string {
  const [a, b] = r.window.split('-')
  if (a && b && a.trim() === b.trim()) return a.trim()
  return spacedWindow(r.window)
}

// Figma 636:10241 — the push-notification preview: white/92 · border #E5E3E0 · r20 · shadow 0/6/18 rgba(26,38,77,.1)
function PushPreview({ r }: { r: Reminder }) {
  return (
    <div data-testid="notif-push-preview" className="flex flex-col gap-1.5 rounded-[20px] border border-v3-border-warm-2 bg-white/[0.92] px-3.5 py-3 shadow-[0px_6px_18px_0px_rgba(26,38,77,0.1)]">
      <div className="flex items-center gap-2">
        <span aria-hidden className="grid size-[22px] shrink-0 place-items-center rounded-[8px] bg-v3-sapphire text-[11px] font-bold text-white">M</span>
        <span className="min-w-0 flex-1 text-[16px] font-bold leading-6 text-v3-text-price">Mumate</span>
        <span className="shrink-0 text-[10px] text-v3-text-muted">ตอนนี้</span>
      </div>
      <p className="text-[16px] font-bold leading-6 text-v3-text-price">⏰ ยามมงคลเริ่มแล้ว · {r.window}</p>
      <p className="text-[14px] leading-[22px] text-v3-text-body">{r.yamLabel}</p>
    </div>
  )
}

// Figma 636:10250 — one calendar-event card per reminder: white · border #E5E3E0 · r20 · px16 py14 · gap10.
// "เตือนไปแล้ว" (past) is faded + has no cancel.
function ReminderRow({ r, onCancel }: { r: Reminder; onCancel?: (id: string) => void }) {
  const google = hasGoogle(r)
  return (
    <li data-testid="notif-row" className={`flex flex-col gap-2.5 rounded-[20px] border border-v3-border-warm-2 bg-white px-4 py-3.5 ${onCancel ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="h-[38px] w-1 shrink-0 rounded-full bg-v3-sapphire" />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold leading-6 text-v3-text-price">{isCustom(r) ? '⏰ ตั้งเวลาเอง' : `🔮 ยามมงคล — ${r.yamLabel}`}</p>
          <p className="mt-0.5 text-[14px] leading-[22px] text-v3-text-body">{thaiEventDate(r.date)} · {displayWindow(r)}</p>
          {r.note ? <p data-testid="notif-note" className="mt-0.5 text-[14px] leading-[22px] text-v3-navy">“{r.note}”</p> : null}
        </div>
        {onCancel && (
          <button
            type="button"
            data-testid="notif-cancel"
            onClick={() => onCancel(r.id)}
            className="shrink-0 self-start rounded-full border border-v3-navy/20 px-3 py-1 text-[12px] font-semibold text-v3-text-body"
          >
            ยกเลิก
          </button>
        )}
      </div>
      <div className="h-px w-full bg-v3-border-warm-2" />
      <Link href={`/v2/calendar/${r.date}`} className="text-[14px] leading-[22px] text-v3-text-body">
        เปิดใน Mumate ›
      </Link>
      <span className="self-start rounded-full bg-[#EAF0FA] px-[9px] py-[5px] text-[14px] font-medium leading-5 text-v3-sapphire">
        {google ? '📅 Google ปฏิทิน · จาก Mumate' : '🔔 แจ้งเตือนในแอป Mumate'}
      </span>
    </li>
  )
}

// สถานะว่าง แบบ ก — text + a button to the calendar (ฟีม: no mascot, no new illustration). Looks intentional.
function EmptyState() {
  return (
    <div data-testid="notif-empty" className="flex flex-col items-center gap-4 rounded-[20px] border border-v3-border-warm-2 bg-white px-6 py-14 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-v3-pastel-blue/40 text-3xl" aria-hidden>🔔</span>
      <div>
        <p className="text-[16px] font-bold leading-6 text-v3-text-price">ยังไม่มีการแจ้งเตือน</p>
        <p className="mt-1 text-[14px] leading-[22px] text-v3-text-body">ตั้งเวลามงคลจากหน้าปฏิทิน เพื่อรับการแจ้งเตือนในวันสำคัญของคุณ</p>
      </div>
      <Link href="/v2/calendar" className="rounded-full bg-v3-sapphire px-6 py-2.5 text-[14px] font-bold text-white">
        ไปที่ปฏิทิน
      </Link>
    </div>
  )
}

export default function V2CalendarNotificationsPage({ teamPreview }: { teamPreview: boolean }) {
  const tier = useClientTier(teamPreview)
  const { list, cancel } = useReminders()
  const notify = notifyStateFrom(usePwaCapability())
  const [guide, setGuide] = useState<InstallGuideVariant | null>(null)
  const isEmpty = list.upcoming.length === 0 && list.past.length === 0
  // the push preview mocks the NEXT reminder that will ring — never a made-up one
  const next = list.upcoming[0]
  const anyGoogle = [...list.upcoming, ...list.past].some(hasGoogle)

  // #307 · ปุ่ม "เปิดการแจ้งเตือน" บนแถบสถานะ — requestPushSubscription() เป็น **คำสั่งแรก** ใน handler
  // ❌ ไม่ await อะไรก่อนหน้ามัน: `lib/pwa/subscribe.ts:7-8` — เบราว์เซอร์รับ requestPermission() เฉพาะ
  // ที่วิ่งตรงจาก user gesture, ถ้าเราไป await อย่างอื่นก่อน gesture จะหมดอายุแล้วมันจะเมินเงียบ
  //
  // 🔴 แล้วทำไมต้อง dispatch event ต่อท้าย: `usePwaCapability` อ่านค่าใหม่ตอน `visibilitychange` เท่านั้น
  // ซึ่ง **ไม่เกิด** เมื่อผู้ใช้กดอนุญาตในกล่องของเบราว์เซอร์บนเดสก์ท็อป ⇒ ถ้าไม่บอกให้มันอ่านใหม่
  // แถบจะค้างที่ "ยังไม่ได้เปิด" ทั้งที่สิทธิ์เป็น granted แล้ว = จอโกหกในทิศทางตรงข้ามกับบั๊กเดิมพอดี
  // สิ่งที่ event นี้ทำคือสั่งให้ hook ไป**อ่านค่าจริงจากรันไทม์ใหม่** ❌ ไม่ใช่ป้อนค่าที่เราเดาเข้าไปเอง
  // 🔴 สองจังหวะ ไม่ใช่จังหวะเดียว — และเหตุผลคือของจริงที่จับได้ตอนเขียนฟันของใบนี้:
  // `requestPushSubscription()` ขอสิทธิ์ **แล้วรอ `navigator.serviceWorker.ready` ต่อ** (subscribe.ts:44)
  // ซึ่งบนหน้าที่ยังไม่มี service worker ลงทะเบียน มันรอตลอดกาลโดยไม่ throw ⇒ ถ้าอ่านค่าใหม่ตอนมันเสร็จ
  // อย่างเดียว ผู้ใช้ที่กด "อนุญาต" แล้วจะเห็นแถบค้างที่ "ยังไม่ได้เปิด" ต่อไปเรื่อยๆ
  // ⇒ อ่านค่าใหม่ **ทันทีที่ผู้ใช้ตัดสินใจ** (จังหวะที่ 1) แล้วอ่านอีกทีตอน subscription จบ (จังหวะที่ 2)
  const onEnable = () => {
    // gesture-critical: บรรทัดนี้ต้องเป็นคำสั่งแรก ❌ ห้าม await อะไรก่อน (subscribe.ts:7-8)
    void Notification.requestPermission()
      .then(() => {
        // จังหวะที่ 1 — ยิงทั้ง granted และ denied: 'denied' ก็เป็นความจริงใหม่ที่แถบต้องสะท้อน
        document.dispatchEvent(new Event(CAPABILITY_CHANGED))
        // ค่อยไปสร้าง subscription จริง (ใช้ตัวเดิมของ goo · idempotent · reuse ของเดิมถ้ามี)
        // ⚠️ ยังไม่ได้ส่งขึ้น server — `postPushSubscription` เกิดที่ #303 ซึ่งยังไม่ merge (เขียนไว้ในใบ)
        return requestPushSubscription()
      })
      .then(() => document.dispatchEvent(new Event(CAPABILITY_CHANGED))) // จังหวะที่ 2
      .catch(() => document.dispatchEvent(new Event(CAPABILITY_CHANGED))) // ล้มก็ต้องอ่านค่าใหม่ ไม่ค้างคำโกหก
  }

  return (
    <CalendarShell title="การแจ้งเตือน" menuState={CalendarMenuState.Saved}>
      {/* Figma 636:10222 — teal ground behind the header; the cream sheet below rounds over it (r-t28). */}
      <div className="bg-v3-cyan">
        {/* #384 — this screen was the sixth <AppHeader/> and the only one that passed NO tier at all, so it
            showed no badge to anyone. Members now see their level here (a level that disappears when you tap
            the bell is the same "where did my status go" this ticket exists to fix), while free users keep
            exactly what they have today: nothing. upgradeCta={false} is บอง's ruling 2026-08-22 — adding the
            LEVEL is in scope, opening a new sales surface ฟีม has never seen is not.
            Figma 636:10230 — the title is white 24/32 bold on teal, and the frame carries a close chip
            (636:10231 · #1190A5 · 40 r44 · 20px X) instead of a back arrow; `left` renders both. */}
        <AppHeader
          testId="notifications-header"
          membership={tier}
          upgradeCta={false}
          bell={false}
          className="items-center px-4 pb-6 pt-4"
          left={
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <h1 data-testid="header-title" className="min-w-0 flex-1 break-words text-[24px] font-bold leading-8 text-white">การแจ้งเตือนทั้งหมด</h1>
              <Link
                href="/v2/calendar"
                aria-label="ปิด"
                data-testid="notif-close"
                className="grid size-10 shrink-0 place-items-center rounded-[44px] bg-[#1190A5] text-white"
              >
                <X size={20} strokeWidth={2} aria-hidden />
              </Link>
            </div>
          }
        />
      </div>

      {/* Figma 636:10233 "sheet" — #F9F4F0 · r-t28 · px16 pt32 pb120 · gap18 */}
      <div className="-mt-px flex flex-col gap-[18px] rounded-t-[28px] bg-v3-lemon-chiffon px-4 pb-[120px] pt-8">
        {/* แถบสถานะมาก่อนสรุปยอด — ถ้าแจ้งเตือนปิดอยู่ ยอด "5 ยาม" ข้างล่างคือตัวเลขที่จะไม่เกิดขึ้น
            ⇒ ผู้ใช้ต้องอ่านเงื่อนไขก่อนอ่านตัวเลข · แสดงทุกสถานะรวมทั้งตอนไม่มีรายการ */}
        <NotifyStatusBar state={notify} onShowGuide={setGuide} onEnable={onEnable} />

        {/* Figma 636:10235 — status card: navy · r16 · px14 py13 · gap10 · shadow 0/8/20 rgba(0,0,0,.25)
            hidden in the empty state (no "0 ยาม" above "ยังไม่มีการแจ้งเตือน") */}
        {!isEmpty && (
          <div className="flex items-center gap-2.5 rounded-[16px] bg-v3-navy px-3.5 py-[13px] shadow-[0px_8px_20px_0px_rgba(0,0,0,0.25)]">
            <Boxes size={24} strokeWidth={1.75} aria-hidden className="shrink-0 text-white" />
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold leading-6 text-white">
                ตั้งแจ้งเตือนแล้ว · <span data-testid="notif-total-yams">{list.totalYams}</span> ยาม
              </p>
              <p className="text-[14px] leading-[22px] text-v3-ghost-white">
                {anyGoogle ? 'เพิ่มลง Google ปฏิทิน เรียบร้อย' : <>แจ้งเตือนในแอป Mumate · <span data-testid="notif-total-days">{list.totalDays}</span> วัน</>}
              </p>
            </div>
          </div>
        )}

        {/* Figma 636:10241 — how the next push will look on the device */}
        {next && <PushPreview r={next} />}

        {isEmpty ? (
          <EmptyState />
        ) : (
          <>
            <section className="flex flex-col gap-2.5">
              <h2 className="text-[18px] font-bold leading-6 text-v3-navy">กำลังจะถึง</h2>
              {list.upcoming.length ? (
                <ul className="flex flex-col gap-2.5">
                  {list.upcoming.map((r) => <ReminderRow key={r.id} r={r} onCancel={cancel} />)}
                </ul>
              ) : (
                <p className="text-[14px] leading-[22px] text-v3-text-body">ไม่มีการแจ้งเตือนที่กำลังจะถึง</p>
              )}
            </section>

            {list.past.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <h2 className="text-[18px] font-bold leading-6 text-v3-navy">เตือนไปแล้ว</h2>
                <ul className="flex flex-col gap-2.5">
                  {list.past.map((r) => <ReminderRow key={r.id} r={r} />)}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
      {guide && <InstallGuideSheet variant={guide} onClose={() => setGuide(null)} />}
    </CalendarShell>
  )
}
