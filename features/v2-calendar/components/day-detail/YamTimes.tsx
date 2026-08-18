// §11 "เวลามงคล" — the 5 ยาม windows from goo's DayDetail (real data), each row on #F9F4F0: window (bold
// navy) + label + a "เพิ่มปฏิทิน" button. The button is a real client add (goo's useReminders.add, de-duped);
// once the day has a reminder the floating menu flips to state 3 (saved). No network. The full save SHEET
// (screen 5 · node 375:13316) is a separate future screen — this is the per-ยาม quick-add.
//
// #316 — LOCKED STATE. ฟีมเคาะใน #286: ปุ่มอยู่ที่เดิม ขนาดเดิม แต่เป็นสถานะล็อก · กดแล้วบอกว่าเป็นของสมาชิก
// ❌ ไม่ซ่อนปุ่ม (Figma Free-2 ตั้งใจโชว์เวลามงคลเต็มให้ free — ซ่อน = เขาไม่รู้ว่ามีของให้ซื้อ)
// ❌ ไม่ปล่อยให้กดผ่าน
//
// `locked` ไม่ใช่ `free` — มันคือ `!paid` (fail-closed). เมื่อ tier ยังไม่รู้ (`isPaid === null`) หน้าเพจซ่อน
// body ทั้งก้อนด้วย `hidden` อยู่แล้ว ([date].tsx:162) ⇒ ถ้าผูกกับ `free` ปุ่มจะเป็นสถานะ "กดได้" ระหว่างนั้น
// และปลอดภัยเพราะ CSS บังเอิญซ่อนไว้เท่านั้น — safe-by-accident คือรูปที่โค้ดฐานนี้ใช้เวลาทั้งวันถอดออก
// (อ่าน ComingSoon.tsx บรรทัดเรื่อง claim ที่เคยเป็น boolean)
//
// ฝั่งเซิร์ฟเวอร์กันอยู่แล้วและ fail-closed (pages/api/v2/reminders.ts:40-43 · lib/usage-core.ts:94) ⇒ ด่านนี้
// ไม่ได้กันข้อมูลรั่ว มันกัน **จอโกหก**: ก่อนหน้านี้ free กดแล้วยิง POST ได้ 403 แบบ fire-and-forget ⇒
// ไม่มีอะไรขยับบนจอเลย ผู้ใช้อ่านว่าปุ่มเสีย
import type { YamSlot } from '../../types'
import { ComingSoonAction } from '@/features/v2-shell/components/ComingSoon'
import { SectionCard } from './SectionCard'

/** ปุ่มปกติ — sapphire ทึบ = กดแล้วเกิดผลจริง */
const PILL = 'shrink-0 rounded-full px-4 py-2 text-xs font-bold'
const PILL_ACTIVE = `${PILL} bg-v3-sapphire text-white`
// ล็อก = โทน disabled ที่ DESIGN.md §2 ประกาศไว้แล้ว (`disabled-bg` #DDDDDD · tailwind.config.ts:65)
// ❌ ไม่ประดิษฐ์ opacity ใหม่ · geometry เดิมทุกค่า ⇒ ตำแหน่ง/ขนาดไม่ขยับตามคำตัดสิน
const PILL_LOCKED = `${PILL} bg-v3-disabled-bg text-v3-text-body`

export const YAM_LOCKED_MESSAGE = 'การตั้งเตือนเป็นของสมาชิก · ระบบสมาชิกกำลังจะมา เร็วๆ นี้'

export function YamTimes({ yams, onAdd, locked = false }: { yams: YamSlot[]; onAdd: (yam: YamSlot) => void; locked?: boolean }) {
  return (
    <SectionCard title="เวลามงคล" info>
      <div className="flex flex-col gap-2.5">
        {yams.map((yam) => (
          <div key={yam.id} className="flex items-center gap-3 rounded-2xl bg-v3-lemon-chiffon px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-v3-navy">{yam.window}</p>
              <p className="mt-0.5 truncate text-xs font-medium text-v3-text-body">{yam.label}</p>
            </div>
            {locked ? (
              // ❌ ไม่ใช่ `disabled` — React กรองคลิกบน element ที่ disabled ทิ้งที่ชั้น fiber ⇒ ตัวกันใน handler
              // จะทดสอบจาก DOM ไม่ได้เลย และผู้ใช้จะกดแล้วเงียบเหมือนเดิม · ปุ่มต้อง "กดได้และตอบ"
              <ComingSoonAction
                testId={`yam-add-locked-${yam.id}`}
                label={`ตั้งเตือน ${yam.window} — เฉพาะสมาชิก`}
                message={YAM_LOCKED_MESSAGE}
                className={PILL_LOCKED}
              >
                🔒 เพิ่มปฏิทิน
              </ComingSoonAction>
            ) : (
              <button
                type="button"
                data-testid={`yam-add-${yam.id}`}
                onClick={() => onAdd(yam)}
                className={PILL_ACTIVE}
              >
                เพิ่มปฏิทิน
              </button>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
