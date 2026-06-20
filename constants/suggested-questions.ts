// Canonical "next suggested questions" for the bazi chat (#mootech-bazi-chat-lane).
// Hardcoded (0 LLM cost), grounded in the 15 prediction topics the bazi engine reads on
// (the PDF/DOCX report). Order roughly follows the report's chapter order.
// Single source of truth — consumed by both the production chat modal and the dev playground.
export const SUGGESTED_QUESTIONS: string[] = [
  "นิสัยพื้นฐานของฉันเป็นแบบไหน จุดเด่นจุดด้อยอยู่ตรงไหน?",
  "ควรทำอาชีพหรือธุรกิจสายไหนถึงจะรุ่ง?",
  "โชคลาภเรื่องเงินของฉันเป็นยังไง เงินจะมาทางไหน?",
  "ใครคือผู้ใหญ่อุปถัมภ์ที่จะช่วยเหลือฉัน?",
  "พรสวรรค์ของฉันคือเรื่องอะไร?",
  "เรื่องครอบครัวและความสัมพันธ์กับพ่อแม่เป็นยังไง?",
  "ความรักและคู่ครองที่เหมาะกับฉันเป็นแบบไหน?",
  "ใครคือเพื่อนแท้ และควรระวังคนแบบไหน?",
  "ควรทำธุรกิจคนเดียว หรือมีหุ้นส่วนดีกว่า?",
  "ลูกน้องบริวารของฉันจะเป็นยังไง?",
  "ควรเรียนหรือพัฒนาสายไหนถึงจะสำเร็จ?",
  "ช่วงอายุไหนเป็นยุคทอง ช่วงไหนต้องระวัง?",
  "สุขภาพของฉันต้องระวังเรื่องอะไรเป็นพิเศษ?",
  "สีและทิศมงคลของฉันคืออะไร?",
  "ควรบูชาองค์เทพไหน เสริมดวงยังไงให้เฮง?",
]
