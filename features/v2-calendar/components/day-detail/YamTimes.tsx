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
//
// ⚠️ ขอบเขตของด่านนี้คือ **ปุ่มรายยามเท่านั้น** — CTA แถบล่าง ("เพิ่มลงปฏิทิน เพื่อแจ้งเตือน") ยังเปิดชีท
// ให้ free ได้อยู่ แล้วไปตายที่ 403 ตอนกดบันทึก (ตู๋จับตอนรีวิว #324) ⇒ ถือโดย #326 ซึ่งยังรอฟีมเคาะว่า
// แถบล่างควรเป็นอะไรสำหรับ free ❌ อย่าอ่านไฟล์นี้ว่า "free ยิง POST ไม่ได้แล้ว" — จริงเฉพาะทางนี้
import { Lock } from 'lucide-react'
import type { YamSlot } from '../../types'
import type { YamReminderStatus } from '../../tier-lock'
import { ComingSoonAction } from '@/features/v2-shell/components/ComingSoon'
import { SectionCard } from './SectionCard'

/** ปุ่มปกติ — sapphire ทึบ = กดแล้วเกิดผลจริง */
const PILL = 'shrink-0 rounded-full px-4 py-2 text-xs font-bold'
const PILL_ACTIVE = `${PILL} bg-v3-sapphire text-white`
// ไอคอนล็อกใช้ `Lock` ของ lucide-react ❌ ไม่ใช่ emoji 🔒
// ภาพรอบแรกของ Eye Truth: emoji เรนเดอร์เป็น **สีเต็ม (แม่กุญแจเหลือง)** ⇒ กลายเป็นจุดสีอิ่มที่สุด
// บนจอที่ทั้งจอมีแต่ sapphire/navy/lemon-chiffon และมัน**ดังกว่าตัวหนังสือของปุ่มเอง**
// ซ้ำร้าย emoji เรนเดอร์ไม่เหมือนกันข้ามแพลตฟอร์ม ⇒ เป็นภาพที่เราควบคุมไม่ได้
// lucide เป็น convention ของ v2 อยู่แล้ว (features/v2-first-run/components/PdpaConsentScreen.tsx:2
// import `Lock` ตัวเดียวกัน) และมันวาดด้วย `currentColor` ⇒ รับสีจากปุ่ม ไม่เอาพาเลตต์แปลกปลอมเข้ามา
// ล็อก = โทน disabled ที่ DESIGN.md §2 ประกาศไว้แล้ว (`disabled-bg` #DDDDDD · tailwind.config.ts:65)
// ❌ ไม่ประดิษฐ์ opacity ใหม่
//
// 🔴 ปุ่มล็อก **กว้างกว่า**ปุ่มปกติ — เคยเขียนไว้ตรงนี้ว่า "geometry เดิมทุกค่า ⇒ ขนาดไม่ขยับ" ซึ่ง**ไม่จริง**
// (ตู๋จับตอนรีวิว #324) · token ของกล่องเหมือนกันจริง (`rounded-full px-4 py-2 text-xs`) แต่ *เนื้อใน*
// ยาวกว่า เพราะมีไอคอน + gap ⇒ กล่องกว้างขึ้น · วัดจริงที่ 320 และ 393 (deviceScaleFactor 2):
//     ปุ่มปกติ 82.7px   ปุ่มล็อก 100.7px   ต่าง +18.0
//     คอลัมน์ข้อความ @320  133.3 → 115.5   (@393  206.3 → 188.3)
// ⇒ `yam.label` เป็น `truncate` ⇒ **ผู้ใช้ free เห็นชื่อยามสั้นกว่า paid ประมาณ 18px**
//   ที่ 320 ถูกตัดทั้งสองสถานะอยู่แล้ว · ที่ 393 **ล็อกถูกตัด ปกติไม่ถูกตัด** ⇒ ตรงนั้นคือจุดที่ต่างจริง
// ยอมรับไว้โดยรู้ตัว (label ตั้งใจให้ truncate ตั้งแต่แรก) ❌ ไม่ใช่ไม่รู้ · ถ้าจะชดเชยให้แก้ที่ความกว้าง
// ของคอลัมน์ข้อความ ไม่ใช่ที่ตัวปุ่ม — ปุ่มต้องคงตำแหน่งตามคำตัดสิน #286
const PILL_LOCKED = `${PILL} bg-v3-disabled-bg text-v3-text-body`
// #343 — สองสถานะใหม่ที่ **ไม่ใช่การล็อกเพราะ tier**
//   added : เพิ่มไปแล้ว — ยังกดได้ (พาไปหน้ารายการ) จึงเป็นปุ่มจริง แต่โทนเบาลงเพราะงานตรงนี้จบแล้ว
//   past  : เลยเวลา — กดไม่ได้จริง ใช้ `disabled` ❌ ไม่ใช่ handler ที่เงียบ (ปุ่มที่รับคลิกแล้วไม่ทำอะไร
//           คืออาการที่ใบร่ม #340 ตั้งขึ้นมาแก้) · ที่นี่ไม่มีตัวกันใน handler ให้ทดสอบ ⇒ ใช้ disabled ได้
//           โดยไม่ชนกับเหตุผลที่ #316 เลี่ยงมัน (React กรองคลิกบน disabled ⇒ ตัวกันใน handler ทดสอบไม่ได้)
// ทั้งสองแบบ **ยังอยู่ในรายการ ไม่ถูกซ่อน** — เหตุผลเดียวกับปุ่มล็อกของ #316: ผู้ใช้ต้องเห็นว่าวันนี้มีกี่ยาม
// และตัวเองอยู่ตรงไหน ไม่ใช่เห็นรายการที่หดลงโดยไม่รู้ว่าอะไรหายไป
const PILL_ADDED = `${PILL} bg-v3-sapphire/10 text-v3-sapphire`
const PILL_PAST = `${PILL} bg-v3-disabled-bg text-v3-text-body`

