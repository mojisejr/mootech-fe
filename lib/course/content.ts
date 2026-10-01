// lib/course/content.ts — คอร์สออนไลน์ของ Mumate (pure: ใช้ได้ทั้ง client/server).
// ที่มา: ชีตของฟิว/พล 2026-10-01 (docs.google.com/spreadsheets/d/1uWpmCW3cm8CYN9gBoJ-rF__KT4dkniNcuAsyXQqWBfI)
//
// Funnel (เอกสาร sale page ของพล):
//   1) Front-end  COURSE_CAL_490        ฿490  คอร์สปฏิทิน "Win the Day" + Mumate + 1 เดือน
//   2) Upsell     COURSE_MATRIX_UP_300  +฿300 (รวม 790) คอร์ส Bazi Life Matrix + Mumate + 1 ปี  — เสนอหลังจ่าย 490
//   3) Downsell   COURSE_MATRIX_199     +฿199 (รวม 689) คอร์ส Bazi Life Matrix อย่างเดียว      — เสนอเมื่อปฏิเสธ upsell
// สิทธิ์คอร์ส = เคยซื้อแพ็กที่ grants คอร์สนั้น (ตลอดชีพ) · คอร์สปฏิทินเปิดให้สมาชิกที่จ่ายเงินจริงด้วย (lib/course/access.ts)

export type CourseSlug = 'calendar' | 'life-matrix'

export type Episode = { ep: number; part: number; title: string; points: string[]; free: boolean }

export type Course = {
  slug: CourseSlug
  name: string
  tagline: string
  parts: Record<number, string>
  episodes: Episode[]
  /** สมาชิก Plus/Pro ที่จ่ายเงินจริงเรียนได้โดยไม่ต้องซื้อ */
  memberAccess: boolean
}

export const COURSE_PACKAGE_CODES = ['COURSE_CAL_490', 'COURSE_MATRIX_UP_300', 'COURSE_MATRIX_199'] as const
export type CoursePackageCode = (typeof COURSE_PACKAGE_CODES)[number]

export const COURSE_PACKAGES: Record<CoursePackageCode, { title: string; price: number; grants: CourseSlug[]; plusLabel: string | null }> = {
  COURSE_CAL_490: { title: 'Win the Day — คอร์สปฏิทิน Mumate', price: 490, grants: ['calendar'], plusLabel: '1 เดือน' },
  COURSE_MATRIX_UP_300: { title: 'คอร์ส Bazi Life Matrix + Mumate + 1 ปี', price: 300, grants: ['life-matrix'], plusLabel: '1 ปี' },
  COURSE_MATRIX_199: { title: 'คอร์ส Bazi Life Matrix', price: 199, grants: ['life-matrix'], plusLabel: null },
}

export function isCoursePackage(code: string): code is CoursePackageCode {
  return (COURSE_PACKAGE_CODES as readonly string[]).includes(code)
}

/** แพ็กที่ให้สิทธิ์คอร์สนี้ (ใช้เช็กประวัติการซื้อ) */
export function packagesGranting(slug: CourseSlug): CoursePackageCode[] {
  return COURSE_PACKAGE_CODES.filter((c) => COURSE_PACKAGES[c].grants.includes(slug))
}

export function checkoutHrefFor(code: CoursePackageCode): string {
  return `/v2/shop/checkout?package_code=${code}`
}

