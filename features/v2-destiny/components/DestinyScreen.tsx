// features/v2-destiny/components/DestinyScreen.tsx — จอ "ดวงของฉัน" (/v2/destiny).
//
// Design: Figma "Mumate app_ final" → page "ดวงฉัน" → frame node 55349-3070 (393×8028,
// FIXED + SCROLLS). Full element inventory: docs/duang-chan-spec.md. Data: POST /api/destiny
// (BFF) — birth resolved server-side from cookie-mumate-id; engine = bazi pdf-dev:
//   element-summary {dayMaster,dayGanzhi,elementTh,tagline,traits,advice}
//   life-timeline    {currentAge,favorableElementsTh,stages,current,years,cautionYears,note}
//   strength-score   {dayMaster,strengthScore,explainable}
//   domain-power     {domainPower:{career|learning|friends|wealth:{score,band}}}
//   calculate        {calculatedState:{fourPillars{year,month,day,hour},mingGong,elementAnalysis}}
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts"
import { MateAIButton } from "@/features/v2-shell/components/MateAIButton"
import { TopBarBell } from "@/features/v2-shell/components/TopBarBell"
import { TopBarAvatar } from "@/features/v2-shell/components/TopBarAvatar"

// engine `element-summary` returns advice as OBJECTS ({key,label,text}), not strings — the earlier
// `advice: string[]` typing was wrong and rendering the object as a React child crashed the whole page
// (React #31). Accept both shapes so a future string payload still renders.
type AdviceItem = string | { key?: string; label?: string; text?: string }
type ElementSummary = {
  dayMaster: string
  dayGanzhi: string
  elementTh: string
  tagline: string
  traits: string[]
  advice: AdviceItem[]
}
type LifeTimeline = {
  currentAge: number
  favorableElementsTh?: string[]
  current?: { startAge: number; endAge: number; ganzhi: string; upperState?: string; lowerState?: string }
  years?: Array<Record<string, unknown>>
  cautionYears?: Array<Record<string, unknown>>
  note?: string
}
type LifePathPoint = {
  label: string
  score: number
  stage?: string
  ageStart?: number
  ageEnd?: number
  isCurrent?: boolean
  note?: string
}
type LifePathTab = "all" | "5y" | "1y" | "1m"
type LifePath = {
  currentAge: number
  favorableElementsTh?: string[]
  series: Record<LifePathTab, LifePathPoint[]>
}
type Prediction = {
  personality: string | null
  habit: string | null
  love: string | null
  work: string | null
}
type DestinyData = {
  avatarUrl?: string | null
  prediction?: Prediction | null
  cautions?: string[] | null
  deity?: string | null
  elementSummary: ElementSummary | null
  lifeTimeline: LifeTimeline | null
  lifePath: LifePath | null
  strengthScore: { dayMaster: string; strengthScore: number } | null
  domainPower: { domainPower: Record<string, { score: number; band?: string }> } | null
  calculatedState: {
    fourPillars?: Record<string, { stem: string; branch: string }>
    mingGong?: { stem: string; branch: string }
    elementAnalysis?: {
      totalCounts?: Record<string, number>
      dominantElements?: string[]
      missingElements?: string[]
    }
  } | null
}