export const YAM_LOCKED_MESSAGE = 'การตั้งเตือนเป็นของสมาชิก · ระบบสมาชิกกำลังจะมา เร็วๆ นี้'

// #343 — ป้ายของ 4 สถานะ export ไว้เพื่อให้ฟันอ้างค่าเดียวกับที่จอวาด ❌ ไม่ใช่พิมพ์สตริงซ้ำในเทสต์
// (เทสต์ที่พิมพ์สตริงเองจะเขียวต่อไปแม้ป้ายบนจอเปลี่ยน — ฟันที่อ่านค่าที่ตัวเองเขียน)
export const YAM_ADD_LABEL = 'เพิ่มปฏิทิน'
export const YAM_ADDED_LABEL = 'เพิ่มแล้ว'
export const YAM_PAST_LABEL = 'เลยเวลา'

// 🔴 `locked` เป็น required ❌ ไม่ใช่ optional ที่ default false — ตู๋ยิงพิสูจน์ (#324): ถอด
// `locked={…}` ออกจากผู้เรียกจริงที่ [date].tsx:186 แล้ว **302/302 ยังเขียวครบ · tsc exit 0**
// ⇒ ฟันทั้งชุดเฝ้า "component ทำอะไรเมื่อได้ locked" แต่ไม่มีอะไรเฝ้า "หน้าเพจส่ง locked มาจริงไหม"
// required ย้ายด่านนั้นไปอยู่ที่คอมไพเลอร์: ถอดออก ⇒ TS2741 ชี้บรรทัดผู้เรียกเป๊ะ
// (ผู้เรียกทั้ง repo มีตัวเดียวและส่ง prop อยู่แล้ว ⇒ ไม่มีใครเสียประโยชน์จาก default)
export function YamTimes({
  yams,
  onAdd,
  locked,
  statusFor,
  onViewList,
}: {
  yams: YamSlot[]
  onAdd: (yam: YamSlot) => void
  locked: boolean
  /** #343 — สถานะของยามนี้ (`added`/`past`/`addable`) · ตรรกะอยู่ที่ `yamReminderStatus` ใน tier-lock.ts
   *  🔴 required เหมือน `locked` ด้วยเหตุผลเดียวกัน (#324): ถ้าเป็น optional ที่ default 'addable'
   *  ผู้เรียกที่ลืมส่งจะได้ปุ่มที่บอกว่า "เพิ่มได้" กับยามที่เพิ่มไปแล้ว โดยไม่มีอะไรแดง */
  statusFor: (yam: YamSlot) => YamReminderStatus
  /** ไปหน้ารายการแจ้งเตือนทั้งหมด — ปลายทางของยามที่ "เพิ่มแล้ว" */
  onViewList: () => void
}) {
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
                className={`${PILL_LOCKED} inline-flex items-center gap-1`}
              >
                <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
                เพิ่มปฏิทิน
              </ComingSoonAction>
            ) : statusFor(yam) === 'added' ? (
              <button
                type="button"
                data-testid={`yam-added-${yam.id}`}
                aria-label={`${yam.window} เพิ่มแล้ว — ดูการแจ้งเตือนทั้งหมด`}
                onClick={onViewList}
                className={PILL_ADDED}
              >
                {YAM_ADDED_LABEL}
              </button>
            ) : statusFor(yam) === 'past' ? (
              <button
                type="button"
                data-testid={`yam-past-${yam.id}`}
                disabled
                aria-label={`${yam.window} เลยเวลาแจ้งเตือนแล้ว`}
                className={PILL_PAST}
              >
                {YAM_PAST_LABEL}
              </button>
            ) : (
              <button
                type="button"
                data-testid={`yam-add-${yam.id}`}
                onClick={() => onAdd(yam)}
                className={PILL_ACTIVE}
              >
                {YAM_ADD_LABEL}
              </button>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
