// features/v2-service/components/SacredMapScreen.tsx — /v2/service/sacred-map (แผนที่ศักดิ์สิทธิ์)
// ไม่มีเฟรม Figma → ออกแบบเอง: "ทิศ & สีมงคลเฉพาะบุคคล" อิงธาตุประจำตัว (day-master element) ของผู้ใช้
// ใช้ความสัมพันธ์เบญจธาตุ (เสริม=มารดาธาตุ · เลี่ยง=ธาตุที่พิฆาต) + ผังบากว้า 8 ทิศ.
import Head from "next/head"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

import { SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { normalizeElement, type NormalizedElement } from "@/lib/personalization"

type ElementEn = NormalizedElement["en"] // WOOD | FIRE | EARTH | METAL | WATER

const DIR_TH: Record<string, string> = {
  N: "เหนือ", NE: "ตะวันออกเฉียงเหนือ", E: "ตะวันออก", SE: "ตะวันออกเฉียงใต้",
  S: "ใต้", SW: "ตะวันตกเฉียงใต้", W: "ตะวันตก", NW: "ตะวันตกเฉียงเหนือ",
}
const DIR_ORDER = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const

type Swatch = { name: string; hex: string }

type ElementInfo = {
  labelTh: string
  glyph: string
  tone: string // tailwind bg+text for the element badge
  dirs: string[] // ทิศเสริมพลัง (ธาตุตัวเอง)
  support: { el: string; dirs: string[] } // ทิศเสริมดวง (มารดาธาตุ)
  avoid: { el: string; dirs: string[] } // ทิศควรเลี่ยง (ธาตุที่พิฆาต)
  lucky: Swatch[] // สีมงคล
  boost: Swatch[] // สีเสริม (จากมารดาธาตุ)
  avoidColors: Swatch[] // สีที่ควรเลี่ยง
  note: string
}

const C = {
  green: { name: "เขียว", hex: "#4E9A4A" }, teal: { name: "เขียวมิ้นต์", hex: "#2FA79B" },
  red: { name: "แดง", hex: "#E23E3E" }, orange: { name: "ส้ม", hex: "#FF7A1A" }, pink: { name: "ชมพู", hex: "#EC5C8E" },
  yellow: { name: "เหลือง", hex: "#F4C430" }, brown: { name: "น้ำตาล", hex: "#9B6A3A" },
  white: { name: "ขาว", hex: "#F1F2F4" }, gold: { name: "ทอง", hex: "#D4AF37" }, silver: { name: "เงิน", hex: "#C0C4CC" },
  black: { name: "ดำ", hex: "#2B2B2B" }, navy: { name: "กรมท่า", hex: "#1E3A8A" }, blue: { name: "น้ำเงิน", hex: "#2F6FB0" },
}

const ELEMENTS: Record<ElementEn, ElementInfo> = {
  WOOD: {
    labelTh: "ธาตุไม้", glyph: "🌳", tone: "bg-[#EAF7EA] text-[#3E7E3A]",
    dirs: ["E", "SE"], support: { el: "ธาตุน้ำ", dirs: ["N"] }, avoid: { el: "ธาตุทอง", dirs: ["W", "NW"] },
    lucky: [C.green, C.teal], boost: [C.blue, C.black], avoidColors: [C.white, C.silver],
    note: "ธาตุไม้เติบโตด้วยน้ำ — ทิศ/สีโทนน้ำช่วยหล่อเลี้ยงพลังของคุณ เลี่ยงโทนโลหะที่บั่นทอน",
  },
  FIRE: {
    labelTh: "ธาตุไฟ", glyph: "🔥", tone: "bg-[#FFF0EA] text-[#C7481F]",
    dirs: ["S"], support: { el: "ธาตุไม้", dirs: ["E", "SE"] }, avoid: { el: "ธาตุน้ำ", dirs: ["N"] },
    lucky: [C.red, C.orange, C.pink], boost: [C.green], avoidColors: [C.black, C.navy],
    note: "ธาตุไฟลุกโชนด้วยไม้ — โทนแดง/ส้มเสริมพลัง เลี่ยงโทนน้ำที่ดับไฟ",
  },
  EARTH: {
    labelTh: "ธาตุดิน", glyph: "⛰️", tone: "bg-[#FBF3DE] text-[#9A7527]",
    dirs: ["NE", "SW"], support: { el: "ธาตุไฟ", dirs: ["S"] }, avoid: { el: "ธาตุไม้", dirs: ["E", "SE"] },
    lucky: [C.yellow, C.brown], boost: [C.red, C.orange], avoidColors: [C.green, C.teal],
    note: "ธาตุดินหนักแน่นด้วยไฟ — โทนเหลือง/น้ำตาลเสริมความมั่นคง เลี่ยงโทนไม้ที่ชอนไช",
  },
  METAL: {
    labelTh: "ธาตุทอง", glyph: "⚙️", tone: "bg-[#F3F4F6] text-[#6B7280]",
    dirs: ["W", "NW"], support: { el: "ธาตุดิน", dirs: ["NE", "SW"] }, avoid: { el: "ธาตุไฟ", dirs: ["S"] },
    lucky: [C.white, C.gold, C.silver], boost: [C.yellow, C.brown], avoidColors: [C.red, C.pink],
    note: "ธาตุทองก่อเกิดจากดิน — โทนขาว/ทอง/เงินเสริมบารมี เลี่ยงโทนไฟที่หลอมละลาย",
  },
  WATER: {
    labelTh: "ธาตุน้ำ", glyph: "💧", tone: "bg-[#EAF3FF] text-[#2456A6]",
    dirs: ["N"], support: { el: "ธาตุทอง", dirs: ["W", "NW"] }, avoid: { el: "ธาตุดิน", dirs: ["NE", "SW"] },
    lucky: [C.black, C.navy, C.blue], boost: [C.white, C.silver], avoidColors: [C.yellow, C.brown],
    note: "ธาตุน้ำไหลลื่นเมื่อมีโลหะหนุน — โทนน้ำเงิน/ดำเสริมปัญญา เลี่ยงโทนดินที่กั้นการไหล",
  },
}

/** ผังบากว้า 8 ทิศ — พื้นที่ชีวิตตามทิศ (ใช้จัดวางของ/นั่งทำงานตามเป้าหมาย) */
const BAGUA: Array<{ dir: string; area: string; tip: string }> = [
  { dir: "N", area: "การงาน & อาชีพ", tip: "นั่งทำงานหันหน้าไปทางนี้เพื่อความก้าวหน้า" },
  { dir: "SE", area: "ทรัพย์ & การเงิน", tip: "วางของมงคล/ต้นไม้เงินไว้มุมนี้ของบ้าน" },
  { dir: "SW", area: "ความรัก & คู่ครอง", tip: "ตกแต่งเป็นคู่ (โคมไฟ/รูป) เสริมความสัมพันธ์" },
  { dir: "E", area: "สุขภาพ & ครอบครัว", tip: "ให้อากาศถ่ายเท แสงเข้าถึง เสริมพลังชีวิต" },
]

function SacredCompass({ info }: { info: ElementInfo }) {
  const cx = 130, cy = 130, r = 96
  const lucky = new Set(info.dirs)
  const support = new Set(info.support.dirs)
  const avoid = new Set(info.avoid.dirs)
  const angleOf = (d: string) => (DIR_ORDER.indexOf(d as (typeof DIR_ORDER)[number]) * 45 - 90) * (Math.PI / 180)
  return (
    <svg viewBox="0 0 260 260" className="mx-auto w-full max-w-[260px]" role="img" aria-label="เข็มทิศมงคล">
      <circle cx={cx} cy={cy} r={r + 18} fill="#F7FAFF" />
      <circle cx={cx} cy={cy} r={r + 18} fill="none" stroke="#DCE6F5" strokeWidth="1.5" />
      {/* เส้นแกน */}
      {[0, 45, 90, 135].map((deg) => {
        const a = (deg - 90) * (Math.PI / 180)
        return <line key={deg} x1={cx - Math.cos(a) * r} y1={cy - Math.sin(a) * r} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} stroke="#EBF1FA" strokeWidth="1" />
      })}
      {DIR_ORDER.map((d) => {
        const a = angleOf(d)
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r
        const isLucky = lucky.has(d), isSupport = support.has(d), isAvoid = avoid.has(d)
        const fill = isLucky ? "#3E9B4A" : isSupport ? "#2F6FB0" : isAvoid ? "#E23E3E" : "#CBD5E1"
        const rad = isLucky ? 15 : isSupport ? 13 : 11
        return (
          <g key={d}>
            <circle cx={x} cy={y} r={rad} fill={fill} opacity={isLucky || isSupport || isAvoid ? 1 : 0.5} />
            <text x={x} y={y + 4} textAnchor="middle" fontSize={d.length > 1 ? 8 : 11} fontWeight="700" fill="#fff">{d}</text>
          </g>
        )
      })}
      {/* ธาตุตรงกลาง */}
      <circle cx={cx} cy={cy} r={34} fill="#fff" stroke="#E2E8F0" strokeWidth="1.5" />
      <text x={cx} y={cy + 2} textAnchor="middle" fontSize="26">{info.glyph}</text>
      <text x={cx} y={cy + 24} textAnchor="middle" fontSize="11" fontWeight="800" fill="#1A264D">{info.labelTh}</text>
    </svg>
  )
}