// ── คอร์สปฏิทิน (Win the Day) ────────────────────────────────────────────────────────────
const CAL_RAW: Omit<Episode, 'free'>[] = [
  { ep: 1, part: 1, title: 'ปฏิทิน Mumate คืออะไร? ทำไมถึงไม่เหมือนปฏิทินจีนทั่วไป', points: ['ปฏิทิน Mumate ต่างจากปฏิทินดวงจีนทั่วไปอย่างไร', 'แนะนำ Basic Mode ว่ามีอะไร ใช้ทำอะไร และเหมาะกับใคร', 'แนะนำ Advance Mode ว่ามีอะไร ใช้ทำอะไร และเหมาะกับใคร'] },
  { ep: 2, part: 2, title: 'รู้วันที่ "ใช่" ด้วยการเปิดโค้ดเกรด A-F ที่ปฏิทินซ่อนไว้', points: ['ภาพรวมของปฏิทิน ความหมายของระบบเกรด A/B/C/D/F และ Point เซ็ต หลักการคำนวณคร่าว ๆ', 'ตัวอย่างการนำไปใช้แบบพื้นฐาน'] },
  { ep: 3, part: 2, title: 'หยุดใส่สีเสื้อตามความเชื่อเดิม ๆ! สีมงคลเฉพาะคุณ และวิธีใช้ Accessory แทน', points: ['สีมงคลประจำวันที่แชร์ต่อกันมาคำนวณจากอะไร ทำไมไม่ตรงกับทุกคน', 'สีมงคลของวันนี้ช่วยอะไรกับตัวคุณจริง ๆ เลือกยังไงให้ตรงสถานการณ์', 'ถ้าไม่มีเสื้อสีมงคล ใช้ Accessory แทนได้อย่างไร'] },
  { ep: 4, part: 2, title: 'วิธีไหว้ทิศ เทพประจำวัน ให้ได้ผลตรงกับพลังงานวันนั้น', points: ['ความเชื่อเรื่องไหว้เจ้า/เดินทิศที่แชร์กันทั่วไปคำนวณจากอะไร ทำไมไม่ตรงกับทุกคน', 'เทพประจำวันคือใคร ไหว้อย่างไรให้ตรงกับพลังงานของวันนั้น', 'ทิศมงคลของวันนี้บอกอะไร วิธีใช้ให้เข้ากับกิจกรรมที่ต้องทำจริง'] },
  { ep: 5, part: 2, title: 'จับเวลาทอง! วิธีอ่านเวลามงคล พร้อมตั้งแจ้งเตือนผูก Google Calendar', points: ['ความหมายของเวลามงคล เช่น เหง็กอ่วง / เหม่งตี้ แต่ละช่วงเหมาะกับกิจกรรมอะไร', 'สอนใช้ฟีเจอร์ "เพิ่มปฏิทิน" ผูกกับ Google Calendar และตั้งแจ้งเตือน'] },
  { ep: 6, part: 2, title: 'สูตรอ่านปฏิทินฉบับเร่งด่วนใน 60 วินาที สำหรับคนเวลาน้อย', points: ['วิธีอ่านหมวด "เหมาะกับวันนี้" และ "ควรเลี่ยง" แบบรวดเร็ว — เปิดแอปตอนเช้า 1 นาทีเพื่อวางแผนวัน'] },
  { ep: 7, part: 2, title: '[Case Study] วันนี้เกรด F แต่เลื่อนนัดลูกค้าไม่ได้... ต้องทำยังไง?', points: ['ถ้าวันนี้ได้เกรด F เรื่องงาน แต่จำเป็นต้องพบลูกค้า จะรับมืออย่างไร', 'วิธีพลิกแพลง เลี่ยง และหาตัวช่วยอื่นจากข้อมูลในแอป'] },
  { ep: 8, part: 3, title: 'ใครคือ "คนอุปถัมภ์" ที่จะพาคุณไปถึงเป้าหมาย? หาตัวจริงในปฏิทิน', points: ['กุ้ยหนั้นของวันคืออะไร ใครมีแนวโน้มช่วยเหลือหรือสนับสนุนเรา และวิธีใช้งาน'] },
  { ep: 9, part: 3, title: 'เช็ก 4 มิติชีวิตในวันเดียว (งาน เงิน ความรัก การเดินทาง)', points: ['วิธีดูเกรดในแต่ละหมวดชีวิต เช่น การงาน การเดินทาง ความสัมพันธ์', 'วิธีอ่านคำทำนายรายด้าน และนำไปใช้กับชีวิตจริง'] },
  { ep: 10, part: 3, title: '8 ประตู 10 เทพ: แผนที่ลับบอกทิศทางเจรจาปิดการขาย หรือออกเดตให้ปัง', points: ['ปูพื้นฐาน: ทำความรู้จัก 8 ประตูและ 10 เทพ ความหมายของแต่ละองค์ประกอบ', 'ใช้งานจริง: เลือก "ประตู + ทิศทาง" ให้ตรงเป้าหมาย เช่น เจรจาปิดการขาย ออกเดต งานเข้าสังคม'] },
  { ep: 11, part: 3, title: 'ปรับใช้ "วันนี้มีความหมาย" กิจกรรมพิเศษ และวันมงคลพิเศษ ในชีวิตจริง', points: ['คืออะไร และปรับใช้กับงานในชีวิตจริงได้อย่างไร'] },
  { ep: 12, part: 3, title: 'ยกระดับจาก "ดูดวงทั่วไป" สู่ "ดวงเฉพาะบุคคล" ด้วยการเชื่อมโยงธาตุกำเนิด', points: ['อ่านปฏิทินรายวันร่วมกับพื้นดวงจีนของตัวเอง — พื้นดวงหน้าโปรไฟล์ และ Your Life Code', 'เชื่อมข้อมูลระยะสั้นกับโครงสร้างระยะยาว ใช้วัน ปี เวลาเพื่อเสริมจุดแข็งและอุดรอยรั่วของดวง'] },
  { ep: 13, part: 3, title: 'ภาคปฏิบัติ: เคสธุรกิจที่ใช้ปฏิทินพลิกเกมให้ได้ผล', points: ['ฝึกใช้ร่วมกับฟีเจอร์อื่น เช่น แชทเสี่ยวมู่ เบอร์มงคล', 'ประยุกต์กับการส่งข้อความสำคัญ นัดเจรจาธุรกิจ เปิดตัวโปรเจกต์ หรือเลือกฤกษ์สำคัญ', 'เล่าเคสจริง'] },
]

