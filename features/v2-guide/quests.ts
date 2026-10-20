// features/v2-guide/quests.ts — "เส้นทางมือใหม่" ไกด์สอนเล่นแบบเกม 6 บท (เอ็ม 2026-10-13 "ทำเลยตามที่เสนอ")
// กด "ไปเลย" → พาไปหน้านั้น (?guide=<id>) → ไฮไลต์ปุ่มจริงทีละขั้น "กดตรงนี้" (ปุ่มพากด) → ทำครบขั้น = ผ่าน + รับ QI
// บทปลดล็อกทีละบท (ทำบทก่อนหน้าครบก่อน) · จบบท = ปุ่มรับโบนัสบท · จบทุกบท = รับรางวัลใหญ่ + ป้าย "ศิษย์เอกเสี่ยวมู่"
// รางวัล: engine ภารกิจ guide_<id> / guide_ch<n> / guide_complete — ⚠️ id + โครงบทต้องตรงกับ engine lib/bazi/manifest/missions.ts

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
  /** path ของหน้านั้น — exact = ต้องตรงทั้ง path (ไม่รวมหน้าลูก) */
  match: string[]
  exact?: boolean
  /** อธิบายหน้า (โชว์ตอนหาปุ่มไม่เจอ หรือหลังทำครบ) */
  coach: string
  /** ปุ่มที่พากดทีละขั้น — กดครบ = ผ่านเควส */
  steps: GuideStep[]
}

export type GuideChapter = { id: string; title: string; subtitle: string; quests: GuideQuest[] }

/** รางวัลที่โชว์บนจอ (ต้องตรงกับ engine GUIDE_STEP_QI / GUIDE_CHAPTER_QI / GUIDE_COMPLETE_QI) */
export const GUIDE_STEP_QI = 1 // เอ็ม 2026-10-20: รางวัลไกด์เยอะเกิน → รวม ~305 เหลือ ~55 (เดิม 5/20/50)
export const GUIDE_CHAPTER_QI = 3
export const GUIDE_COMPLETE_QI = 10
export const GUIDE_BADGE = "ศิษย์เอกเสี่ยวมู่"

const tid = (id: string) => `[data-testid="${id}"]`

