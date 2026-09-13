// Canonical "next suggested questions" for the bazi chat (#mootech-bazi-chat-lane).
// Hardcoded (0 LLM cost), grounded in the 15 prediction topics the bazi engine reads on
// (the PDF/DOCX report). Order roughly follows the report's chapter order.
// Single source of truth — consumed by both the production chat modal and the dev playground.
//
// #6 (2026-09-13): แต่ละคำถามผูก topicId ตรงกับ 15 หัวข้อของ engine (triage TRIAGE_TOPIC_IDS) เพื่อส่งเป็น
// baziTopicHint เวลากดชิป → engine ไม่ต้องเดา route เอง (กันคำถามที่ตอบได้ถูกปัดเป็น off_topic).
export type SuggestedQuestion = { q: string; topicId: string }

export const SUGGESTED_QUESTION_ITEMS: SuggestedQuestion[] = [
  { q: "นิสัยพื้นฐานของฉันเป็นแบบไหน จุดเด่นจุดด้อยอยู่ตรงไหน?", topicId: "chart_foundation" },
  { q: "ควรทำอาชีพหรือธุรกิจสายไหนถึงจะรุ่ง?", topicId: "career_potential" },
  { q: "โชคลาภเรื่องเงินของฉันเป็นยังไง เงินจะมาทางไหน?", topicId: "wealth_and_investment" },
  { q: "ใครคือผู้ใหญ่อุปถัมภ์ที่จะช่วยเหลือฉัน?", topicId: "benefactor" },
  { q: "พรสวรรค์ของฉันคือเรื่องอะไร?", topicId: "talent" },
  { q: "เรื่องครอบครัวและความสัมพันธ์กับพ่อแม่เป็นยังไง?", topicId: "family" },
  { q: "ความรักและคู่ครองที่เหมาะกับฉันเป็นแบบไหน?", topicId: "love_partner" },
  { q: "ใครคือเพื่อนแท้ และควรระวังคนแบบไหน?", topicId: "friends_foes" },
  { q: "ควรทำธุรกิจคนเดียว หรือมีหุ้นส่วนดีกว่า?", topicId: "partnership" },
  { q: "ลูกน้องบริวารของฉันจะเป็นยังไง?", topicId: "subordinates" },
  { q: "ควรเรียนหรือพัฒนาสายไหนถึงจะสำเร็จ?", topicId: "education" },
  { q: "ช่วงอายุไหนเป็นยุคทอง ช่วงไหนต้องระวัง?", topicId: "turning_points" },
  { q: "สุขภาพของฉันต้องระวังเรื่องอะไรเป็นพิเศษ?", topicId: "health" },
  { q: "สีและทิศมงคลของฉันคืออะไร?", topicId: "colors_directions" },
  { q: "ควรบูชาองค์เทพไหน เสริมดวงยังไงให้เฮง?", topicId: "guardian_deities" },
]

export const SUGGESTED_QUESTIONS: string[] = SUGGESTED_QUESTION_ITEMS.map((item) => item.q)
