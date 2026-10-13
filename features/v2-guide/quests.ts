// features/v2-guide/quests.ts — "เส้นทางมือใหม่" ไกด์สอนเล่นแบบเกม (เอ็ม 2026-10-13)
// กด "ไปเลย" → พาไปหน้านั้น (?guide=<id>) → ไฮไลต์ปุ่มจริงทีละขั้น "กดตรงนี้" (ปุ่มพากด) → ทำครบขั้น = ผ่าน + รับ QI
// รางวัล: engine ภารกิจ guide_<id> (10 QI/ขั้น) + guide_complete (50 QI) — ตัวเลขอยู่ที่ engine lib/bazi/manifest/missions.ts

export type GuideStep = {
  /** selector ของปุ่ม/ช่องที่ให้กด — ลองตามลำดับ เจออันแรกใช้อันนั้น */
  target: string[]
  /** คำพาของมาสคอต */
  text: string
}

export type GuideQuest = {
  id: string
  /** ชื่อเควส (สั้น) */
  title: string
  /** บอกว่าเควสนี้ทำอะไร (บนการ์ดหน้าหลัก) */
  desc: string
  /** หน้าที่พาไป */
  href: string
  /** path ของหน้านั้น (ใช้เช็กว่าอยู่หน้าเควสไหม) */
  match: string[]
  /** อธิบายหน้า (โชว์ตอนหาปุ่มไม่เจอ หรือหลังทำครบ) */
  coach: string
  /** ปุ่มที่พากดทีละขั้น — กดครบ = ผ่านเควส */
  steps: GuideStep[]
}

/** รางวัลที่โชว์บนจอ (ต้องตรงกับ engine GUIDE_STEP_QI / GUIDE_COMPLETE_QI) */
export const GUIDE_STEP_QI = 10
export const GUIDE_COMPLETE_QI = 50

export const GUIDE_QUESTS: readonly GuideQuest[] = [
  {
    id: "destiny",
    title: "รู้จักดวงของฉัน",
    desc: "ดูธาตุประจำตัว จุดแข็ง-จุดอ่อน และเส้นทางชีวิต",
    href: "/v2/destiny",
    match: ["/v2/destiny"],
    coach: "นี่คือดวงของคุณ! ดูธาตุประจำตัว จุดแข็ง-จุดอ่อน 5 ด้าน กราฟเส้นทางชีวิต คำทำนายพื้นฐาน และสีมงคลได้ที่นี่",
    steps: [{ target: ['[data-testid="destiny-weakness-toggle"]'], text: "กดตรงนี้ ดูจุดแข็ง-จุดอ่อน 5 ด้านของคุณ" }],
  },
  {
    id: "calendar",
    title: "เช็กวันดีในปฏิทิน",
    desc: "ดูวันดี-วันต้องระวังของเดือนนี้",
    href: "/v2/calendar",
    match: ["/v2/calendar"],
    coach: "ปฏิทินส่วนตัวของคุณ! สีของแต่ละวันบอกว่าวันไหนดีหรือต้องระวัง แตะวันที่เพื่อดูฤกษ์ยามและสิ่งที่ควรทำ",
    steps: [{ target: ['[data-testid="calendar-day"][aria-label*="เลือกอยู่"]', '[data-testid="calendar-day"]'], text: "แตะวันที่ เพื่อดูว่าวันนั้นดีแค่ไหน ควรทำอะไร" }],
  },
  {
    id: "chat",
    title: "ถามเสี่ยวมู่ / เสี่ยวมี่",
    desc: "ถามเรื่องที่สงสัยได้ทุกเรื่อง ดวง งาน เงิน ความรัก",
    href: "/v2/chat",
    match: ["/v2/chat"],
    coach: "คุยกับเสี่ยวมู่ (ผู้ชาย) หรือเสี่ยวมี่ (ผู้หญิง) ได้เลย พิมพ์ถามเรื่องที่อยากรู้ เช่น \"เดือนนี้การเงินเป็นยังไง\"",
    steps: [{ target: ['input[placeholder*="พิมพ์ถาม"]'], text: "แตะตรงนี้ แล้วพิมพ์คำถามแรกได้เลย" }],
  },
  {
    id: "fortune",
    title: "ลองเสี่ยงเซียมซี",
    desc: "เสี่ยงทายเรื่องที่อยากรู้ในโหมดเซียน",
    href: "/v2/fortune/sage",
    match: ["/v2/fortune"],
    coach: "โหมดเซียน! ตั้งจิต พิมพ์คำถาม แล้วเสี่ยงเซียมซี จะได้คำตอบและคำแนะนำ (มีโควตาฟรีทุกวัน)",
    steps: [
      { target: ['[data-testid="sage-question"]'], text: "พิมพ์คำถามที่อยากรู้ตรงนี้" },
      { target: ['[data-testid="sage-draw"]'], text: "ตั้งจิตให้นิ่ง แล้วกดเสี่ยงทาย" },
    ],
  },
  {
    id: "compat",
    title: "ดูดวงสมพงศ์",
    desc: "เช็กความเข้ากันกับคนรักหรือเพื่อนร่วมงาน",
    href: "/v2/service/compatibility/love",
    match: ["/v2/service/compatibility"],
    coach: "ดวงสมพงศ์! เลือกคนที่จะดู แล้วดูว่าเข้ากันแค่ไหน จุดหนุน จุดปะทะ และวิธีปรับเข้าหากัน",
    steps: [{ target: ['[data-testid="compat-person2"]'], text: "แตะตรงนี้ เลือกคนที่อยากดูความเข้ากัน" }],
  },
  {
    id: "qi",
    title: "รู้จักพลังชี่ (QI)",
    desc: "เช็คอินและทำภารกิจรับ QI ไว้ใช้ฟีเจอร์พิเศษ",
    href: "/v2/qi",
    match: ["/v2/qi"],
    coach: "QI คือแต้มพลังชี่ เช็คอินทุกวัน ทำภารกิจ และชวนเพื่อนเพื่อรับ QI แล้วเอาไปแลกเปิดไพ่หรือฟีเจอร์พิเศษ",
    steps: [{ target: ['[data-testid="qi-cta-checkin"]'], text: "กดตรงนี้ เริ่มสะสมพลังชี่วันนี้" }],
  },
] as const

export const GUIDE_TOTAL = GUIDE_QUESTS.length

export const missionIdOf = (questId: string) => `guide_${questId}`

export function questForPath(pathname: string): GuideQuest | undefined {
  return GUIDE_QUESTS.find((q) => q.match.some((m) => pathname === m || pathname.startsWith(`${m}/`)))
}
