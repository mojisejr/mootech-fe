// features/v2-privacy/aiTraining.ts — ความยินยอม "ใช้คำถามที่ถาม AI เพื่อพัฒนาความแม่นยำ" (เอ็ม 2026-10-22)
// แยกจาก PDPA หลัก · ไม่ติ๊กไว้ก่อน · ไม่บังคับ · ถอนได้ทุกเมื่อ (ถอน = engine ลบคำถามที่เก็บไว้ทั้งหมด)
// เก็บผ่าน /api/consent (engine bazi_consent kind='ai_training') · engine เก็บแต่คำถาม ไม่เก็บคำตอบ
export const AI_TRAINING_KIND = 'ai_training'
export const AI_TRAINING_VERSION = '2026-10'

export const AI_TRAINING_TITLE = 'ใช้คำถามที่ถาม AI เพื่อพัฒนาความแม่นยำ'
export const AI_TRAINING_SUB =
  'เก็บเฉพาะคำถามที่คุณพิมพ์ถามเสี่ยวมู่/เสี่ยวมี่ (ไม่เก็บคำตอบ) แบบไม่ระบุตัวตน ตัดเบอร์โทร อีเมล และตัวเลขยาวออกก่อนเก็บ เก็บไม่เกิน 2 ปี'
export const AI_TRAINING_OFF_IMPACT = 'ปิดแล้ว: คำถามที่เคยเก็บไว้จะถูกลบทั้งหมด ใช้งานได้ตามปกติทุกอย่าง'

/** ถามแล้วในเครื่องนี้ (กันเด้งซ้ำระหว่างรอ server) */
export const AI_TRAINING_ASKED_KEY = 'mumate:ai-training-asked'

type ConsentRow = { kind: string; accepted: boolean }

/** บันทึกคำตอบ (ยินยอม/ไม่ยินยอม) — คืน true ถ้าสำเร็จ */
export async function recordAiTrainingConsent(accepted: boolean): Promise<boolean> {
  try {
    const r = await fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: AI_TRAINING_KIND, version: AI_TRAINING_VERSION, accepted }),
    })
    return r.ok
  } catch {
    return false
  }
}

/** สมาชิกคนนี้เคยตอบเรื่องนี้แล้วหรือยัง — null = เช็กไม่ได้ (ยังไม่ล็อกอิน/เครือข่ายล่ม → ไม่ถาม) */
export async function hasAnsweredAiTraining(): Promise<boolean | null> {
  try {
    const r = await fetch('/api/consent')
    if (!r.ok) return null
    const j = (await r.json()) as { consents?: ConsentRow[] }
    return (j.consents ?? []).some((c) => c.kind === AI_TRAINING_KIND)
  } catch {
    return null
  }
}
