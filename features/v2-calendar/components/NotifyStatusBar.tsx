// #286/#307 · แถบสถานะแจ้งเตือนบนหน้ารายการ (หน้ากระดิ่ง)
//
// 🔴 ทำไมมันย้ายออกมาจาก pages/v2/calendar/notifications.tsx (มุน · #307): มันอยู่ในไฟล์ page และ
// export ออกมาเฉยๆ ไม่พอ — โมดูล page ลากสายข้อมูลทั้งเส้นมาด้วย (useReminders → useV2User →
// constants/api/endpoint.ts ซึ่งเรียก next/config `getConfig()` ที่ module scope) ⇒ unit test ที่
// import มันจะล้มด้วย "Cannot destructure property 'publicRuntimeConfig'" ก่อนจะได้รันเทสต์แรก.
// นี่เป็น component ที่ไม่มี state ไม่มี hook ไม่มี network — มันไม่ควรถูกทดสอบผ่านสายข้อมูลของ page
// (SaveSheet · InstallGuideSheet ก็อยู่ที่ features/ ด้วยเหตุผลเดียวกัน)
import type { NotifyState } from '../notify-state'
import { guideVariantFor, NOTIFY_REASON } from '../notify-state'
import type { InstallGuideVariant } from './InstallGuideSheet'

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
  /** เรียกขอสิทธิ์ — ต้องวิ่งตรงจาก onClick ของปุ่มนี้ (lib/pwa/subscribe.ts:7-8: user gesture เท่านั้น)
   *
   * ⚠️ **กฎ "ต้องเป็นคำสั่งแรก" นี้ยังไม่มีอะไรเฝ้ามันเลย** (ตู๋ · รีวิว PR #308): stub ของ
   * `requestPermission` ทั้งใน unit และ harness **resolve เสมอ** ไม่ว่า gesture จะหมดอายุหรือยัง
   * ⇒ ใส่ `await` คั่นหน้ามันเมื่อไหร่ ตัวนับก็ยังนับได้ แถบก็ยังพลิก ⇒ ทั้งสองด่านยังเขียว
   * 🔴 ⇒ **ห้ามยกผล harness 21/21 ไปอ้างว่ากฎข้อนี้ถูกพิสูจน์แล้ว** — ตอนนี้มันถูกค้ำด้วยคอมเมนต์นี้
   * กับสายตาคนรีวิวเท่านั้น · ทางปิดที่มีอยู่จริงแล้ว: assert **ลำดับการเรียก** แบบที่ goo ทำใน #303
   * ❌ ไม่ใช่พยายามจำลอง gesture expiry ใน Playwright */
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
      // 🔴 ปุ่มลงไปอยู่ใต้ข้อความ ไม่ใช่ข้างมัน — วัดมาจากภาพจริงที่ 320 ไม่ใช่เลือกเพราะดูดีในหัว:
      // ตอนวางปุ่มไว้ข้างๆ (`flex-row`) หัวข้อ "ยังไม่ได้เปิดการแจ้งเตือน" ถูกบีบจนตกบรรทัดเป็น
      // "ยังไม่ได้เปิดการ / แจ้งเตือน" — ภาษาไทยไม่มีช่องว่างระหว่างคำ เบราว์เซอร์จึงหักกลางคำได้
      // และมันหักตรงนั้นจริง · `sm:` คืนแถวเดียวให้จอกว้างที่มีที่พอ
      className="flex flex-col gap-2 rounded-2xl bg-v3-grade-yellow/40 px-4 py-3 sm:flex-row sm:items-start sm:gap-3"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span aria-hidden className="text-base leading-6">🔕</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-6 text-v3-navy">
            {state === 'default' ? 'ยังไม่ได้เปิดการแจ้งเตือน' : 'การแจ้งเตือนปิดอยู่'}
          </p>
          <p className="text-xs font-medium leading-5 text-v3-text-body">
            {/* ทุกสถานะที่ไม่ใช่ granted ต้องพูดผลลัพธ์ให้ชัดก่อน แล้วค่อยบอกวิธี —
                ผู้ใช้ต้องรู้ว่า "รายการข้างล่างจะไม่ดัง" ไม่ใช่แค่ว่ามีบางอย่างตั้งค่าไม่ครบ
                #307: ประโยคเดิมของ `default` ลงท้ายว่า "…จนกว่าจะเปิดการแจ้งเตือน" ซึ่งพอมีปุ่มชื่อ
                เดียวกันอยู่ข้างๆ มันกลายเป็นอ่านซ้ำสองครั้ง ⇒ ตัดหางออก ปุ่มพูดส่วนที่เหลือเอง */}
            {reason ?? 'รายการข้างล่างจะยังไม่ดัง'}
          </p>
        </div>
      </div>
      {/* ปุ่มลงมือ (default) มาก่อนปุ่มสอน (denied · needs-install) และทั้งสองอันไม่เคยขึ้นพร้อมกัน:
          `default` คืนค่า guide เป็น null อยู่แล้ว ⇒ เงื่อนไขสองอันนี้แยกกันโดยโครงสร้าง ไม่ใช่โดยลำดับ
          `unsupported` ไม่เข้าทั้งสองอัน — ไม่มีวิธีให้สอน และขอสิทธิ์ก็ไม่ช่วย ⇒ ไม่มีปุ่มเลย ตามเดิม */}
      {state === 'default' && (
        <button
          type="button"
          data-testid="notify-status-enable"
          onClick={onEnable}
          className="shrink-0 self-start rounded-full bg-v3-sapphire px-4 py-2 text-xs font-bold text-white sm:self-center sm:px-3 sm:py-1.5"
        >
          เปิดการแจ้งเตือน
        </button>
      )}
      {guide && (
        <button type="button" data-testid="notify-status-guide" onClick={() => onShowGuide(guide)} className="shrink-0 self-start rounded-full border border-v3-sapphire/30 px-4 py-2 text-xs font-bold text-v3-sapphire sm:self-center sm:px-3 sm:py-1">
          ดูวิธี
        </button>
      )}
    </div>
  )
}