// ป้ายตามดีไซน์ Figma: สกิลเรียกทรัพย์ (การเงิน) · สกิลสัมพันธ์ (เพื่อน) — แถวที่สองในดีไซน์
// อ่านได้ไม่คลีย์ ("ตัวกิ๊บ") จึงยังใช้ป้าย engine ของ career/learning (ดู docs/duang-chan-spec.md)
// ป้าย 4 ด้านตาม Figma hero (node 55349:3104–3153)
const DOMAIN_TH: Record<string, string> = {
  wealth: "สกิลเรียกทรัพย์",
  career: "ตัวท็อป",
  friends: "สกัลอินฟลู",
  learning: "สกิลเรียนรู้",
}
// ไอคอน 4 ด้านจริงจาก Figma (svg export node 55349:3105/3130/3142/3154)
// career: node เดิมเป็นหัวใจ → ใช้ดาว (ตัวท็อป) ให้สื่อความหมายตรง
const DOMAIN_ICON: Record<string, string> = {
  wealth: "/images/v2/destiny/icons/wealth.svg",
  career: "/images/v2/destiny/ic-star.png",
  friends: "/images/v2/destiny/icons/friends.svg",
  learning: "/images/v2/destiny/icons/learning.svg",
}
// อาชีพเด่นตามธาตุ day-master (五行職業) — derive per-chart (เปลี่ยนตามธาตุของแต่ละคน)
// TODO(engine): matchCareer จริงพิจารณา strength/month ด้วย; ตอนนี้ใช้ธาตุ day-master
const ELEMENT_CAREERS: Record<string, string[]> = {
  wood: ["การศึกษา", "สิ่งทอ", "กระดาษ", "เฟอร์นิเจอร์", "เกษตร/ป่าไม้", "สุขภาพ", "สิ่งพิมพ์"],
  fire: ["พลังงาน", "ไฟฟ้า", "อาหาร", "ความงาม", "บันเทิง", "การตลาด", "โฆษณา"],
  earth: ["อสังหาฯ", "ก่อสร้าง", "เกษตร", "ประกันภัย", "เซรามิก", "ที่ปรึกษา", "เหมืองแร่"],
  metal: ["การเงิน", "โลหะ", "เทคโนโลยี", "ยานยนต์", "อัญมณี", "เครื่องมือแพทย์", "เครื่องจักร"],
  water: ["การค้า", "โลจิสติกส์", "ท่องเที่ยว", "สื่อสาร", "ประมง", "เครื่องดื่ม", "การเงินระหว่างประเทศ"],
}
// ลำดับแถว hero ตายตัวตาม Figma (เรียกทรัพย์ → ตัวท็อป → อินฟลู → เรียนรู้) ไม่ sort ตามคะแนน
const DOMAIN_ORDER = ["wealth", "career", "friends", "learning"]
// หยิน/หยาง จากราศีวัน (甲乙丙丁戊己庚辛壬癸) — คู่ = หยิน
const YIN_STEMS = new Set(["乙", "丁", "己", "辛", "癸"])
function polarityOf(dayMaster?: string): string {
  if (!dayMaster) return ""
  return YIN_STEMS.has(dayMaster[0]) ? "หยิน" : "หยาง"
}
// สีเกรดตาม Figma: A #2e7d32 · B #66bb6a · C+ #cddc39(อักษรเข้ม) · C- #f57c00
function gradeStyle(score: number): { grade: string; color: string; badgeText: string } {
  if (score >= 90) return { grade: "A", color: "#2e7d32", badgeText: "#ffffff" }
  if (score >= 70) return { grade: "B", color: "#66bb6a", badgeText: "#ffffff" }
  if (score >= 50) return { grade: "C+", color: "#cddc39", badgeText: "#374151" }
  return { grade: "C-", color: "#f57c00", badgeText: "#ffffff" }
}
const ELEMENT_TH: Record<string, string> = {
  wood: "ไม้",
  fire: "ไฟ",
  earth: "ดิน",
  metal: "ทอง",
  water: "น้ำ",
}
// สีพื้นกล่องธาตุตาม Figma (node 55349:3213–3237) — icon-ธาตุไม้/ไฟ/ดิน/ทอง/น้ำ
const ELEMENT_TINT: Record<string, string> = {
  wood: "#e6f4ec",
  fire: "#fbeae8",
  earth: "#f7eee1",
  metal: "#e1e1e1",
  water: "#e4f1f7",
}
// สีตัวอักษรจีน (ราศี/นักษัตร) ตามธาตุ — ให้อ่านออกบนพื้นขาว
const ELEMENT_INK: Record<string, string> = {
  wood: "#2e9e5b",
  fire: "#e5484d",
  earth: "#b8873a",
  metal: "#c99a1e",
  water: "#1f6fd6",
}
// ราศีสวรรค์ 甲乙=ไม้ 丙丁=ไฟ 戊己=ดิน 庚辛=ทอง 壬癸=น้ำ · นักษัตรดิน 寅卯=ไม้ 巳午=ไฟ 辰戌丑未=ดิน 申酉=ทอง 亥子=น้ำ
const CHAR_ELEMENT: Record<string, string> = {
  甲: "wood", 乙: "wood", 丙: "fire", 丁: "fire", 戊: "earth", 己: "earth",
  庚: "metal", 辛: "metal", 壬: "water", 癸: "water",
  寅: "wood", 卯: "wood", 巳: "fire", 午: "fire",
  辰: "earth", 戌: "earth", 丑: "earth", 未: "earth",
  申: "metal", 酉: "metal", 亥: "water", 子: "water",
}
function inkOf(ch?: string): string | undefined {
  if (!ch) return undefined
  const el = CHAR_ELEMENT[ch[0]]
  return el ? ELEMENT_INK[el] : undefined
}
// มาสคอต 5 ธาตุจาก designer (Drive "ตัวละคร 5 ธาตุ", 256px พื้นโปร่ง) — manifest ใน duang-chan-spec.md
const ELEMENT_MASCOT: Record<string, string> = {
  wood: "/images/v2/destiny/el-wood.png",
  fire: "/images/v2/destiny/el-fire.png",
  earth: "/images/v2/destiny/el-earth.png",
  metal: "/images/v2/destiny/el-metal.png",
  water: "/images/v2/destiny/el-water.png",
}
const PILLAR_LABEL: Record<string, string> = {
  year: "ปี",
  month: "เดือน",
  day: "วัน",
  hour: "เวลา",
  mingGong: "ลัคนา",
}

function gradeOf(score: number): string {
  if (score >= 90) return "A"
  if (score >= 70) return "B"
  if (score >= 50) return "C+"
  return "C"
}

const MASCOT_FALLBACK = "/images/v2/destiny/mascot-card@2x.png"
// การ์ดมาสคอตไม่มีวันว่าง: โชว์ fallback ก่อนเสมอ แล้ว preload มาสคอตจริงเบื้องหลัง
// สลับให้ก็ต่อเมื่อโหลดสำเร็จ (proxy บาง ganzhi ช้า/502 → คงเห็น fallback แทนกล่องเปล่า)
function MascotImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [shown, setShown] = useState(MASCOT_FALLBACK)
  useEffect(() => {
    if (!src) return
    let alive = true
    const img = new window.Image()
    img.onload = () => alive && setShown(src)
    img.src = src
    return () => {
      alive = false
    }
  }, [src])
  return <Image src={shown} alt={alt} width={336} height={440} unoptimized className={className} />
}

const LIFEPATH_TABS: Array<{ k: LifePathTab; label: string }> = [
  { k: "all", label: "ทั้งหมด" },
  { k: "5y", label: "5 ปี" },
  { k: "1y", label: "1 ปี" },
  { k: "1m", label: "1 เดือน" },
]

// ป้าย stage เหนือแต่ละจุด (Figma: pill ขาว ตัวอักษรน้ำเงิน #4b96e5)
function StageLabel(props: { x?: number; y?: number; index?: number; points: LifePathPoint[] }) {
  const { x, y, index, points } = props
  if (typeof x !== "number" || typeof y !== "number" || index == null) return null
  const stage = points[index]?.stage
  if (!stage) return null
  const w = Math.max(34, stage.length * 7 + 12)
  return (
    <g transform={`translate(${x}, ${y - 22})`}>
      <rect x={-w / 2} y={-10} width={w} height={18} rx={9} fill="#ffffff" stroke="#e6e1dd" />
      <text x={0} y={2} textAnchor="middle" fontSize={9} fontWeight={500} fill="#4b96e5">
        {stage}
      </text>
    </g>
  )
}

