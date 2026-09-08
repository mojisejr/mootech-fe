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
  lifeTimeline: { currentAge: 31, favorableElementsTh: ["ดิน", "ทอง"], cautionYears: [{ year: 2027 }, { year: 2033 }, { year: 2039 }] },
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
