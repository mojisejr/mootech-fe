// features/v2-privacy/aiTraining.ts — ความยินยอม "ใช้คำถามที่ถาม AI เพื่อพัฒนาความแม่นยำ" (เอ็ม 2026-10-22)
// plan 0.3 ของ CIEL mumate-pdpa-reconsent-001 (owner 2026-10-23, ตามทีม): opt-out — กดยอมรับนโยบาย (หน้าสมัครและหน้าฉบับปรับปรุง)
// = เปิดข้อนี้ เว้นแต่คำตอบล่าสุดคือ "ไม่" · ปิดได้ทุกเมื่อที่ตั้งค่า (ปิด = engine ลบคำถามที่เก็บไว้ทั้งหมด)
// เก็บผ่าน /api/consent (engine bazi_consent kind='ai_training') · engine เก็บแต่คำถาม ไม่เก็บคำตอบ
// รุ่น 2026-10.2 (CIEL mumate-bdash-v2-001 slice 4): จุดประสงค์เพิ่ม "วิเคราะห์ว่าสมาชิกสนใจเรื่องไหน เพื่อพัฒนาบริการ" —
// คนที่ตอบรุ่นเดิมถูกถามอีกครั้ง และ engine เก็บคำถามเฉพาะคนที่ยินยอมรุ่นนี้ (ต้องตรงกับ AI_TRAINING_VERSION ฝั่ง bazi)
export const AI_TRAINING_KIND = 'ai_training'
export const AI_TRAINING_VERSION = '2026-10.2'

export const AI_TRAINING_TITLE = 'ให้เราใช้คำถามของคุณ เพื่อช่วยให้เสี่ยวมู่ตอบได้ดียิ่งขึ้น'
// ข้อความสั้นของข้อนี้อยู่ที่นี่ที่เดียว (ช่องติ๊กสมัคร · หน้านโยบายฉบับปรับปรุง · สวิตช์ตั้งค่า); ฉบับเต็มอยู่ที่
// constants/privacy-policy.ts ข้อ 3.1 — ต้องพูดตรงกัน: ใช้อะไร (คำถามที่พิมพ์ ตัดข้อมูลที่ชี้ตัวคนแล้ว) ใช้ทำอะไร (ปรับปรุงเสี่ยวมู่
// และบริการ) และปิดได้ (ปิดแล้วลบ) — CIEL mumate-pdpa-reconsent-001 plan 0.3
export const AI_TRAINING_SUB =
  'ใช้เฉพาะคำถามที่คุณพิมพ์ ไม่รวมคำตอบ และตัดชื่อหรือข้อมูลที่ชี้ถึงตัวคุณออกก่อนเก็บ เพื่อปรับปรุงเสี่ยวมู่และบริการ · ปิดได้ทุกเมื่อที่ ตั้งค่า › จัดการความยินยอม'
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

/**
 * opt-out (plan 0.3): เรียกหลังบันทึกการยอมรับนโยบายสำเร็จ — เปิด ai_training รุ่นปัจจุบัน เว้นแต่คำตอบล่าสุดคือ "ไม่"
 * (คำปฏิเสธที่ให้ไว้ยังมีผล). อ่านคำตอบเดิมไม่ได้ = ไม่เปิด (ไม่เสี่ยงทับคำปฏิเสธ).
 * คืน true เมื่อข้อนี้เปิดอยู่หลังเรียก → ผู้เรียกแสดงประกาศครั้งเดียว (AiTrainingNotice)
 */
export async function turnOnAiTrainingOnAcceptance(): Promise<boolean> {
  try {
    const r = await fetch('/api/consent')
    if (!r.ok) return false
    const j = (await r.json()) as { consents?: ConsentRow[] }
    const consents = j.consents ?? []
    const latest = latestAiTraining(consents)
    if (latest && !latest.accepted) return false
    if (aiTrainingOn(consents)) return true
    return await recordAiTrainingConsent(true)
  } catch {
    return false
  }
}
