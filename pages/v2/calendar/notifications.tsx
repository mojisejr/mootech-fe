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
import { useReminders, CalendarMenuState, type Reminder, type ReminderDestination } from '@/features/v2-calendar'
import { InstallGuideSheet, type InstallGuideVariant } from '@/features/v2-calendar/components/InstallGuideSheet'
import { notifyStateFrom, guideVariantFor, NOTIFY_REASON, type NotifyState } from '@/features/v2-calendar/notify-state'
import { usePwaCapability, CAPABILITY_CHANGED } from '@/lib/pwa/capability'
import { requestPushSubscription } from '@/lib/pwa/subscribe'

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

// #286 · แถบสถานะถาวร — ตอบคำถาม "แจ้งเตือนเปิดอยู่ไหม" โดยที่ผู้ใช้ไม่ต้องกดอะไรเลย
//
// 🔴 เหตุที่มันต้องอยู่บนหน้า *รายการ* ไม่ใช่แค่ในชีทตอนตั้ง: สิทธิ์แจ้งเตือนถูกปิดที่ตัวเครื่องได้
// ทีหลัง โดยที่รายการที่ตั้งไว้แล้วยังอยู่ครบ ⇒ จอที่โชว์ "ตั้งไว้ 5 อัน" เฉยๆ กำลังบอกความจริง
// ที่ไม่เป็นความจริงอีกต่อไป. แถบนี้คือที่ที่ความจริงข้อนั้นอยู่.
//
// "ยังไม่รู้" เป็นโครงว่าง ❌ ไม่ใช่แถบเทาที่เขียนว่าปิด — ปิดคือคำตอบ ยังไม่รู้ไม่ใช่คำตอบ
//
// #307 · สองการปรับ และเหตุผลที่มันไม่ใช่เรื่องเดียวกัน:
//
// ① `default` เคยไม่มีทางออกอยู่บนจอ (บั๊ก ไม่ใช่เรื่องสวย) — ข้อความบอกว่า "ยังไม่ได้เปิด" และ
//    "รายการข้างล่างจะยังไม่ดัง" แต่ปุ่มเดียวที่มีคือ `ดูวิธี` ซึ่งผูกกับ `guideVariantFor(state)` และ
//    มันคืน `null` สำหรับ `default` (notify-state.ts) ⇒ ผู้ใช้อ่านปัญหาแล้วไม่มีอะไรให้กด.
//    `default` เป็นสถานะเดียวที่แก้ได้**จากในแอป** (อีกสามอันต้องออกไปตั้งค่าเครื่อง/ติดตั้ง/เปลี่ยนเบราว์เซอร์)
//    ⇒ มันจึงเป็นสถานะเดียวที่ควรมีปุ่ม *ลงมือ* ไม่ใช่ปุ่ม *สอน*.
//
// ② `granted` เนียนลงเป็นบรรทัดเดียวไม่มีกล่องสี (ฟีม: "ให้รู้ว่าเออ เปิดแล้วนะ" = ยืนยัน ไม่ใช่เฉลิมฉลอง).
//    🔴 เนียนเฉพาะ `granted` — อีกสี่สถานะคงกล่องสีไว้ เพราะตอนนั้นรายการข้างล่าง **จะไม่ดังจริง**
//    ⇒ ทำให้เนียนหมดทุกสถานะ = ซ่อนปัญหา ไม่ใช่ออกแบบให้สงบ
export function NotifyStatusBar({
  state,
  onShowGuide,
  onEnable,
}: {
  state: NotifyState
  onShowGuide: (v: InstallGuideVariant) => void
  /** เรียกขอสิทธิ์ — ต้องวิ่งตรงจาก onClick ของปุ่มนี้ (lib/pwa/subscribe.ts:7-8: user gesture เท่านั้น) */
  onEnable: () => void
}) {
  if (state === 'unknown') {
    return <div data-testid="notify-status-skeleton" aria-hidden className="h-[52px] animate-pulse rounded-2xl bg-black/[0.06]" />
  }

  // ✅ เปิดอยู่ = ยืนยันเงียบๆ บรรทัดเดียว ไม่มีกล่อง ไม่มีสีพื้น · รายการข้างล่างได้พื้นที่คืน
  if (state === 'granted') {
    return (
      <p data-testid="notify-status" data-notify-state={state} role="status" className="flex items-center gap-1.5 px-1 text-xs font-medium leading-5 text-v3-text-muted">
        <span aria-hidden>🔔</span>
        การแจ้งเตือนเปิดอยู่
      </p>
    )
  }

  const reason = NOTIFY_REASON[state]
  const guide = guideVariantFor(state)

  return (
    <div
      data-testid="notify-status"
      data-notify-state={state}
      role="status"
      className="flex items-start gap-3 rounded-2xl bg-v3-grade-yellow/40 px-4 py-3"
    >
      <span aria-hidden className="text-base leading-6">🔕</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-6 text-v3-navy">
          {state === 'default' ? 'ยังไม่ได้เปิดการแจ้งเตือน' : 'การแจ้งเตือนปิดอยู่'}
        </p>
        <p className="text-xs font-medium leading-5 text-v3-text-body">
          {/* ทุกสถานะที่ไม่ใช่ granted ต้องพูดผลลัพธ์ให้ชัดก่อน แล้วค่อยบอกวิธี —
              ผู้ใช้ต้องรู้ว่า "รายการข้างล่างจะไม่ดัง" ไม่ใช่แค่ว่ามีบางอย่างตั้งค่าไม่ครบ */}
          {reason ?? 'รายการข้างล่างจะยังไม่ดังจนกว่าจะเปิดการแจ้งเตือน'}
        </p>
      </div>
      {/* ปุ่มลงมือ (default) มาก่อนปุ่มสอน (denied · needs-install) และทั้งสองอันไม่เคยขึ้นพร้อมกัน:
          `default` คืนค่า guide เป็น null อยู่แล้ว ⇒ เงื่อนไขสองอันนี้แยกกันโดยโครงสร้าง ไม่ใช่โดยลำดับ
          `unsupported` ไม่เข้าทั้งสองอัน — ไม่มีวิธีให้สอน และขอสิทธิ์ก็ไม่ช่วย ⇒ ไม่มีปุ่มเลย ตามเดิม */}
      {state === 'default' && (
        <button
          type="button"
          data-testid="notify-status-enable"
          onClick={onEnable}
          className="shrink-0 self-center rounded-full bg-v3-sapphire px-3 py-1.5 text-xs font-bold text-white"
        >
          เปิดการแจ้งเตือน
        </button>
      )}
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

  // #307 · ปุ่ม "เปิดการแจ้งเตือน" บนแถบสถานะ — requestPushSubscription() เป็น **คำสั่งแรก** ใน handler
  // ❌ ไม่ await อะไรก่อนหน้ามัน: `lib/pwa/subscribe.ts:7-8` — เบราว์เซอร์รับ requestPermission() เฉพาะ
  // ที่วิ่งตรงจาก user gesture, ถ้าเราไป await อย่างอื่นก่อน gesture จะหมดอายุแล้วมันจะเมินเงียบ
  //
  // 🔴 แล้วทำไมต้อง dispatch event ต่อท้าย: `usePwaCapability` อ่านค่าใหม่ตอน `visibilitychange` เท่านั้น
  // ซึ่ง **ไม่เกิด** เมื่อผู้ใช้กดอนุญาตในกล่องของเบราว์เซอร์บนเดสก์ท็อป ⇒ ถ้าไม่บอกให้มันอ่านใหม่
  // แถบจะค้างที่ "ยังไม่ได้เปิด" ทั้งที่สิทธิ์เป็น granted แล้ว = จอโกหกในทิศทางตรงข้ามกับบั๊กเดิมพอดี
  // สิ่งที่ event นี้ทำคือสั่งให้ hook ไป**อ่านค่าจริงจากรันไทม์ใหม่** ❌ ไม่ใช่ป้อนค่าที่เราเดาเข้าไปเอง
  const onEnable = () => {
    void requestPushSubscription().then(() => {
      // ยิงทั้งกรณีสำเร็จและไม่สำเร็จ — 'denied' ก็เป็นความจริงใหม่ที่แถบต้องสะท้อน
      document.dispatchEvent(new Event(CAPABILITY_CHANGED))
    })
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