function LifePathChart({ points }: { points: LifePathPoint[] }) {
  if (points.length < 2) return null
  const current = points.find((p) => p.isCurrent)
  const innerWidth = Math.max(320, points.length * 64)
  return (
    <div className="w-full overflow-x-auto rounded-[16px] bg-[#ecf0fd] px-3 pb-2 pt-8" data-testid="destiny-life-chart">
      <div style={{ width: innerWidth, height: 224 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#d5dcef" strokeDasharray="0" vertical horizontal />
            <YAxis
              domain={[0, 125]}
              ticks={[0, 25, 50, 75, 100, 125]}
              width={34}
              tick={{ fontSize: 11, fill: "#717680" }}
              axisLine={false}
              tickLine={false}
            />
            <XAxis
              dataKey="label"
              interval={0}
              tick={{ fontSize: 10, fill: "#717680" }}
              angle={-38}
              textAnchor="end"
              height={40}
              axisLine={{ stroke: "#c9d2ea" }}
              tickLine={false}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#1455A4"
              strokeWidth={2}
              dot={{ r: 3.5, fill: "#ffffff", stroke: "#1455A4", strokeWidth: 2 }}
              activeDot={false}
              isAnimationActive={false}
              label={(p: { x?: number; y?: number; index?: number }) => (
                <StageLabel key={p.index} {...p} points={points} />
              )}
            />
            {current && typeof current.ageStart === "number" && (
              <ReferenceDot x={current.label} y={current.score} r={5} fill="#E1FF00" stroke="#1455A4" strokeWidth={2} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function LifePathCard({ lifePath }: { lifePath: LifePath }) {
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState<LifePathTab>("all")
  const points = lifePath.series?.[tab] ?? []
  const current = points.find((p) => p.isCurrent)
  return (
    <section className="rounded-[20px] bg-white p-5 v3-shadow-card" data-testid="destiny-lifepath">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-bold text-v3-navy">เส้นทางชีวิต (Life Path)</h2>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="ย่อ/ขยายเส้นทางชีวิต"
          data-testid="destiny-lifepath-toggle"
          className="text-v3-text-muted"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden style={{ transform: open ? undefined : "rotate(180deg)" }}>
            <path d="m5 12 5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {open && (
        <>
          <div className="mt-4 flex gap-1 rounded-full bg-[#f6ecf0] p-1" data-testid="destiny-lifepath-tabs">
            {LIFEPATH_TABS.map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={`flex-1 rounded-full py-2 text-[14px] font-semibold ${
                  tab === t.k ? "border border-[#e6e1dd] bg-[#e1ff00] text-v3-navy" : "text-v3-navy/80"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {points.length > 1 ? (
              <LifePathChart points={points} />
            ) : (
              <p className="py-8 text-center text-[13px] text-v3-text-muted">ยังไม่มีข้อมูลช่วงนี้</p>
            )}
          </div>

          {current && (
            <p className="mt-3 text-[13px] leading-[20px] text-v3-text-body">
              ช่วงปัจจุบัน{" "}
              <span className="font-bold text-v3-sapphire">
                {current.label}
                {current.stage ? ` · ${current.stage}` : ""}
              </span>
              {current.note ? ` — ${current.note}` : ""}
            </p>
          )}
        </>
      )}
    </section>
  )
}

// ── ธาตุสัมพันธ์ (Figma 55349:3204): บทบาทแต่ละธาตุ "คำนวนตาม day-master" (ไม่ fix) ──
// วัฏจักรเสริม (生) wood→fire→earth→metal→water→wood · วัฏจักรข่ม (克) wood→earth→water→fire→metal→wood
const GEN: Record<string, string> = { wood: "fire", fire: "earth", earth: "metal", metal: "water", water: "wood" }
const CTRL: Record<string, string> = { wood: "earth", earth: "water", water: "fire", fire: "metal", metal: "wood" }
// ความสัมพันธ์ของ other เทียบ self (day master) → ป้ายบทบาทตามหลักปาจื้อ 5 ความสัมพันธ์
//   比劫 same (ธาตุเดียวกัน) = พี่น้อง/เพื่อน/หุ้นส่วน · 食伤 output (self เสริม other) = แสดงออก/เรียน/ลงทุน
//   财 wealth (self ข่ม other) = ทรัพย์/โชคลาภ · 官杀 power (other ข่ม self) = หน้าที่การงาน/ตำแหน่ง
//   印 resource (other เสริม self) = ผู้สนับสนุน/ส่งเสริม
//   🔴 เดิมป้ายสลับกันหมด (ก็อปจากตัวอย่าง Figma ธาตุทองมาแปะผิด key) ⇒ ธาตุ丙(ไฟ) โชว์บทบาทผิดทุกช่อง
const RELATION_ROLE: Record<string, string> = {
  same: "เพื่อน/พี่น้อง/หุ้นส่วน",
  output: "เรียน/ทำงาน/ลงทุน",
  wealth: "โชคลาภ",
  power: "หน้าที่การงาน",
  resource: "ผู้สนับสนุน/ส่งเสริม",
}
function relationRole(self: string | undefined, other: string): string {
  if (!self) return ""
  if (self === other) return RELATION_ROLE.same
  if (GEN[self] === other) return RELATION_ROLE.output // self เสริม other
  if (GEN[other] === self) return RELATION_ROLE.resource // other เสริม self
  if (CTRL[self] === other) return RELATION_ROLE.wealth // self ข่ม other
  if (CTRL[other] === self) return RELATION_ROLE.power // other ข่ม self
  return ""
}
const ELEMENT_ROW_ORDER = ["wood", "metal", "fire", "earth", "water"]
// สีมงคลตามธาตุ (engine READING_COLORS) — key = ชื่อธาตุไทยจาก favorableElementsTh
const LUCKY_HEX_TH: Record<string, string> = {
  ไม้: "#388659",
  ไฟ: "#CB2C2A",
  ดิน: "#F19953",
  ทอง: "#5A5A5A",
  น้ำ: "#1455A4",
}

// หัวข้อการ์ดแบบ Figma: ชื่อ bold 18 + เส้นคั่น (+ chevron ถ้า collapsible)
function SectionHeader({
  title,
  info,
  open,
  onToggle,
}: {
  title: string
  info?: boolean
  open?: boolean
  onToggle?: () => void
}) {
  return (
    <>
      <div className="flex w-full items-center gap-2">
        <h2 className="flex-1 text-[18px] font-bold leading-6 text-v3-navy">{title}</h2>
        {info && <span className="grid h-[19px] w-[19px] place-items-center rounded-full border border-v3-sapphire text-[11px] font-bold text-v3-sapphire">i</span>}
        {onToggle && (
          <button onClick={onToggle} aria-expanded={open} aria-label="ย่อ/ขยาย" className="text-v3-text-muted">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden style={{ transform: open ? undefined : "rotate(180deg)" }}>
              <path d="m5 12 5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
      <div className="h-px w-full bg-[#f0e6dd]" />
    </>
  )
}

// engine ส่งคำทำนายมาพร้อม markdown ดิบ (**bold**) — จอนี้เป็น plain text จึงต้องถอดออก ไม่งั้นเห็น "**...**"
function stripMd(s: string | null | undefined): string {
  return (s ?? "").replace(/\*\*/g, "").replace(/__/g, "").trim()
}

// การ์ด "ทำนายพื้นฐาน" (collapsible): บุคลิก/นิสัย/ความรัก/การเรียน + อาชีพเด่น + ข้อควรระวัง
function PredictionCard({ summary, prediction, cautions, occupations }: { summary: ElementSummary; prediction?: Prediction | null; cautions?: string[] | null; occupations?: string[] }) {
  const [open, setOpen] = useState(true)
  // ใช้คำทำนายจริงจาก engine (newdata-reading chapters); ถ้าไม่มี → fallback element-summary
  const adviceText = (i: number): string => {
    const a = summary.advice?.[i]
    if (!a) return summary.tagline
    return typeof a === "string" ? a : a.text ?? summary.tagline
  }
  const blocks = [
    { title: "บุคลิกพื้นฐาน", text: prediction?.personality || summary.tagline },
    { title: "นิสัย", text: prediction?.habit || summary.traits?.join(" · ") || summary.tagline },
    { title: "ความรัก", text: prediction?.love || adviceText(0) },
    { title: "การเรียน/การทำงาน", text: prediction?.work || adviceText(1) },
  ]
  const occList = occupations && occupations.length > 0 ? occupations : ["การเงิน", "อสังหาฯ", "เทคโนโลยี"]
  // ข้อควรระวังตามดวง (ส่งมาจาก DestinyScreen: engine ก่อน แล้ว derive จากดวง); ว่าง → ข้อความกลาง
  const cautionList = cautions && cautions.length > 0 ? cautions : ["ดวงคุณไม่มีจุดที่ต้องระวังเป็นพิเศษในช่วงนี้"]
  return (
    <section className="rounded-[20px] bg-white p-5 v3-shadow-card" data-testid="destiny-prediction">
      <SectionHeader title="ทำนายพื้นฐาน" open={open} onToggle={() => setOpen((v) => !v)} />
      {open && (
        <div className="mt-4 flex flex-col gap-4">
          {blocks.map((b) => (
            <div key={b.title} className="rounded-[20px] bg-[#ecf0fd] p-[18px]">
              <p className="text-[18px] font-bold leading-6 text-v3-navy">{b.title}</p>
              <p className="mt-3 text-[14px] leading-[21px] text-[#888]">{stripMd(b.text)}</p>
            </div>
          ))}
          <div className="rounded-[20px] bg-[#ecf0fd] p-[18px]">
            <p className="text-[16px] font-bold leading-6 text-v3-navy">อาชีพเด่น</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {occList.map((o) => (
                <span key={o} className="rounded-full bg-[#66bb6a] px-[11px] py-[7px] text-[12px] leading-[18px] text-white">{o}</span>
              ))}
            </div>
          </div>
          <div className="rounded-[20px] bg-[#fbecec] p-[18px]">
            <p className="text-[16px] font-bold leading-6 text-v3-navy">ข้อควรระวัง</p>
            <ul className="mt-3 flex flex-col gap-2">
              {cautionList.map((c) => (
                <li key={c} className="flex gap-2 text-[12px] leading-[18px] text-[#a83238]">
                  <span>·</span>
                  <span className="flex-1">{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}

// การ์ด "สีมงคล สิ่งศักดิ์สิทธิ์" — 5 สี + เทพประจำวัน
function LuckyCard({ colors, deity }: { colors?: string[]; deity?: string | null }) {
  const [open, setOpen] = useState(true)
  // สีจาก favorable elements (engine); เทพจาก chapter guardian_deities — fallback ถ้าไม่มี
  const colorList = colors && colors.length > 0 ? colors : ["#fffce1", "#fdff7c", "#ece79c", "#888888", "#dedede"]
  const deityName = deity || "พระกษิติครรภ์"
  return (
    <section className="rounded-[20px] bg-white p-5 v3-shadow-card" data-testid="destiny-lucky">
      <SectionHeader title="สีมงคล สิ่งศักดิ์สิทธิ์" info open={open} onToggle={() => setOpen((v) => !v)} />
      {open && (
        <div className="mt-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[16px] leading-6 text-[#464646]">สีมงคลเฉพาะคุณ</span>
            <span className="flex items-center gap-[7px]">
              {colorList.map((c, i) => (
                <span key={i} className="h-6 w-6 rounded-full border border-[#d8d8d8]" style={{ backgroundColor: c }} />
              ))}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex-1 text-[16px] leading-6 text-[#464646]">เทพประจำวัน</span>
            <span className="text-[16px] font-bold text-v3-navy">{deityName}</span>
          </div>
        </div>
      )}
    </section>
  )
}

// การ์ด "ดูดวงด้านอื่นต่อ" — คู่รัก/เพื่อนร่วมงาน/ถามเซียนมู (แทน จองไว้ล่วงหน้าเดิม)
function MoreReadingsCard() {
  const rows = [
    { title: "ดูดวงคู่รัก", sub: "เทียบธาตุกับคนที่คุณสนใจ", href: "/v2/service", icon: "/images/v2/mascot/personas/mi/love.png", tint: "#fbecec", pad: false },
    { title: "ดูดวงเพื่อนร่วมงาน", sub: "ดูว่าทำงานกับใครแล้วรุ่ง", href: "/v2/service", icon: "/images/v2/destiny/icons/friends.svg", tint: "#eaf0fa", pad: true },
    { title: "ถามเซียนมูเรื่องนี้ต่อ", sub: "ถามลึกกว่าที่อ่านไปได้ที", href: "/v2/chat", icon: "/images/v2/mascot/personas/mu/greet.png", tint: "#eef7f0", pad: false },
  ]
  return (
    <section className="rounded-[20px] bg-white p-5 v3-shadow-card" data-testid="destiny-more">
      <h2 className="text-[18px] font-bold leading-6 text-v3-navy">ดูดวงด้านอื่นต่อ</h2>
      <div className="mt-3 flex flex-col gap-3">
        {rows.map((r) => (
          <Link key={r.title} href={r.href} className="flex items-center gap-3 rounded-[14px] border border-v3-border-card px-3 py-3">
            <span className="grid h-11 w-11 flex-none place-items-center overflow-hidden rounded-full" style={{ backgroundColor: r.tint }}>
              <Image src={r.icon} alt="" width={40} height={40} unoptimized className={r.pad ? "h-6 w-6 object-contain" : "h-9 w-9 object-contain"} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold text-v3-navy">{r.title}</span>
              <span className="block text-[12px] leading-4 text-v3-text-muted">{r.sub}</span>
            </span>
            <span className="rounded-full bg-[#fdf3e0] px-3 py-1 text-[12px] font-bold text-[#b8873a]">30 QI</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

// previewData: ใช้เฉพาะหน้า dev (/dev-access/destiny-preview) — ป้อน mock ตรงเข้าจอ
// โดยไม่แตะ fetch/guard เพื่อ iterate เทียบ Figma โดยไม่ต้องล็อกอิน
export function DestinyScreen({ previewData }: { previewData?: DestinyData } = {}) {
  const [data, setData] = useState<DestinyData | null>(previewData ?? null)
  const [loading, setLoading] = useState(!previewData)
  const [guard, setGuard] = useState<"not_authenticated" | "profile_incomplete" | null>(null)
  const [showDomains, setShowDomains] = useState(false)
  const [shareState, setShareState] = useState<"idle" | "done">("idle")

  useEffect(() => {
    if (previewData) return
    let alive = true
    ;(async () => {
      try {
        const res = await fetch("/api/destiny", { method: "POST" })
        if (res.status === 401) return setGuard("not_authenticated")
        if (res.status === 409) return setGuard("profile_incomplete")
        if (!res.ok) throw new Error(String(res.status))
        const j = (await res.json()) as DestinyData
        if (alive) setData(j)
        // อ่านดวงสำเร็จ → บันทึกภารกิจ "อ่านดวงวันนี้" (read_fortune); engine cap วันละครั้ง (period daily)
        // fire-and-forget: ไม่บล็อกจอ, ล้มก็ไม่กระทบการอ่าน
        void fetch("/api/missions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ missionId: "read_fortune" }),
        }).catch(() => {})
      } catch {
        if (alive) setGuard("profile_incomplete") // ไม่รู้สถานะ → ไม่เดาสิทธิ์ (#384 class)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const summary = data?.elementSummary ?? null
  const pillars = data?.calculatedState?.fourPillars ?? null
  const mingGong = data?.calculatedState?.mingGong ?? null
  const analysis = data?.calculatedState?.elementAnalysis ?? null
  const lifePath = data?.lifePath ?? null
  // สีมงคล = ธาตุอุปถัมภ์ (favorable) → hex ตาม engine READING_COLORS
  const favTh = lifePath?.favorableElementsTh ?? data?.lifeTimeline?.favorableElementsTh ?? []
  const luckyColors = favTh.map((n) => LUCKY_HEX_TH[n]).filter(Boolean)

  // ข้อควรระวัง "ตามดวง": ใช้ของ engine (newdata-reading) ก่อน; ไม่มี → derive จากดวงจริง
  // (ธาตุที่พร่อง + ปีที่ควรระวังจาก life-timeline) แทนข้อความ generic
  const cautionList: string[] = (() => {
    // 🔴 engine ส่ง cautions มายาวมาก + มีก้อน "ช่วงวัยจร/พยากรณ์รายปี" หลุดมาปน (ควรอยู่ใน Life Path)
    // + ติด markdown **bold** ดิบ ⇒ หน้า destiny ต้องโชว์แค่ "สรุป": แตกเป็นข้อย่อย ตัด noise ตัดความยาว จำกัดจำนวน
    const fromEngine = data?.cautions ?? []
    const NOISE = /ช่วงวัย|ยุคทอง|ยุคจร|พยากรณ์รายปี|เฝ้าระวัง อายุ|ปีปัจจุบัน|เกรด \d|พ\.ศ\.|ค\.ศ\.|→|อายุ \d/
    const clean = fromEngine
      .flatMap((c) => (typeof c === "string" ? c.split(/\s*·\s*/) : []))
      .map((s) => s.replace(/\*\*/g, "").trim())
      .filter((s) => s.length > 0 && !NOISE.test(s))
      .map((s) => (s.length > 140 ? s.slice(0, 140).replace(/\s+\S*$/, "") + "…" : s))
    if (clean.length > 0) return clean.slice(0, 4)
    const out: string[] = []
    const missing = data?.calculatedState?.elementAnalysis?.missingElements ?? []
    if (missing.length > 0) out.push(`ธาตุที่ยังพร่อง: ${missing.map((e) => ELEMENT_TH[e] ?? e).join(" · ")} — ควรเสริมให้สมดุล`)
    const cy = (data?.lifeTimeline?.cautionYears ?? [])
      .map((y) => String(y.year ?? y.age ?? ""))
      .filter(Boolean)
    if (cy.length > 0) out.push(`ปีที่ควรระวังเป็นพิเศษ: ${cy.slice(0, 6).join(" · ")}`)
    return out
  })()
  const domains = Object.entries(data?.domainPower?.domainPower ?? {})
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  // hero: เรียงตาม DOMAIN_ORDER (ตรง Figma); ⭐จุดแข็ง ไปที่ด้านคะแนนสูงสุด
  const domainByKey = Object.fromEntries(domains.map((d) => [d.key, d]))
  const heroRows = DOMAIN_ORDER.map((k) => domainByKey[k]).filter(Boolean) as typeof domains
  const topKey = heroRows.reduce(
    (best, d) => ((d.score ?? 0) > (best?.score ?? -1) ? d : best),
    heroRows[0],
  )?.key
  const mascotUrl = summary ? `/api/bazi-mascot?ganzhi=${encodeURIComponent(summary.dayGanzhi)}` : null

  const shareToday = async () => {
    const payload = {
      title: "Mumate — ดวงของฉันวันนี้",
      text: "ดูดวงของฉันด้วย Mumate",
      url: typeof window !== "undefined" ? window.location.origin : "",
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(payload)
      } catch {
        // ผู้ใช้ยกเลิกแชร์ — ไม่เป็นอะไร
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(payload.url).catch(() => {})
    }
    // #Bug3 — เคยรับ +10 QI แล้วในเซสชันนี้ ⇒ แชร์ซ้ำได้ แต่ไม่ยิง qi-earn อีก (server กันซ้ำอยู่แล้ว แต่ที่ผู้ใช้
    // เห็นว่า "กดรับได้เรื่อยๆ" คือปุ่มมันเด้งกลับเป็น "รับ +10 QI" — จึงคงสถานะ "รับแล้ว" ไว้ ไม่ revert)
    if (shareState === "done") return
    // แชร์สำเร็จ → รับ +10 QI (code "share" จาก engine catalog; capped เองถ้ารับไปแล้ว)
    try {
      await fetch("/api/qi-earn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "share" }),
      })
      setShareState("done") // ค้างเป็น "รับ +10 QI แล้ว" — เดิม revert หลัง 4 วิ ทำให้ดูเหมือนกดรับซ้ำได้
    } catch {
      // ระบบ QI ล่ม — การแชร์ยังสำเร็จอยู่
    }
  }

  return (
    <div
      className="font-ibm mx-auto min-h-[100dvh] w-full max-w-md overflow-hidden bg-white pb-10"
      style={{
        backgroundImage: "url(/images/v2/destiny/bg-top.png)",
        backgroundRepeat: "no-repeat",
        backgroundSize: "100% auto",
        backgroundPosition: "top center",
      }}
    >
      <Head>
        <title>ดวงของฉัน — Mumate</title>
      </Head>

      {/* header — ← · ดวงของฉัน (แบบ FIXED ใน Figma; bell/avatar ใช้ cluster เดิมของ /v2) */}
      <header className="flex w-full items-center gap-2 px-4 pt-4">
        <Link
          href="/v2"
          aria-label="ย้อนกลับ"
          data-testid="destiny-back"
          className="grid h-9 w-9 flex-none place-items-center rounded-full text-v3-navy hover:bg-black/5"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="flex-1 text-lg font-black leading-6 text-v3-navy">ดวงของฉัน</h1>
        {/* กระดิ่ง + รูปโปรไฟล์ (cluster เดียวกับ /v2 home) */}
        <TopBarBell variant="solid" href="/v2/calendar/notifications" />
        <TopBarAvatar variant="sapphire" href="/v2/account" pictureUrl={data?.avatarUrl ?? null} />
      </header>

      {loading && (
        <div className="px-4 pt-4" data-testid="destiny-loading">
          <div className="h-[260px] w-full animate-pulse rounded-[20px] bg-v3-sapphire/20" />
          <div className="mt-3 h-[120px] w-full animate-pulse rounded-[20px] bg-white" />
          <div className="mt-3 h-[160px] w-full animate-pulse rounded-[20px] bg-white" />
        </div>
      )}

      {!loading && guard === "not_authenticated" && (
        <div className="mx-4 mt-4 rounded-[20px] bg-white p-5 text-center v3-shadow-card" data-testid="destiny-guard-auth">
          <p className="text-sm font-bold text-v3-navy">ไม่พบข้อมูลผู้ใช้</p>
          <Link href="/v2/login" className="mt-3 grid h-11 place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
            เข้าสู่ระบบ
          </Link>
        </div>
      )}
      {!loading && guard === "profile_incomplete" && (
        <div className="mx-4 mt-4 rounded-[20px] bg-white p-5 text-center v3-shadow-card" data-testid="destiny-guard-profile">
          <p className="text-sm font-bold text-v3-navy">ข้อมูลวันเกิดยังไม่ครบ</p>
          <p className="mt-1 text-[12px] leading-4 text-v3-text-body">กรอกวัน เวลา และที่เกิดให้ครบ เพื่อให้ระบบคำนวณดวงของคุณได้</p>
          <Link href="/v2/register" className="mt-3 grid h-11 place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
            กรอกข้อมูลวันเกิด
          </Link>
        </div>
      )}

      {!loading && data && (
        <>
          {/* การ์ดน้ำเงิน (Figma promo-personal-calendar 55349:3091): การ์ดมาสคอต + avatar ริมไลม์ + ชื่อ + 4 แถบเกรด */}
          <div className="relative mx-4 mt-3">
            {/* มาสคอตธาตุลอยรอบการ์ด (ขยับด้วย .v3-float) — Figma "Group 1 mascots" */}
            {(
              [
                { el: "fire", cls: "left-0 top-2 h-11 w-11", d: "0s" },
                { el: "earth", cls: "left-1 top-24 h-8 w-8", d: ".6s" },
                { el: "water", cls: "left-6 top-40 h-7 w-7", d: "1.2s" },
                { el: "metal", cls: "left-0 top-52 h-12 w-12", d: ".9s" },
                { el: "wood", cls: "right-0 top-48 h-14 w-14", d: ".3s" },
              ] as const
            ).map((m) => (
              <span key={m.el} aria-hidden className={`v3-float pointer-events-none absolute z-10 ${m.cls}`} style={{ animationDelay: m.d }}>
                <Image src={ELEMENT_MASCOT[m.el]} alt="" width={56} height={56} unoptimized className="h-full w-full object-contain drop-shadow" />
              </span>
            ))}
          <section className="relative z-0 flex flex-col items-center gap-7 overflow-hidden rounded-[22px] bg-v3-sapphire px-4 pb-6 pt-8 text-white" data-testid="destiny-hero">
            {/* การ์ดมาสคอต (art) — avatar ผู้ใช้ซ้อนคาบล่าง */}
            <div className="flex w-full flex-col items-center">
              <span className="block h-[220px] w-[168px] overflow-hidden rounded-[16px] bg-white/10">
                <MascotImage src={mascotUrl} alt="มาสคอตประจำวันเกิด" className="h-full w-full object-cover" />
              </span>
              <span className="-mt-6 grid h-16 w-16 place-items-center overflow-hidden rounded-full border-2 border-v3-lime bg-v3-sapphire">
                <Image
                  src={data?.avatarUrl || MASCOT_FALLBACK}
                  alt="รูปโปรไฟล์"
                  width={64}
                  height={64}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              </span>
            </div>

            <div className="flex w-full flex-col items-center gap-5">
              <div className="w-full text-center">
                <p className="text-[16px] font-bold leading-6">
                  {summary ? `คุณธาตุ${summary.elementTh}${polarityOf(summary.dayMaster)}` : "ดวงของฉัน"}
                </p>
                <p className="mt-1 text-[12px] leading-[18px] text-white/90">
                  {summary?.tagline ?? "ครบทุกเรื่องที่ต้องรู้ วิเคราะห์ลึกถึงรายด้าน จบในแพ็กเกจเดียว"}
                </p>
              </div>

              <div className="flex w-full max-w-[329px] flex-col gap-2">
                {heroRows.map((d) => {
                  const score = Math.round(d.score ?? 0)
                  const g = gradeStyle(score)
                  return (
                    <div key={d.key} className="flex items-center gap-3">
                      <span className="grid h-14 w-14 flex-none place-items-center rounded-[14px] bg-[#eaf0fa] shadow-[inset_0_-2px_4px_rgba(20,85,164,0.08)]">
                        {DOMAIN_ICON[d.key] ? (
                          <span className="grid h-8 w-8 place-items-center overflow-hidden">
                            <Image src={DOMAIN_ICON[d.key]} alt="" width={32} height={32} unoptimized className="max-h-8 max-w-8 object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.12)]" />
                          </span>
                        ) : (
                          <span className="text-[24px]">✨</span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="flex-1 text-[16px] font-semibold leading-5">{DOMAIN_TH[d.key] ?? d.key}</span>
                          {d.key === topKey && (
                            <span
                              className="flex items-center gap-1 rounded-full px-2 py-[3px] text-[14px] font-semibold text-white"
                              style={{ backgroundColor: g.color }}
                            >
                              ⭐ จุดแข็ง
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-[10px] flex-1 overflow-hidden rounded-full bg-[#eaecef]">
                            <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: g.color }} />
                          </div>
                          <span className="text-[14px]" style={{ color: g.color }}>
                            {score}%
                          </span>
                          <span
                            className="grid h-6 min-w-[40px] place-items-center rounded-full px-2 text-[14px] font-bold"
                            style={{ backgroundColor: g.color, color: g.badgeText }}
                          >
                            {g.grade}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
          </div>

          {/* ป้ายปักหมุด: แชร์วันนี้รับ +10 QI + ปุ่ม Mate AI */}
          <div className="mx-4 mt-3 flex items-center gap-2" data-testid="destiny-share-pill">
            <button
              onClick={shareToday}
              data-testid="destiny-share"
              className="flex h-[56px] min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-v3-sapphire text-[13px] font-bold text-v3-lime v3-shadow-card transition active:scale-[0.99]"
            >
              <span aria-hidden className="flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-v3-lime">
                  <circle cx="18" cy="5" r="2.4" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="6" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="18" cy="19" r="2.4" stroke="currentColor" strokeWidth="1.8" />
                  <path d="m8.1 10.9 7.8-4.4M8.1 13.1l7.8 4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                {shareState === "done" ? "รับ +10 QI แล้ว 🎉" : "แชร์ผลทำนายนี้ รับ +10 QI"}
              </span>
            </button>
            {/* ปุ่ม Mate AI จริง — persona เสี่ยวมู่↔เสี่ยวมี่ วนสลับ + มาสคอต (reuse ตัวเดียวกับ nav) */}
            <span data-testid="destiny-mate-ai" className="flex-none">
              <MateAIButton />
            </span>
          </div>

          <div className="mx-4 mt-4 flex flex-col gap-4">
            {/* ดวงจะส่งผล 8 ด้าน — ชิปเสา + จุดอ่อน 4 ด้าน */}
            <section className="rounded-[20px] bg-white p-5 v3-shadow-card" data-testid="destiny-pillars">
              <h2 className="text-base font-bold text-v3-navy">ดวงจะส่งผล 8 ด้าน</h2>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {pillars
                  ? Object.entries(pillars)
                      .slice(0, 4)
                      .concat(mingGong ? [["mingGong", mingGong]] : [])
                      .map(([key, p]) => (
                        <div key={key} className="flex flex-col items-center rounded-[12px] border border-v3-border-card py-2">
                          <span className="text-[10px] text-v3-text-muted">{PILLAR_LABEL[key] ?? key}</span>
                          <span className="text-[15px] font-bold leading-5" style={{ color: inkOf(p.stem) ?? "#0b305b" }}>{p.stem}</span>
                          <span className="text-[12px] leading-4" style={{ color: inkOf(p.branch) ?? "#464646" }}>{p.branch}</span>
                        </div>
                      ))
                  : null}
              </div>
              {/* ปุ่ม + grid ธาตุ รวมเป็นกล่องเดียว (border ครอบทั้งคู่ ไม่แยกกัน) */}
              <div className="mt-3 overflow-hidden rounded-[14px] border border-v3-sapphire/25">
                <button
                  onClick={() => setShowDomains((v) => !v)}
                  data-testid="destiny-weakness-toggle"
                  className="grid h-10 w-full place-items-center text-[12px] font-medium text-v3-sapphire"
                >
                  {showDomains ? "ซ่อนจุดอ่อนของ 5 ด้าน ↑" : "โชว์จุดอ่อนของ 5 ด้าน ↓"}
                </button>
                {showDomains && summary && (
                  <div className="px-4 pb-4 pt-1" data-testid="destiny-domains">
                    <p className="text-[16px] font-bold leading-6 text-v3-navy">
                      {`ธาตุ${summary.elementTh}${polarityOf(summary.dayMaster)}`}
                    </p>
                    <p className="mt-1 text-[13px] leading-[20px] text-[#888]">{summary.tagline}</p>
                    <div className="mt-3 flex flex-col gap-3">
                      {ELEMENT_ROW_ORDER.map((el) => {
                        const dmEl = CHAR_ELEMENT[summary.dayMaster?.[0] ?? ""]
                        const count = analysis?.totalCounts?.[el]
                        return (
                          <div key={el} className="flex items-center gap-3">
                            <span className="grid h-12 w-12 flex-none place-items-center overflow-hidden rounded-[14px]" style={{ backgroundColor: ELEMENT_TINT[el] }}>
                              {ELEMENT_MASCOT[el] && <Image src={ELEMENT_MASCOT[el]} alt="" width={32} height={38} unoptimized className="h-9 w-7 object-contain" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[15px] font-bold leading-6 text-v3-navy">
                                ธาตุ{ELEMENT_TH[el]}
                                {typeof count === "number" ? <span className="ml-1 text-[13px] font-normal text-v3-text-muted">({count})</span> : null}
                              </p>
                              <p className="text-[13px] leading-5 text-[#888]">{relationRole(dmEl, el)}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ทำนายพื้นฐาน + อาชีพเด่น + ข้อควรระวัง (Figma 55349:3242) */}
            {summary && (
              <PredictionCard
                summary={summary}
                prediction={data?.prediction ?? null}
                cautions={cautionList}
                occupations={ELEMENT_CAREERS[CHAR_ELEMENT[summary.dayMaster?.[0] ?? ""] ?? ""] ?? []}
              />
            )}

            {/* สีมงคล สิ่งศักดิ์สิทธิ์ (Figma 55349:3303) */}
            <LuckyCard colors={luckyColors} deity={data?.deity ?? null} />

            {/* เส้นทางชีวิต (Life Path) — recharts + แท็บ ทั้งหมด/5ปี/1ปี/1เดือน (Figma 55349:3332) */}
            {lifePath && lifePath.series && <LifePathCard lifePath={lifePath} />}

            {/* ดูดวงด้านอื่นต่อ — คู่รัก/เพื่อนร่วมงาน/ถามเซียนมู (Figma what-next) */}
            <MoreReadingsCard />

            {/* การ์ดชวนเพื่อน — ปลายทางจริงคือจอพลังชี่ (/v2/qi) ที่มีโค้ดแนะนำคัดลอก/ใช้โค้ดครบ
                (เดิมชี้ coming-soon ทั้งที่ระบบ referral เดินจริงแล้ว) */}
            <Link
              href="/v2/qi"
              data-testid="destiny-referral"
              className="flex items-center gap-3 rounded-[20px] bg-v3-sapphire/10 p-4"
            >
              <Image src="/images/v2/qi/qi-coin.png" alt="" width={44} height={44} unoptimized className="h-11 w-11 flex-none object-contain" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-v3-sapphire">ชวนเพื่อนมารับ รับคนละ 50 QI</p>
                <p className="mt-1 text-[12px] leading-4 text-v3-text-body">เพื่อนสมัครรับฟรี คุณได้ 30 QI ใช้ซื้ออะไรก็ได้</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-v3-sapphire">
                <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

export default DestinyScreen