// ── คอร์ส Bazi Life Matrix (15 บท — ยังไม่มีคลิป; หัวข้อตามเอกสาร sale page ของพล) ─────────────────
const MATRIX_GROUPS: { from: number; to: number; title: string; desc: string }[] = [
  { from: 1, to: 3, title: 'รื้อถอนโครงสร้างตัวเอง', desc: 'เข้าใจวงจรพลังงาน 5 ธาตุในตัวคุณเพื่อหาจุดสมดุล และรู้วิธีวางแผนชีวิตแบบไม่ฝืนธรรมชาติ' },
  { from: 4, to: 6, title: 'คัมภีร์สแกนมนุษย์ & วิธีเซฟตัวเอง', desc: 'ถอดรหัสบุคลิกคน 10 แบบ และวิธีเช็กจุดปะทะ/ขัดแย้งล่วงหน้า เพื่อหลบหลีกปัญหา' },
  { from: 7, to: 10, title: 'ภาคปฏิบัติเช็กพลังดวง', desc: 'วัดระดับความแรงชะตา 12 ระยะ (เชี่ยงแซ) เช็กว่าคุณเป็นดิถีแข็ง/สมดุล หรืออ่อน เพื่อเริ่มปรับพลังงาน' },
  { from: 11, to: 12, title: 'เจาะลึกถังซำซิ่ว อาชีพ & การเงิน', desc: 'อ่านดาวการเงิน (Cai) และดาวอาชีพ (Guan/Sha) พร้อมเทคนิคเก็บเงินให้อยู่หมัด' },
  { from: 13, to: 15, title: 'ปรับ Vibe รอบตัว & แมชชิ่งขั้นเซียน', desc: 'เลือกสีมงคล/ทิศโต๊ะทำงานดันศักยภาพ, สแกนคู่แท้/หุ้นส่วนพารวย และใช้เซียมซี Advance วางกลยุทธ์ชีวิต' },
]

export const COURSES: Record<CourseSlug, Course> = {
  calendar: {
    slug: 'calendar',
    name: 'Win the Day',
    tagline: 'สูตรอ่านปฏิทินดวงจีน รู้วันดี-วันต้องระวังล่วงหน้า',
    parts: {
      1: 'เปิดโลกปฏิทินดวงจีนที่ออกแบบมาเพื่อคุณโดยเฉพาะ',
      2: 'ถอดรหัสปฏิทิน — อ่านเป็น ใช้จริงได้ทันที',
      3: 'Advance Mode — เมื่อปฏิทินกลายเป็นที่ปรึกษาส่วนตัว',
    },
    episodes: CAL_RAW.map((e) => ({ ...e, free: e.ep <= 7 })),
    memberAccess: true,
  },
  'life-matrix': {
    slug: 'life-matrix',
    name: 'Bazi Life Matrix',
    tagline: 'คัมภีร์ถอดรหัสชีวิต 15 บทเรียน — รู้จักตัวเองและคนรอบข้างอย่างถ่องแท้',
    parts: Object.fromEntries(MATRIX_GROUPS.map((g, i) => [i + 1, `บทที่ ${String(g.from).padStart(2, '0')}-${String(g.to).padStart(2, '0')} ${g.title}`])),
    episodes: MATRIX_GROUPS.flatMap((g, i) =>
      Array.from({ length: g.to - g.from + 1 }, (_, k) => ({
        ep: g.from + k,
        part: i + 1,
        title: `${g.title} (ตอนที่ ${k + 1}/${g.to - g.from + 1})`,
        points: [g.desc],
        free: false,
      })),
    ),
    memberAccess: false,
  },
}

export function isCourseSlug(s: string): s is CourseSlug {
  return s === 'calendar' || s === 'life-matrix'
}
