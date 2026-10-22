// features/v2-privacy/aiTraining.ts — ความยินยอม "ใช้คำถามที่ถาม AI เพื่อพัฒนาความแม่นยำ" (เอ็ม 2026-10-22)
// แยกจาก PDPA หลัก · ไม่ติ๊กไว้ก่อน · ไม่บังคับ · ถอนได้ทุกเมื่อ (ถอน = engine ลบคำถามที่เก็บไว้ทั้งหมด)
// เก็บผ่าน /api/consent (engine bazi_consent kind='ai_training') · engine เก็บแต่คำถาม ไม่เก็บคำตอบ
// รุ่น 2026-10.2 (CIEL mumate-bdash-v2-001 slice 4): จุดประสงค์เพิ่ม "วิเคราะห์ว่าสมาชิกสนใจเรื่องไหน เพื่อพัฒนาบริการ" —
// คนที่ตอบรุ่นเดิมถูกถามอีกครั้ง และ engine เก็บคำถามเฉพาะคนที่ยินยอมรุ่นนี้ (ต้องตรงกับ AI_TRAINING_VERSION ฝั่ง bazi)
export const AI_TRAINING_KIND = 'ai_training'
export const AI_TRAINING_VERSION = '2026-10.2'

export const AI_TRAINING_TITLE = 'ใช้คำถามที่ถาม AI เพื่อพัฒนา AI และบริการ'
// ข้อความสั้นของข้อนี้อยู่ที่นี่ที่เดียว (ช่องติ๊กสมัคร · หน้านโยบายฉบับปรับปรุง · สวิตช์ตั้งค่า); ฉบับเต็มอยู่ที่
// constants/privacy-policy.ts ข้อ 3.1. โทนบวกตามที่ owner เลือก 2026-10-22 — จุดประสงค์ครบอยู่ในหัวข้อ (AI และบริการ)
export const AI_TRAINING_SUB =
  'ช่วยให้เสี่ยวมู่ตอบได้ตรงใจคุณมากขึ้น · เก็บแค่คำถามที่คุณพิมพ์ ไม่เก็บคำตอบ · ปิดได้ทุกเมื่อที่ ตั้งค่า › จัดการความยินยอม'
export const AI_TRAINING_OFF_IMPACT = 'ปิดแล้ว: คำถามที่เคยเก็บไว้จะถูกลบทั้งหมด ใช้งานได้ตามปกติทุกอย่าง'

/** ถามรุ่นนี้แล้วในเครื่องนี้ (กันเด้งซ้ำระหว่างรอ server) — ผูกกับรุ่น ขึ้นรุ่นใหม่จึงถามได้อีกครั้ง */
export const AI_TRAINING_ASKED_KEY = `mumate:ai-training-asked:${AI_TRAINING_VERSION}`

type ConsentRow = { kind: string; version?: string; accepted: boolean }

/** คำตอบล่าสุดเรื่องนี้ (engine เรียงใหม่สุดก่อน) */
export const latestAiTraining = (consents: ConsentRow[]): ConsentRow | undefined => consents.find((c) => c.kind === AI_TRAINING_KIND)

/** สวิตช์เปิดอยู่ = คำตอบล่าสุดยินยอม และเป็นรุ่นปัจจุบัน (ยินยอมรุ่นเดิม engine ไม่เก็บแล้ว จึงแสดงเป็นปิด) */
export const aiTrainingOn = (consents: ConsentRow[]): boolean => {
  const latest = latestAiTraining(consents)
  return Boolean(latest?.accepted && latest.version === AI_TRAINING_VERSION)
}

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

/**
 * สมาชิกคนนี้ตอบรุ่นปัจจุบันแล้วหรือยัง — 'current' = ตอบแล้ว (ไม่ถาม) · 'never' = ไม่เคยตอบ · 'old' = ตอบรุ่นเดิม (ถามอีกครั้ง)
 * null = เช็กไม่ได้ (ยังไม่ล็อกอิน/เครือข่ายล่ม → ไม่ถาม)
 */
export async function aiTrainingAnswer(): Promise<'current' | 'never' | 'old' | null> {
  try {
    const r = await fetch('/api/consent')
    if (!r.ok) return null
    const j = (await r.json()) as { consents?: ConsentRow[] }
    const latest = latestAiTraining(j.consents ?? [])
    if (!latest) return 'never'
    return latest.version === AI_TRAINING_VERSION ? 'current' : 'old'
  } catch {
    return null
  }
}
