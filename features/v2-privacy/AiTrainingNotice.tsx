// features/v2-privacy/AiTrainingNotice.tsx — ประกาศครั้งเดียวหลังกดยอมรับนโยบาย (CIEL mumate-pdpa-reconsent-001 plan 0.3):
// การยอมรับเปิดข้อ "ใช้คำถามของคุณ" ไว้ (opt-out ตามทีม) จึงบอกตรง ๆ ว่าใช้อะไร และปิดได้ที่ไหน — ไม่ถามซ้ำ ไม่มีปุ่ม "ไม่ยินยอม"
// ในนี้ (ปิดได้ที่ตั้งค่าที่เดียว). แสดงหลังบันทึกสำเร็จเท่านั้น: หน้าที่ใช้คือ /v2/policy-update และ /v2/first-run
import { useRouter } from 'next/router'
import { Button } from '@/components/ui/button'

export const AI_TRAINING_NOTICE = {
  title: 'คำถามของคุณช่วยให้เสี่ยวมู่ตอบได้ดีขึ้น',
  body: 'ตามนโยบายที่คุณเพิ่งยอมรับ เราใช้เฉพาะคำถามที่คุณพิมพ์ ไม่รวมคำตอบ และตัดชื่อหรือข้อมูลที่ชี้ถึงตัวคุณออกก่อนเก็บ',
  off: 'ถ้าไม่ต้องการ ปิดได้ทุกเมื่อที่',
  path: 'ตั้งค่า › จัดการความยินยอม',
  ok: 'เข้าใจแล้ว',
  settings: 'ไปที่ตั้งค่า',
}
export const CONSENT_SETTINGS_PATH = '/v2/privacy/consent'

export function AiTrainingNotice({ onDone }: { onDone: () => void }) {
  const router = useRouter()
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(11,48,91,0.45)]" role="dialog" aria-modal="true" aria-labelledby="ai-notice-title" data-testid="ai-training-notice">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-t-3xl bg-white px-6 pt-6 text-center font-ibm" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-v3-lime/30 text-2xl" aria-hidden="true">
          🤝
        </div>
        <h2 id="ai-notice-title" className="text-lg font-bold leading-7 text-v3-text-title">
          {AI_TRAINING_NOTICE.title}
        </h2>
        <p className="text-sm leading-[22px] text-v3-text-body">{AI_TRAINING_NOTICE.body}</p>
        <p className="text-sm leading-[22px] text-v3-text-body">
          {AI_TRAINING_NOTICE.off} <span className="font-semibold text-v3-sapphire">{AI_TRAINING_NOTICE.path}</span>
        </p>
        <div className="mt-2 flex flex-col gap-2">
          <Button onClick={onDone}>{AI_TRAINING_NOTICE.ok}</Button>
          <Button variant="tertiary" onClick={() => void router.push(CONSENT_SETTINGS_PATH)}>
            {AI_TRAINING_NOTICE.settings}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AiTrainingNotice
