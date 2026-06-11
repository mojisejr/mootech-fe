// dev-access lane — hardcoded "next suggested questions" for the bazi chat playground.
// Grounded in the 15 prediction topics the bazi engine actually reads on (the PDF/DOCX report):
// see projects/bazi/src/lib/bazi/knowledge/topic-registry.ts (thaiLabel per topic).
// Order roughly follows the report's chapter order.
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
