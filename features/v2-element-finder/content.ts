// features/v2-element-finder/content.ts — เนื้อหาผลธาตุ 5 แบบ สำหรับ "มาหาธาตุแท้ / Bazi Element Finder" (#6)
// v1 DRAFT (เอ็ม 2026-09-21: ผมดราฟต์จากของเดิม → ซินแสรีวิว/แก้ถ้อยคำทีหลัง). key = ธาตุไทย.
// สี = ตรง lib/bazi/element-colors.ts (ทอง=เทา #5A5A5A). มาสคอต = /images/v2/destiny/el-*.png (มีอยู่แล้ว).
export type ElementKey = "ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ"

export type ElementContent = {
  key: ElementKey
  nameTh: string // "ธาตุทอง"
  nameEn: string // "GOLD ELEMENT"
  mascot: string // path มาสคอตธาตุ
  quote: string // คำโดนใจบนการ์ด (ดราฟต์)
  traits: string[] // ป้ายนิสัยสั้น
  description: string // ย่อหน้าอธิบาย (ดราฟต์)
}

export const ELEMENT_CONTENT: Record<ElementKey, ElementContent> = {
  ไม้: {
    key: "ไม้", nameTh: "ธาตุไม้", nameEn: "WOOD ELEMENT", mascot: "/images/v2/destiny/el-wood.png",
    quote: "โตขึ้นทุกวัน แม้ในวันที่ไม่มีใครมองเห็น",
    traits: ["เมตตา", "ใจกว้าง", "ริเริ่ม", "เติบโต"],
    description: "คุณมีน้ำใจ มองโลกในแง่ดี ชอบเริ่มสิ่งใหม่และพัฒนาตัวเองไม่หยุด มีพลังของการเติบโตอยู่ในตัว แต่บางครั้งก็ใจอ่อนและแบกความรู้สึกคนอื่นมากไปหน่อย",
  },
  ไฟ: {
    key: "ไฟ", nameTh: "ธาตุไฟ", nameEn: "FIRE ELEMENT", mascot: "/images/v2/destiny/el-fire.png",
    quote: "ฉันสว่างที่สุด ตอนได้อยู่ข้างคนที่ใช่",
    traits: ["มีเสน่ห์", "กระตือรือร้น", "จริงใจ", "อบอุ่น"],
    description: "คุณมีพลังและความอบอุ่นที่ดึงดูดผู้คน กล้าแสดงออก จริงใจ และทำอะไรเต็มที่เสมอ แต่บางทีก็ใจร้อนวูบวาบและเผาผลาญตัวเองเร็วไปหน่อย",
  },
  ดิน: {
    key: "ดิน", nameTh: "ธาตุดิน", nameEn: "EARTH ELEMENT", mascot: "/images/v2/destiny/el-earth.png",
    quote: "ฉันไม่หวือหวา แต่ฉันอยู่ตรงนี้เสมอ",
    traits: ["มั่นคง", "น่าเชื่อถือ", "อดทน", "จริงใจ"],
    description: "คุณหนักแน่น เป็นที่พึ่งของคนรอบข้าง รับผิดชอบสูงและรักษาคำพูด ผู้คนไว้ใจได้ แต่บางครั้งก็ยึดติดกับความเดิมและเปลี่ยนแปลงยากไปนิด",
  },
  ทอง: {
    key: "ทอง", nameTh: "ธาตุทอง", nameEn: "GOLD ELEMENT", mascot: "/images/v2/destiny/el-metal.png",
    quote: "ไม่กลัวอะไรเลย นอกจากกลัวเธอไม่รัก",
    traits: ["เด็ดเดี่ยว", "มีวินัย", "ยุติธรรม", "พูดตรง"],
    description: "คุณเด็ดเดี่ยว มั่นใจในตัวเอง ยึดความถูกต้องยุติธรรม และพูดตรงเสมอ รักความเป็นระเบียบ แต่บางทีก็เข้มงวดกับตัวเองและคนอื่นไปมากหน่อย",
  },
  น้ำ: {
    key: "น้ำ", nameTh: "ธาตุน้ำ", nameEn: "WATER ELEMENT", mascot: "/images/v2/destiny/el-water.png",
    quote: "ฉันปรับตัวได้ทุกที่ แต่ไม่เคยลืมว่าฉันเป็นใคร",
    traits: ["ฉลาด", "ยืดหยุ่น", "ลึกซึ้ง", "ช่างคิด"],
    description: "คุณเรียนรู้ไว มองขาด ปรับตัวเก่งและเข้าใจคน เชื่อมโยงข้อมูลได้ดี แต่บางครั้งก็คิดมากและเก็บความรู้สึกไว้คนเดียวเงียบ ๆ",
  },
}

// ธาตุไทยจาก element-summary (elementTh อาจมาเป็น "ไม้/ไฟ/ดิน/ทอง/น้ำ" หรือ "โลหะ") → normalize เป็น key
export function toElementKey(elementTh?: string | null): ElementKey | null {
  const t = (elementTh ?? "").trim()
  if (t === "โลหะ") return "ทอง"
  return (["ไม้", "ไฟ", "ดิน", "ทอง", "น้ำ"] as ElementKey[]).includes(t as ElementKey) ? (t as ElementKey) : null
}
