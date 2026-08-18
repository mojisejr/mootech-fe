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
import { NotifyStatusBar } from '@/features/v2-calendar/components/NotifyStatusBar'
import { notifyStateFrom } from '@/features/v2-calendar/notify-state'
import { usePwaCapability, CAPABILITY_CHANGED } from '@/lib/pwa/capability'
import { requestPushSubscription } from '@/lib/pwa/subscribe'

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

export default function V2CalendarNotificationsPage() {
  const { list, cancel } = useReminders()
  const notify = notifyStateFrom(usePwaCapability())
  const [guide, setGuide] = useState<InstallGuideVariant | null>(null)
  const isEmpty = list.upcoming.length === 0 && list.past.length === 0

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
        <NotifyStatusBar state={notify} onShowGuide={setGuide} onEnable={onEnable} />

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
