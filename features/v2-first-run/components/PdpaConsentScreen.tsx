import type { ComponentType, SVGProps } from 'react'
import { Lock, Shield, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FirstRunScreen } from './FirstRunScreen'

// PdpaConsentScreen — "ความเป็นส่วนตัวของคุณ" (Figma 04-pdpa: 300:1582 unticked → 300:2137 ticked).
// The two Figma frames are ONE screen in two states, not two screens.
//
// Consent is held by the caller and goes nowhere yet (issue #215 is UI only; recording the consent
// is ใบ 3). What ships here is the GATE: the button cannot be pressed until the box is ticked.
//
// lucide-react supplies lock/shield/star: the Figma export is lucide's own path data at stroke-width
// 2 (checked path-by-path before reusing, not assumed from the layer names), and the project already
// depends on lucide-react — so this reuses the glyph instead of shipping a second copy of it.

type Assurance = { Icon: ComponentType<SVGProps<SVGSVGElement>>; title: string; body: string }

const ASSURANCES: Assurance[] = [
  {
    Icon: Lock,
    title: 'ข้อมูลถูกเข้ารหัสปลอดภัย',
    body: 'ข้อมูลสุขภาพและส่วนตัวของคุณจะถูกเก็บรักษาด้วยมาตรฐานสากล',
  },
  {
    Icon: Shield,
    title: 'ไม่แชร์ข้อมูลให้บุคคลที่สาม',
    body: 'เราจะไม่นำข้อมูลส่วนตัวของคุณไปขายเพื่อวัตถุประสงค์ทางการค้า',
  },
  {
    Icon: Star,
    title: 'AI วิเคราะห์เพื่อสุขภาพเท่านั้น',
    body: 'ข้อมูลถูกนำมาใช้เพื่อให้คำแนะนำที่ตรงจุดสำหรับคุณโดยเฉพาะ',
  },
]

const POLICY_SUMMARY =
  'เราขอความยินยอมในการรวบรวมข้อมูลวันเกิด เวลาเกิด และข้อมูลสุขภาพ เพื่อประมวลผลด้วยระบบ AI ตามหลักสถิติพยากรณ์และการดูแลสุขภาพแบบองค์รวม เพื่อสร้างแผนการปฏิบัติตนที่เหมาะสมกับพื้นฐานดวงชะตาและร่างกายของคุณ โดยข้อมูลทั้งหมดจะถูกจัดเก็บเป็นความลับสูงสุดตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA)'

export function PdpaConsentScreen({
  consent,
  onConsentChange,
  onBack,
  onAccept,
  saving = false,
  error = false,
}: {
  consent: boolean
  onConsentChange: (next: boolean) => void
  onBack?: () => void
  onAccept?: () => void
  /** the caller is saving consent — button shows progress + locks to stop a double-submit (#233). */
  saving?: boolean
  /** the save failed — show a retriable message; the button stays usable (do NOT disable on error). */
  error?: boolean
}) {
  return (
    <FirstRunScreen
      step={1}
      onBack={onBack}
      footer={
        <div className="flex flex-col gap-2">
          {/* THE gate. `disabled={!consent}` is the whole point of this screen — strip it and
              scripts/first-run-screens.test.tsx must go red (issue #215 close condition). `|| saving`
              only ADDS a lock while the save is in flight; consent=false still disables as before. */}
          <Button onClick={onAccept} disabled={!consent || saving}>
            {saving ? 'กำลังบันทึก…' : 'ยอมรับและดำเนินการต่อ'}
          </Button>
          {error ? (
            <p className="text-center font-ibm text-sm leading-5 text-v3-error" role="alert">
              บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง
            </p>
          ) : null}
        </div>
      }
      contentClassName="gap-8 px-6 py-8"
    >
      <div className="flex flex-col gap-3 text-center">
        <h1 className="font-ibm text-2xl font-bold leading-8 text-v3-text-title">
          ความเป็นส่วนตัวของคุณ
        </h1>
        <p className="font-ibm text-base leading-6 text-v3-text-body">
          เราให้ความสำคัญกับการปกป้องข้อมูลส่วนบุคคลของคุณ เพื่อมอบประสบการณ์ที่ดีที่สุด
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {ASSURANCES.map(({ Icon, title, body }) => (
          <div key={title} className="flex items-center gap-4 rounded-2xl bg-white p-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-v3-ghost-white">
              <Icon className="size-6 text-v3-cyan" strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="font-ibm text-base font-bold leading-6 text-v3-text-title">
                {title}
              </span>
              <span className="font-ibm text-sm leading-[22px] text-v3-text-body">{body}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-ibm text-base font-bold leading-6 text-v3-text-title">
          สรุปสาระสำคัญของนโยบาย
        </h2>
        <p className="font-ibm text-sm leading-[22px] text-v3-text-body">{POLICY_SUMMARY}</p>
      </div>

      {/* Consent line. The Checkbox primitive's own `label` prop is not used here for two reasons:
          it renders body-grey 16/24 where Figma has navy, and it takes a plain string — there is no
          slot for the underlined sapphire link. So: unlabeled primitive (still the real focusable
          control, still the accessible name via ariaLabel) + the Figma type beside it. The text is a
          convenience hit target; the checkbox remains the keyboard-reachable one. */}
      <div className="flex items-center gap-3">
        <Checkbox
          checked={consent}
          onChange={onConsentChange}
          ariaLabel="ฉันอ่านและยอมรับข้อกำหนดความเป็นส่วนตัว"
        />
        <span className="font-ibm text-base leading-6 text-v3-text-title">
          <span onClick={() => onConsentChange(!consent)} className="cursor-pointer">
            {'ฉันอ่านและยอมรับ '}
          </span>
          <a href="#" className="text-v3-sapphire underline">
            ข้อกำหนดความเป็นส่วนตัว
          </a>
        </span>
      </div>
    </FirstRunScreen>
  )
}

export default PdpaConsentScreen
