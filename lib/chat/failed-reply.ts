// What the chat shows when no answer arrived, and how such replies stay out of history
// (mumate-chat-failed-answer-001 slice 3). The wording is the team's (2026-11-18); it names no AI provider.
export const CHAT_FAILED_REPLY_TEXT =
  "ขออภัยนะคะ ตอนนี้ระบบอาจใช้เวลาประมวลผลนานกว่าปกติหรือขัดข้องชั่วคราว รบกวนลองใหม่อีกครั้งน้า~ แต่ถ้าลองแล้วยังไม่หาย ทักหาแอดมินได้เลยที่ LINE OA: @mumate ยินดีดูแลค่ะ"

// Error texts older builds stored in local history before failed replies were marked. A restored turn
// whose whole text is one of these is dropped, so it is neither shown again nor sent back as context.
const LEGACY_FAILED_REPLY = [
  /^ขออภัยค่ะ ตอนนี้การเชื่อมต่อ Gemini ใช้เวลานานหรือมีปัญหา กรุณาลองใหม่อีกครั้ง$/,
  /^ขออภัย ตอนนี้ยังตอบคำถามนี้ไม่ได้ ลองถามใหม่อีกครั้งนะ รอบนี้ไม่หักชี่$/,
  /^การเชื่อมต่อมีปัญหา ลองใหม่อีกครั้ง(นะครับ|นะคะ)$/,
  /^ไม่ได้รับคำตอบจาก(เสี่ยวมู่|เสี่ยวมี่) ลองใหม่อีกครั้ง(นะครับ|นะคะ)$/,
  /^เกิดข้อผิดพลาด ลองใหม่อีกครั้ง(นะครับ|นะคะ)$/,
]

export function isFailedReplyText(content: string): boolean {
  const t = content.trim()
  return t === CHAT_FAILED_REPLY_TEXT || LEGACY_FAILED_REPLY.some((re) => re.test(t))
}

type Turn = { role: string; content: string; loading?: boolean; failed?: boolean }

/** Turns worth keeping and replaying: finished, non-empty, and not a failed reply. */
export function keepableTurns<T extends Turn>(turns: readonly T[]): T[] {
  return turns.filter(
    (t) => !t.loading && !!t.content && !t.failed && !(t.role === "assistant" && isFailedReplyText(t.content)),
  )
}
