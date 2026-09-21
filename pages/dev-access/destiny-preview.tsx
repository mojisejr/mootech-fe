// DEV-ONLY visual harness — renders DestinyScreen with mock data so the ดวงฉัน page
// can be inspected/iterated against Figma WITHOUT login/engine. Not linked anywhere.
import { DestinyScreen } from "@/features/v2-destiny/components/DestinyScreen"

const band = (
  label: string,
  ageStart: number,
  ageEnd: number,
  score: number,
  stage: string,
  isCurrent = false,
) => ({ label, ageStart, ageEnd, score, stage, isCurrent })

const MOCK = {
  avatarUrl: "/images/v2/mascot/personas/mi/greet.png",
  prediction: {
    personality: "มั่นคง หนักแน่น มีความเป็นผู้นำโดยธรรมชาติ กล้าตัดสินใจในเรื่องสำคัญ",
    habit: "ชอบวางแผนล่วงหน้า รอบคอบ เก็บรายละเอียด และรักษาคำพูด",
    love: "จริงจังในความสัมพันธ์ ซื่อสัตย์ ต้องการความมั่นคงมากกว่าความหวือหวา",
    work: "เหมาะกับงานที่ใช้ความละเอียด ความรับผิดชอบ และการวางระบบ",
  },
  elementSummary: {
    dayMaster: "辛",
    dayGanzhi: "甲子",
    elementTh: "ทอง",
    tagline:
      "ถึงจะละเอียด รอบคอบ และคิดเยอะ แต่ขาดความมั่นใจ ตัดสินใจไม่เด็ดขาด พูดแล้วเสียงยังไม่หนักแน่นเท่าธาตุดิน",
    traits: ["ละเอียด รอบคอบ", "คิดเยอะ วางแผนเก่ง", "รักความถูกต้อง"],
    advice: [{ label: "งาน", text: "ฝึกตัดสินใจให้เด็ดขาดขึ้น" }],
  },
  lifeTimeline: {
    currentAge: 31,
    favorableElementsTh: ["ดิน", "ทอง"],
    stages: [
      { startAge: 3, endAge: 12, ganzhi: "丁卯", isCurrent: false },
      { startAge: 13, endAge: 22, ganzhi: "戊辰", isCurrent: false },
      { startAge: 23, endAge: 32, ganzhi: "己巳", isCurrent: true },
      { startAge: 33, endAge: 42, ganzhi: "庚午", isCurrent: false },
      { startAge: 43, endAge: 52, ganzhi: "辛未", isCurrent: false },
      { startAge: 53, endAge: 62, ganzhi: "壬申", isCurrent: false },
    ],
    years: Array.from({ length: 10 }, (_, i) => {
      const age = 29 + i
      const gz = ["甲辰", "乙巳", "丙午", "丁未", "戊申", "己酉", "庚戌", "辛亥", "壬子", "癸丑"][i]
      return { year: 2023 + i, age, ganzhi: gz, clash: i === 4 }
    }),
    cautionYears: [{ year: 2027 }, { year: 2033 }, { year: 2039 }],
  },
  lifePath: {
    currentAge: 31,
    favorableElementsTh: ["ดิน", "ทอง"],
    series: {
      all: [
        band("0-5", 0, 5, 20, "เริ่มใหม่"),
        band("6-10", 6, 10, 48, "สะสม"),
        band("11-15", 11, 15, 30, "ฟื้นฟู"),
        band("16-20", 16, 20, 88, "ทดลอง"),
        band("21-25", 21, 25, 78, "เก็บเกี่ยว"),
        band("26-30", 26, 30, 95, "โชว์สกิล"),
        band("31-35", 31, 35, 55, "ถดถอย", true),
        band("36-40", 36, 40, 82, "ทดลอง"),
        band("41-45", 41, 45, 90, "โชว์สกิล"),
      ],
      "5y": [
        band("0-5", 0, 5, 20, "เริ่มใหม่"),
        band("6-10", 6, 10, 48, "สะสม"),
        band("11-15", 11, 15, 30, "ฟื้นฟู"),
        band("16-20", 16, 20, 88, "ทดลอง"),
        band("21-25", 21, 25, 78, "เก็บเกี่ยว"),
        band("26-30", 26, 30, 95, "โชว์สกิล"),
        band("31-35", 31, 35, 55, "ถดถอย", true),
        band("36-40", 36, 40, 82, "ทดลอง"),
        band("41-45", 41, 45, 90, "โชว์สกิล"),
      ],
      "1y": Array.from({ length: 13 }, (_, i) => {
        const age = 27 + i
        return band(String(2021 + i), age, age, 40 + ((i * 37) % 70), i % 2 ? "สะสม" : "ทดลอง", age === 31)
      }),
      "1m": ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."].map(
        (m, i) => ({ label: m, score: 45 + ((i * 29) % 60), stage: i % 3 ? "สะสม" : "ทดลอง", isCurrent: i === 8 }),
      ),
    },
  },
  strengthScore: { dayMaster: "辛", strengthScore: 62 },
  domainPower: {
    domainPower: {
      wealth: { score: 95 },
      career: { score: 75 },
      friends: { score: 55 },
      learning: { score: 42 },
    },
  },
  calculatedState: {
    fourPillars: {
      year: { stem: "甲", branch: "戌" },
      month: { stem: "丙", branch: "寅" },
      day: { stem: "辛", branch: "丑" },
      hour: { stem: "戊", branch: "子" },
    },
    mingGong: { stem: "壬", branch: "午" },
    daYun: [
      { startAge: 3, endAge: 12, stem: "丁", branch: "卯", upperPhase: { startAge: 3, endAge: 7, symbol: "丁", source: "stem", twelveQiDisplay: "เจ๊าะ" }, lowerPhase: { startAge: 8, endAge: 12, symbol: "卯", source: "branch", twelveQiDisplay: "ตี้อ๋วง" } },
      { startAge: 13, endAge: 22, stem: "戊", branch: "辰", upperPhase: { startAge: 13, endAge: 17, symbol: "戊", source: "stem", twelveQiDisplay: "กวงตั่ว" }, lowerPhase: { startAge: 18, endAge: 22, symbol: "辰", source: "branch", twelveQiDisplay: "ซวย" } },
      { startAge: 23, endAge: 32, stem: "己", branch: "巳", isCurrent: true, upperPhase: { startAge: 23, endAge: 27, symbol: "己", source: "stem", twelveQiDisplay: "ลิ่มกัว" }, lowerPhase: { startAge: 28, endAge: 32, symbol: "巳", source: "branch", twelveQiDisplay: "ตี้อ๋วง", isCurrent: true } },
      { startAge: 33, endAge: 42, stem: "庚", branch: "午", upperPhase: { startAge: 33, endAge: 37, symbol: "庚", source: "stem", twelveQiDisplay: "เชี่ยงแซ" }, lowerPhase: { startAge: 38, endAge: 42, symbol: "午", source: "branch", twelveQiDisplay: "แป่" } },
      { startAge: 43, endAge: 52, stem: "辛", branch: "未", upperPhase: { startAge: 43, endAge: 47, symbol: "辛", source: "stem", twelveQiDisplay: "ซี่" }, lowerPhase: { startAge: 48, endAge: 52, symbol: "未", source: "branch", twelveQiDisplay: "หมกยก" } },
      { startAge: 53, endAge: 62, stem: "壬", branch: "申", upperPhase: { startAge: 53, endAge: 57, symbol: "壬", source: "stem", twelveQiDisplay: "ทอ" }, lowerPhase: { startAge: 58, endAge: 62, symbol: "申", source: "branch", twelveQiDisplay: "ลิ่มกัว" } },
    ],
    elementAnalysis: {
      totalCounts: { wood: 2, fire: 1, earth: 3, metal: 1, water: 1 },
      dominantElements: ["earth"],
      missingElements: ["fire"],
    },
  },
} as const

export default function DestinyPreviewPage() {
  return <DestinyScreen previewData={MOCK as never} />
}