export const GUIDE_CHAPTERS: readonly GuideChapter[] = [
  {
    id: "ch1",
    title: "มือใหม่",
    subtitle: "ฟังก์ชันหลักที่ใช้ทุกวัน",
    quests: [
      {
        id: "destiny",
        title: "รู้จักดวงของฉัน",
        desc: "ดูธาตุประจำตัว จุดแข็ง-จุดอ่อน และเส้นทางชีวิต",
        href: "/v2/destiny",
        match: ["/v2/destiny"],
        coach: "นี่คือดวงของคุณ! ดูธาตุประจำตัว จุดแข็ง-จุดอ่อน 5 ด้าน กราฟเส้นทางชีวิต คำทำนายพื้นฐาน และสีมงคลได้ที่นี่",
        steps: [{ target: [tid("destiny-weakness-toggle")], text: "กดตรงนี้ ดูจุดแข็ง-จุดอ่อน 5 ด้านของคุณ" }],
      },
      {
        id: "calendar",
        title: "เช็กวันดีในปฏิทิน",
        desc: "ดูวันดี-วันต้องระวังของเดือนนี้",
        href: "/v2/calendar",
        match: ["/v2/calendar"],
        coach: "ปฏิทินส่วนตัวของคุณ! สีของแต่ละวันบอกว่าวันไหนดีหรือต้องระวัง แตะวันที่เพื่อดูฤกษ์ยามและสิ่งที่ควรทำ",
        steps: [{ target: [`${tid("calendar-day")}[aria-label*="เลือกอยู่"]`, tid("calendar-day")], text: "แตะวันที่ เพื่อดูว่าวันนั้นดีแค่ไหน ควรทำอะไร" }],
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
        match: ["/v2/fortune/sage"],
        coach: "เซียมซี! ตั้งจิต พิมพ์คำถาม แล้วเสี่ยงทาย จะได้คำตอบและคำแนะนำ (มีโควตาฟรีทุกวัน)",
        steps: [
          { target: [tid("sage-question")], text: "พิมพ์คำถามที่อยากรู้ตรงนี้" },
          { target: [tid("sage-draw")], text: "ตั้งจิตให้นิ่ง แล้วกดเสี่ยงทาย" },
        ],
      },
      {
        id: "compat",
        title: "ดูดวงสมพงศ์",
        desc: "เช็กความเข้ากันกับคนรัก",
        href: "/v2/service/compatibility/love",
        match: ["/v2/service/compatibility/love"],
        coach: "ดวงสมพงศ์! เลือกคนที่จะดู แล้วดูว่าเข้ากันแค่ไหน จุดหนุน จุดปะทะ และวิธีปรับเข้าหากัน",
        steps: [{ target: [tid("compat-person2")], text: "แตะตรงนี้ เลือกคนที่อยากดูความเข้ากัน" }],
      },
      {
        id: "qi",
        title: "รู้จักพลังชี่ (QI)",
        desc: "เช็คอินรับ QI ไว้ใช้ฟีเจอร์พิเศษ",
        href: "/v2/qi",
        match: ["/v2/qi"],
        exact: true,
        coach: "QI คือแต้มพลังชี่ เช็คอินทุกวัน ทำภารกิจ และชวนเพื่อนเพื่อรับ QI แล้วเอาไปแลกเปิดไพ่หรือฟีเจอร์พิเศษ",
        steps: [{ target: [tid("qi-cta-checkin")], text: "กดตรงนี้ เริ่มสะสมพลังชี่วันนี้" }],
      },
    ],
  },
  {
    id: "ch2",
    title: "รู้จักตัวเองลึกขึ้น",
    subtitle: "ดวงรายวัน เส้นทางชีวิต ธาตุแท้",
    quests: [
      {
        id: "lifepath",
        title: "เส้นทางชีวิต",
        desc: "ดูกราฟขึ้น-ลงของชีวิตทีละช่วง",
        href: "/v2/destiny",
        match: ["/v2/destiny"],
        coach: "เส้นทางชีวิต (Life Path) บอกจังหวะขึ้น-ลงของชีวิต สลับดูได้ทั้งหมด / 5 ปี / 1 ปี / 1 เดือน กดปุ่ม i เพื่อดูความหมายแต่ละช่วง",
        steps: [{ target: [`${tid("destiny-lifepath-tabs")} button`, tid("destiny-lifepath")], text: "แตะแท็บช่วงเวลา ดูกราฟเส้นทางชีวิตของคุณ" }],
      },
      {
        id: "home_fortune",
        title: "ดวงวันนี้",
        desc: "เช็กดวงประจำวันที่หน้าหลักทุกเช้า",
        href: "/v2",
        match: ["/v2"],
        exact: true,
        coach: "การ์ดดวงวันนี้อยู่บนสุดของหน้าหลัก บอกคะแนนวันนี้ สิ่งที่เหมาะ และสิ่งที่ควรเลี่ยง เปิดดูทุกเช้านะ",
        steps: [{ target: [tid("home-fortune")], text: "นี่คือดวงวันนี้ของคุณ แตะเพื่อดูรายละเอียด" }],
      },
      {
        id: "element_finder",
        title: "หาธาตุแท้ + wallpaper",
        desc: "รู้ธาตุแท้จากวันเกิด พร้อม wallpaper เสริมดวง",
        href: "/v2/element-finder",
        match: ["/v2/element-finder"],
        coach: "มาหาธาตุแท้! ใส่วันเกิด แล้วรับนิสัยตามธาตุ พร้อม wallpaper ไว้ตั้งหน้าจอเสริมดวง แชร์ให้เพื่อนเล่นได้ด้วย",
        steps: [
          { target: [tid("finder-input"), tid("finder-date")], text: "ใส่วันเกิดตรงนี้" },
          { target: [tid("finder-submit"), tid("finder-cta")], text: "แล้วกดหาธาตุแท้ของคุณ" },
        ],
      },
      {
        id: "notif",
        title: "ตั้งค่าแจ้งเตือนดวง",
        desc: "รับแจ้งเตือนดวงรายวันไม่พลาด",
        href: "/v2/settings/notifications",
        match: ["/v2/settings/notifications"],
        coach: "เปิดแจ้งเตือนไว้ จะได้รับดวงรายวันและการเตือนวันสำคัญ ไม่พลาดวันดี",
        steps: [{ target: [tid("notif-master-toggle"), tid("notif-master")], text: "เปิดแจ้งเตือนตรงนี้" }],
      },
    ],
  },
  {
    id: "ch3",
    title: "โหมดเซียน",
    subtitle: "ไพ่ทำนายและดวงคนรอบตัว",
    quests: [
      {
        id: "oracle",
        title: "ไพ่ออราเคิลเคี้ยงคุง",
        desc: "เปิดไพ่ 3 ใบ ถามเรื่องทั่วไป",
        href: "/v2/fortune/oracle",
        match: ["/v2/fortune/oracle"],
        coach: "ไพ่ออราเคิลเคี้ยงคุง ถามได้ทุกเรื่อง เปิด 3 ใบ ใบแรกน้ำหนักมากสุด แล้วอ่านสรุปคำทำนาย",
        steps: [
          { target: [tid("cards-question")], text: "พิมพ์คำถามที่อยากรู้ตรงนี้" },
          { target: [tid("cards-random")], text: "แล้วกดเพื่อเสี่ยงทาย" },
        ],
      },
      {
        id: "divine",
        title: "ไพ่จิตวิญญาณแดนสวรรค์",
        desc: "เปิดไพ่เทพ ถามเรื่องคนและวิธีแก้ปัญหา",
        href: "/v2/fortune/divine",
        match: ["/v2/fortune/divine"],
        coach: "ไพ่จิตวิญญาณแดนสวรรค์ เหมาะถามเรื่องคน นิสัย และวิธีแก้ปัญหา เทพแต่ละองค์จะชี้แนะด้านดีให้",
        steps: [
          { target: [tid("cards-question")], text: "พิมพ์คำถามที่อยากรู้ตรงนี้" },
          { target: [tid("cards-random")], text: "แล้วกดเพื่อเสี่ยงทาย" },
        ],
      },
      {
        id: "colleague",
        title: "ดวงเพื่อนร่วมงาน",
        desc: "เช็กความเข้ากันกับเพื่อนร่วมงาน",
        href: "/v2/service/compatibility/colleague",
        match: ["/v2/service/compatibility/colleague"],
        coach: "ดวงเพื่อนร่วมงาน! เทียบได้หลายคน ดูว่าใครทำงานด้วยแล้วหนุน ใครต้องระวัง",
        steps: [{ target: [tid("compat-candidate-0"), tid("compat-person2")], text: "แตะตรงนี้ เลือกเพื่อนร่วมงานคนแรก" }],
      },
      {
        id: "chat_place",
        title: "ถามแชทเรื่องสถานที่",
        desc: "ให้เสี่ยวมู่ตรวจฮวงจุ้ยบ้าน ห้อง ร้าน",
        href: "/v2/chat",
        match: ["/v2/chat"],
        coach: "ถามเรื่องสถานที่ได้เลย เช่น \"ห้องนอนฉันหันทิศตะวันตก ดีไหม\" เสี่ยวมู่จะตรวจฮวงจุ้ยและบอกวิธีแก้",
        steps: [{ target: ['input[placeholder*="พิมพ์ถาม"]'], text: "ลองถามเรื่องบ้าน ห้อง หรือร้านของคุณตรงนี้" }],
      },
    ],
  },
  {
    id: "ch4",
    title: "เสริมดวง",
    subtitle: "ตั้งเป้า ไหว้ขอพร เลขมงคล",
    quests: [
      {
        id: "manifest",
        title: "สมุดแมนิเฟสต์",
        desc: "เขียนความปรารถนาแล้วทำภารกิจตามธาตุ",
        href: "/v2/service/manifest",
        match: ["/v2/service/manifest"],
        coach: "สมุดแมนิเฟสต์! เขียนความปรารถนาเป็นประโยคที่เกิดขึ้นแล้ว ใส่รูป แล้วเช็กอินทุกวันให้พลังส่งถึง",
        steps: [{ target: [tid("manifest-add"), tid("manifest-add-bottom")], text: "กดเพิ่มความปรารถนาแรกของคุณ" }],
      },
      {
        id: "sacred_map",
        title: "แผนที่ศักดิ์สิทธิ์",
        desc: "หาที่ไหว้ขอพรที่เหมาะกับดวง",
        href: "/v2/service/sacred-map",
        match: ["/v2/service/sacred-map"],
        coach: "แผนที่ศักดิ์สิทธิ์ รวมสถานที่ไหว้ขอพรทั่วไทย กรองตามเรื่องที่อยากขอ แล้วบันทึกที่อยากไปได้",
        steps: [{ target: [tid("sacred-map-item"), tid("sacred-map-list")], text: "แตะดูสถานที่ศักดิ์สิทธิ์ตรงนี้" }],
      },
      {
        id: "phone",
        title: "ดูดวงเบอร์มือถือ",
        desc: "ถอดพลังตัวเลขในเบอร์ของคุณ",
        href: "/v2/service/phone-number",
        match: ["/v2/service/phone-number"],
        coach: "ดูดวงเบอร์มือถือ! ใส่เบอร์ แล้วดูว่าตัวเลขเสริมเงิน งาน หรือความรักแค่ไหน สลับโหมดรังผึ้งได้ด้วย",
        steps: [{ target: [tid("phone-input")], text: "ใส่เบอร์มือถือตรงนี้" }],
      },
      {
        id: "special_day",
        title: "วันมงคลในปฏิทิน",
        desc: "เปิดดูวันที่ เจอวันความรัก/วันลาภสวรรค์ แตะดูคำขอพร",
        href: "/v2/calendar",
        match: ["/v2/calendar"],
        coach: "ในปฏิทินมีวันพิเศษ เช่น วันความรัก (เฒ่าจันทรา) และวันลาภสวรรค์ (ไฉ่ซิ้งเอี้ย) แตะเพื่อดูคำขอพร ที่ไหว้ และทิศมงคล",
        steps: [{ target: [tid("special-day-open"), tid("calendar-day")], text: "แตะวันที่ แล้วเลื่อนดูหัวข้อวันพิเศษ (มีคำขอพรและที่ไหว้)" }],
      },
    ],
  },
  {
    id: "ch5",
    title: "ชุมชนและรางวัล",
    subtitle: "แชร์ ชวนเพื่อน รับ QI",
    quests: [
      {
        id: "share",
        title: "แชร์ผลทำนาย",
        desc: "แชร์ดวงให้เพื่อน รับ QI เพิ่ม",
        href: "/v2/destiny",
        match: ["/v2/destiny"],
        coach: "แชร์ผลทำนายให้เพื่อนได้ทุกหน้า ลิงก์มีโค้ดเชิญของคุณ เพื่อนสมัครคุณก็ได้ QI",
        steps: [{ target: [tid("destiny-share"), tid("destiny-share-pill")], text: "กดแชร์ผลทำนายนี้ รับ QI เพิ่ม" }],
      },
      {
        id: "referral",
        title: "ชวนเพื่อนด้วยโค้ดเชิญ",
        desc: "เพื่อนสมัคร คุณได้ QI",
        href: "/v2/qi/referral",
        match: ["/v2/qi/referral"],
        coach: "นี่คือโค้ดเชิญของคุณ ส่งให้เพื่อน เพื่อนสมัครแล้วกรอกโค้ด ได้ QI ทั้งคู่",
        steps: [{ target: [tid("referral-code"), tid("referral-hero")], text: "นี่คือโค้ดเชิญของคุณ แตะเพื่อคัดลอกส่งให้เพื่อน" }],
      },
      {
        id: "missions",
        title: "ภารกิจรายวัน",
        desc: "ทำทุกวัน สะสม QI",
        href: "/v2/qi/missions",
        match: ["/v2/qi/missions"],
        coach: "ภารกิจรายวันรีเซ็ตทุกเที่ยงคืน ทำทุกวันจะมี QI สะสมไว้เปิดไพ่และใช้ฟีเจอร์พิเศษ",
        steps: [{ target: [tid("missions-hero"), tid("missions-balance")], text: "ดูภารกิจรายวันของคุณตรงนี้" }],
      },
      {
        id: "connect_line",
        title: "เชื่อมบัญชี LINE",
        desc: "รับดวงรายวันทาง LINE",
        href: "/v2/settings/connected",
        match: ["/v2/settings/connected"],
        coach: "เชื่อมบัญชี LINE ไว้ ล็อกอินง่าย และรับแจ้งเตือนดวงทาง LINE ได้",
        steps: [{ target: [tid("connected-current"), tid("connected-name")], text: "ดูบัญชีที่เชื่อมอยู่ตรงนี้" }],
      },
    ],
  },
  {
    id: "ch6",
    title: "บริการพิเศษ",
    subtitle: "เจาะลึกกับซินแสตัวจริง",
    quests: [
      {
        id: "one_book",
        title: "หนังสือเล่มเดียวในโลก",
        desc: "ดวงชะตาเชิงลึกเป็นหนังสือส่วนตัว",
        href: "/v2/service/one-book",
        match: ["/v2/service/one-book"],
        coach: "หนังสือเล่มเดียวในโลก รวบรวมดวงชะตาเชิงลึกของคุณเป็นเล่ม ดูได้ว่ามีหัวข้ออะไรบ้าง",
        steps: [{ target: [tid("one-book-topics"), tid("one-book-hero")], text: "ดูว่าในหนังสือมีหัวข้ออะไรบ้าง" }],
      },
      {
        id: "sinsae",
        title: "ดูดวงส่วนตัวกับซินแส",
        desc: "จองดูดวงกับซินแสตัวจริง",
        href: "/v2/service/sinsae",
        match: ["/v2/service/sinsae"],
        coach: "อยากคุยเจาะลึกกับซินแสตัวจริง จองได้ที่นี่ เลือกแพ็กที่เหมาะกับเรื่องที่อยากรู้",
        steps: [{ target: [tid("sinsae-tiers"), tid("sinsae-hero")], text: "ดูแพ็กดูดวงกับซินแสตรงนี้" }],
      },
      {
        id: "shop",
        title: "แพ็กเกจสมาชิก",
        desc: "ปลดล็อกฟีเจอร์ได้มากขึ้น",
        href: "/v2/shop",
        match: ["/v2/shop"],
        exact: true,
        coach: "สมาชิก PLUS / PRO ใช้แชท เปิดไพ่ และฟีเจอร์พิเศษได้มากขึ้น ดูว่าแพ็กไหนเหมาะกับคุณ",
        steps: [{ target: [tid("shop-plan-list")], text: "ดูแพ็กเกจสมาชิกตรงนี้" }],
      },
    ],
  },
]

export const GUIDE_QUESTS: readonly GuideQuest[] = GUIDE_CHAPTERS.flatMap((c) => c.quests)
export const GUIDE_TOTAL = GUIDE_QUESTS.length

export const missionIdOf = (questId: string) => `guide_${questId}`
export const chapterBonusId = (chapterId: string) => `guide_${chapterId}`

export function pathMatches(q: GuideQuest, pathname: string): boolean {
  return q.match.some((m) => pathname === m || (!q.exact && pathname.startsWith(`${m}/`)))
}

/** เควสแรกที่ path นี้อยู่ (ใช้ทั่วไป — ไกด์จริงเลือกตาม ?guide=<id>) */
export function questForPath(pathname: string): GuideQuest | undefined {
  return GUIDE_QUESTS.find((q) => pathMatches(q, pathname))
}

export function chapterOf(questId: string): GuideChapter | undefined {
  return GUIDE_CHAPTERS.find((c) => c.quests.some((q) => q.id === questId))
}