function ColorRow({ label, list, muted }: { label: string; list: Swatch[]; muted?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 flex-none text-[13px] font-bold text-v3-navy">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {list.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span className={"inline-block size-5 rounded-full border " + (muted ? "opacity-60 " : "") + "border-black/10"} style={{ background: s.hex }} />
            <span className={"text-[12px] " + (muted ? "text-v3-text-muted line-through" : "text-v3-text-body")}>{s.name}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

const CARD = "v3-shadow-card w-full rounded-[24px] bg-white p-5"

export function SacredMapScreen() {
  const [loading, setLoading] = useState(true)
  const [birthDate, setBirthDate] = useState<string | null>(null)
  const [elementTh, setElementTh] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = await fetch("/api/profile").then((x) => (x.ok ? x.json() : null)).catch(() => null)
      const bd: string | null = p?.profile?.birthDate ?? null
      setBirthDate(bd)
      if (bd) {
        const j = await fetch("/api/bazi/element-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ person: { birthDate: bd, birthTime: p?.profile?.birthTime ?? undefined } }),
        }).then((x) => (x.ok ? x.json() : null)).catch(() => null)
        setElementTh(j?.summary?.elementTh ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const info = useMemo(() => {
    const norm = normalizeElement(elementTh)
    return norm ? ELEMENTS[norm.en] : null
  }, [elementTh])

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-v3-bg-cream font-ibm">
      <SkyBackdrop height={480} />
      <Head><title>แผนที่ศักดิ์สิทธิ์ · ทิศ & สีมงคลของคุณ · MuMate</title></Head>
      <SkyHeader title="แผนที่ศักดิ์สิทธิ์" backHref="/v2/service" testId="sacred-map" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-40 pt-2">
        {loading ? (
          <div className="mt-10 h-40 w-full animate-pulse rounded-[24px] bg-v3-ghost-white" data-testid="sacred-map-loading" />
        ) : !info ? (
          // ยังไม่มีวันเกิด → หาธาตุไม่ได้
          <section className={CARD + " mt-8 text-center"} data-testid="sacred-map-empty">
            <p className="text-[40px]">🧭</p>
            <p className="mt-2 text-[16px] font-black text-v3-navy">ปลดล็อกแผนที่ศักดิ์สิทธิ์ของคุณ</p>
            <p className="mt-1 text-[13px] leading-5 text-v3-text-body">
              {birthDate ? "คำนวณธาตุประจำตัวไม่สำเร็จ ลองใหม่อีกครั้ง" : "กรอกวันเกิดเพื่อคำนวณธาตุประจำตัว แล้วดูทิศและสีมงคลเฉพาะคุณ"}
            </p>
            <Link href="/v2/settings/edit-birth" data-testid="sacred-map-add-birth" className="mt-4 inline-grid h-11 w-full max-w-[240px] place-items-center rounded-full bg-v3-sapphire text-[14px] font-bold uppercase text-v3-lime">
              {birthDate ? "ลองอีกครั้ง" : "กรอกวันเกิด"}
            </Link>
          </section>
        ) : (
          <>
            {/* HERO — ธาตุประจำตัว */}
            <section className="flex flex-col items-center gap-2 text-center" data-testid="sacred-map-hero">
              <span className={`rounded-full px-3 py-1 text-[13px] font-black ${info.tone}`}>{info.glyph} ธาตุประจำตัว: {info.labelTh}</span>
              <h1 className="text-[22px] font-black leading-7 text-v3-navy">ทิศ & สีมงคลของคุณ</h1>
              <p className="max-w-xs text-[13px] leading-5 text-v3-text-body">{info.note}</p>
            </section>

            {/* COMPASS */}
            <section className={CARD} data-testid="sacred-map-compass">
              <SacredCompass info={info} />
              <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px]">
                <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-[#3E9B4A]" /> ทิศเสริมพลัง</span>
                <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-[#2F6FB0]" /> ทิศเสริมดวง</span>
                <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-[#E23E3E]" /> ทิศควรเลี่ยง</span>
              </div>
            </section>

            {/* ทิศมงคล 3 กลุ่ม */}
            <section className={CARD} data-testid="sacred-map-dirs">
              <p className="text-[16px] font-black text-v3-navy">ทิศมงคลเฉพาะคุณ</p>
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex items-start gap-3 rounded-[16px] bg-[#EAF7EA] p-3">
                  <span className="mt-0.5 grid size-8 flex-none place-items-center rounded-full bg-[#3E9B4A] text-[13px] font-black text-white">＋</span>
                  <div><p className="text-[13px] font-black text-[#3E7E3A]">ทิศเสริมพลัง</p><p className="text-[13px] text-v3-text-body">{info.dirs.map((d) => DIR_TH[d]).join(" · ")} — หันหน้าทำงาน/จัดโต๊ะไปทางนี้</p></div>
                </div>
                <div className="flex items-start gap-3 rounded-[16px] bg-[#EAF3FF] p-3">
                  <span className="mt-0.5 grid size-8 flex-none place-items-center rounded-full bg-[#2F6FB0] text-[13px] font-black text-white">☆</span>
                  <div><p className="text-[13px] font-black text-v3-sapphire">ทิศเสริมดวง ({info.support.el})</p><p className="text-[13px] text-v3-text-body">{info.support.dirs.map((d) => DIR_TH[d]).join(" · ")} — หล่อเลี้ยงพลังของคุณให้ต่อเนื่อง</p></div>
                </div>
                <div className="flex items-start gap-3 rounded-[16px] bg-[#FDECEC] p-3">
                  <span className="mt-0.5 grid size-8 flex-none place-items-center rounded-full bg-[#E23E3E] text-[13px] font-black text-white">✕</span>
                  <div><p className="text-[13px] font-black text-[#C0392B]">ทิศควรเลี่ยง ({info.avoid.el})</p><p className="text-[13px] text-v3-text-body">{info.avoid.dirs.map((d) => DIR_TH[d]).join(" · ")} — เลี่ยงนั่งประจำ/หัวเตียงหันไปทางนี้</p></div>
                </div>
              </div>
            </section>

            {/* สีมงคล */}
            <section className={CARD} data-testid="sacred-map-colors">
              <p className="text-[16px] font-black text-v3-navy">สีมงคลของคุณ</p>
              <p className="text-[12px] text-v3-text-muted">ใช้กับเสื้อผ้า · กระเป๋า · สีรถ · ของใช้ประจำตัว</p>
              <div className="mt-3 flex flex-col gap-2.5">
                <ColorRow label="สีมงคล" list={info.lucky} />
                <ColorRow label="สีเสริมดวง" list={info.boost} />
                <ColorRow label="สีควรเลี่ยง" list={info.avoidColors} muted />
              </div>
            </section>

            {/* ผังบากว้า — จัดพื้นที่ตามเป้าหมาย */}
            <section className={CARD} data-testid="sacred-map-bagua">
              <p className="text-[16px] font-black text-v3-navy">จัดพื้นที่ตามเป้าหมาย</p>
              <p className="text-[12px] text-v3-text-muted">ผังบากว้า — วางของ/จัดมุมบ้านตามทิศเพื่อเสริมแต่ละด้าน</p>
              <div className="mt-3 grid grid-cols-1 gap-2.5">
                {BAGUA.map((b) => (
                  <div key={b.dir} className="flex items-start gap-3">
                    <span className="grid size-9 flex-none place-items-center rounded-full bg-v3-ghost-white text-[11px] font-black text-v3-navy">{b.dir}</span>
                    <div><p className="text-[13px] font-bold text-v3-navy">{b.area} <span className="font-medium text-v3-text-muted">· {DIR_TH[b.dir]}</span></p><p className="text-[12px] leading-4 text-v3-text-body">{b.tip}</p></div>
                  </div>
                ))}
              </div>
            </section>

            <p className="px-2 text-center text-[11px] leading-4 text-v3-text-muted">แนวทางเสริมมงคลตามหลักเบญจธาตุ ใช้ประกอบการตัดสินใจ โปรดใช้วิจารณญาณ</p>
          </>
        )}
      </div>

      <Menubar />
    </div>
  )
}

export default SacredMapScreen
