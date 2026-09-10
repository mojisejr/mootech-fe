// features/v2-service/components/PhoneReadingScreen.tsx — /v2/service/phone-number
// "ทำนายเบอร์มือถือ" (เลขศาสตร์) — กรอกเบอร์ → engine /api/v2/phone-reading (deterministic คู่เลข/ความหมาย)
// + ภาพรวมร้อยแก้วจาก AI (/api/v2/narrate). เบอร์กรอกเองทุกครั้ง. Figma 55666-1122 (2 จอ: intro + ผล 2 แท็บ).
import Head from "next/head"
import { useEffect, useMemo, useState } from "react"

import { SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { TopBarBell } from "@/features/v2-shell/components/TopBarBell"
import { TopBarAvatar } from "@/features/v2-shell/components/TopBarAvatar"

// ── shapes (ตรงกับ engine PhoneReading) ──
type PairMeaning = { pair: string; feeling: string; work: string; money: string; love: string; analysis: string }
type PhonePair = { pair: string; key: string; a: number; b: number; position: number; zone: "front" | "back"; weight: number; meaning: PairMeaning }
type DigitTally = { digit: number; planet: string; element: string; keyword: string; count: number }
type PhoneReading = { input: string; normalized: string; pairs: PhonePair[]; closing: PhonePair; digitTally: DigitTally[] }

const ZONE_LABEL: Record<"front" | "back", string> = { front: "รู้หน้า - การแสดงออกภายนอก", back: "รู้ใจ - ความรู้สึกภายใน" }

// สีธาตุ (ป้ายในตารางเลข)
const ELEMENT_COLOR: Record<string, string> = {
  ไฟ: "#EF4444", ดิน: "#B45309", น้ำ: "#2563EB", ทอง: "#64748B", ไม้: "#16A34A", ลม: "#0EA5A9", อากาศ: "#0EA5A9",
}
function elColor(el: string): string { return ELEMENT_COLOR[el] ?? "#64748B" }

// เกรดจากน้ำหนัก (weight 0..1 → %) — สเกลตาม Figma
function gradeOf(pct: number): string {
  if (pct >= 90) return "A"
  if (pct >= 80) return "B+"
  if (pct >= 70) return "B"
  if (pct >= 60) return "B-"
  if (pct >= 50) return "C+"
  if (pct >= 40) return "C"
  if (pct >= 30) return "D+"
  return "D"
}
function gradeColor(g: string): string {
  if (g.startsWith("A") || g.startsWith("B")) return "#16A34A"
  if (g.startsWith("C")) return "#F59E0B"
  return "#EF4444"
}

// สร้าง engine-truth ให้ AI เกลาเป็นภาพรวม — คงตัวเลข/ความหมายครบ ไม่แต่งเพิ่ม
function buildEngineText(r: PhoneReading): string {
  const lines: string[] = [`เบอร์ ${r.normalized} (9 หลักสำคัญ)`]
  lines.push(`คู่เลขปิดท้าย (มีอิทธิพลสูงสุด) ${r.closing.pair}: ${r.closing.meaning.analysis}`)
  lines.push("คู่เลขทั้งหมด (หน้า→หลัง):")
  for (const p of r.pairs) {
    lines.push(`- ${p.pair} [${ZONE_LABEL[p.zone]}] ${p.meaning.analysis} (งาน: ${p.meaning.work} · เงิน: ${p.meaning.money} · ความรัก: ${p.meaning.love})`)
  }
  lines.push("เลขเด่นในเบอร์: " + r.digitTally.map((d) => `${d.digit}×${d.count} (${d.planet}/${d.element}/${d.keyword})`).join(", "))
  return lines.join("\n")
}

// มาสคอตธาตุ — วางเฉพาะ "แถบบน" รอบหัวมาสคอตหลัก (ไม่ทับช่องกรอก/ปุ่ม) ตาม Figma
// ── แคชผลรายวัน (ทำนายแล้ววันนั้นดูซ้ำได้ ไม่หัก QI ใหม่; ข้ามวัน = หมดอายุ ต้องทำนายใหม่) ──
const CACHE_KEY = "mumate-phone-reading"
type CachedReading = { date: string; phoneDigits: string; reading: PhoneReading; narration: string | null }
function bkkToday(): string {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date()) } catch { return new Date().toISOString().slice(0, 10) }
}
function readCache(): CachedReading | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as CachedReading
    return c?.date === bkkToday() && c.reading?.pairs?.length ? c : null
  } catch { return null }
}
function writeCache(c: CachedReading) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)) } catch { /* ignore */ } }

const HERO_MASCOTS = [
  { src: "/images/v2/referral/mascot-fire.png", cls: "left-1 top-[-40px] h-12 w-12" },
  { src: "/images/v2/referral/mascot-earth.png", cls: "right-2 top-[-46px] h-11 w-11" },
  { src: "/images/v2/referral/mascot-wood.png", cls: "right-1 top-11 h-11 w-11" },
  { src: "/images/v2/referral/mascot-water.png", cls: "left-1 top-11 h-11 w-11" },
]

// การ์ดคู่เลขแบบพับได้
function PairRow({ p, defaultOpen }: { p: PhonePair; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen)
  const pct = Math.round(p.weight * 100)
  const g = gradeOf(pct)
  const c = gradeColor(g)
  const fields: { label: string; icon: string; text: string }[] = [
    { label: "บุคลิกภาพ", icon: "🧑", text: p.meaning.feeling },
    { label: "การงาน", icon: "💼", text: p.meaning.work },
    { label: "การเงิน", icon: "💰", text: p.meaning.money },
    { label: "ความรัก", icon: "❤️", text: p.meaning.love },
    { label: "บทวิเคราะห์", icon: "⭐", text: p.meaning.analysis },
  ].filter((f) => f.text)
  return (
    <div className="rounded-[16px] bg-white p-4 v3-shadow-card" data-testid="phone-pair">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 text-left">
        <span className="text-[24px] font-black text-v3-navy">{p.pair}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-bold text-v3-text-muted">{ZONE_LABEL[p.zone]}</span>
          <span className="mt-1 flex items-center gap-2">
            <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-v3-ghost-white">
              <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: c }} />
            </span>
            <span className="text-[11px] font-bold" style={{ color: c }}>{pct}%</span>
          </span>
        </span>
        <span className="grid size-8 flex-none place-items-center rounded-full text-[13px] font-black text-white" style={{ background: c }}>{g}</span>
        <span className={"flex-none text-[14px] text-v3-text-muted transition-transform " + (open ? "rotate-180" : "")}>⌄</span>
      </button>
      {open ? (
        <div className="mt-3 flex flex-col gap-3 border-t border-dashed border-v3-border-card pt-3">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="flex items-center gap-1.5 text-[13px] font-black text-v3-navy"><span>{f.icon}</span>{f.label}</p>
              <p className="mt-0.5 text-[13px] leading-6 text-v3-text-body">{f.text}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function PhoneReadingScreen() {
  const [phone, setPhone] = useState("")
  const [phase, setPhase] = useState<"intro" | "loading" | "result">("intro")
  const [reading, setReading] = useState<PhoneReading | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [narration, setNarration] = useState<string | null>(null)
  const [narrating, setNarrating] = useState(false)
  const [tab, setTab] = useState<"pairs" | "digits">("pairs")
  const [needQi, setNeedQi] = useState(false) // QI ไม่พอ → โชว์ปุ่มเติม

  const canSubmit = phone.replace(/\D/g, "").length >= 9
  const QI_COST = 10

  // กลับเข้าหน้า → ถ้าทำนายไปแล้ววันนี้ โชว์ผลเดิม (ไม่หัก QI ใหม่)
  useEffect(() => {
    const c = readCache()
    if (c) { setReading(c.reading); setNarration(c.narration); setPhone(c.phoneDigits); setPhase("result") }
  }, [])

  // ดักปุ่ม back ตอนอยู่หน้าผล → กลับไปหน้ากรอก (ไม่หลุดออกไปหน้าแรก)
  useEffect(() => {
    if (phase !== "result") return
    window.history.pushState({ phoneResult: true }, "")
    const onPop = () => setPhase("intro")
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [phase])

  // คู่เลขเรียงตามน้ำหนักมาก→น้อย (คู่ปิดท้ายเด่นสุดอยู่บน) ตาม Figma
  const rankedPairs = useMemo(
    () => (reading ? [...reading.pairs].sort((a, b) => b.weight - a.weight) : []),
    [reading],
  )

  const submit = async () => {
    if (!canSubmit || phase === "loading") return
    const digits = phone.replace(/\D/g, "")
    // เบอร์เดิม + วันเดียวกัน → ดูผลเดิมซ้ำ ไม่หัก QI ใหม่
    const cached = readCache()
    if (cached && cached.phoneDigits === digits) {
      setReading(cached.reading); setNarration(cached.narration); setNarrating(false); setError(null); setNeedQi(false); setTab("pairs"); setPhase("result")
      return
    }
    setPhase("loading"); setError(null); setNeedQi(false); setReading(null); setNarration(null); setTab("pairs")
    try {
      // GATE: หัก 10 QI ก่อนทำนาย (engine กันยอดไม่พอ → 409)
      const spend = await fetch("/api/qi-spend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "phone_reading" }) })
      if (!spend.ok) {
        if (spend.status === 409) { setError(`แต้ม QI ไม่พอ (ใช้ ${QI_COST} QI ต่อการทำนาย)`); setNeedQi(true) }
        else if (spend.status === 401) setError("กรุณาเข้าสู่ระบบก่อนใช้งาน")
        else setError("หักแต้ม QI ไม่สำเร็จ ลองใหม่อีกครั้ง")
        setPhase("intro"); return
      }
      const res = await fetch("/api/v2/phone-reading", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber: phone }) })
      const j = (await res.json().catch(() => ({}))) as PhoneReading & { error?: string }
      if (!res.ok || !j.pairs?.length) {
        setError((typeof j.error === "string" ? j.error : null) || "ทำนายเบอร์ไม่สำเร็จ ลองใหม่อีกครั้ง")
        setPhase("intro"); return
      }
      setReading(j); setPhase("result"); setNarrating(true)
      writeCache({ date: bkkToday(), phoneDigits: digits, reading: j, narration: null }) // แคชทันที (กันหักซ้ำแม้ AI ยังไม่เสร็จ)
      void fetch("/api/v2/narrate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engineText: buildEngineText(j), domainLabel: "ทำนายเบอร์มือถือ", feature: "phone_reading" }),
      })
        .then((r) => r.json().catch(() => ({})))
        .then((n) => {
          const text = typeof n?.text === "string" ? n.text : null
          setNarration(text)
          writeCache({ date: bkkToday(), phoneDigits: digits, reading: j, narration: text }) // อัปเดตแคชพร้อมภาพรวม
        })
        .catch(() => setNarration(null))
        .finally(() => setNarrating(false))
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง"); setPhase("intro")
    }
  }

  // ทำนายเบอร์อื่น → กลับหน้ากรอก (แคชวันนี้ยังอยู่ ถ้าพิมพ์เบอร์เดิมดูซ้ำได้ฟรี, เบอร์ใหม่ = หักใหม่)
  const reset = () => { setPhone(""); setReading(null); setNarration(null); setError(null); setNeedQi(false); setTab("pairs"); setPhase("intro") }

  const share = () => {
    if (!reading) return
    const text = `เบอร์ ${reading.normalized} · คู่เด่น ${reading.closing.pair}\n${narration ? narration.slice(0, 180) : reading.closing.meaning.analysis.slice(0, 180)}…\nทำนายเบอร์ของคุณที่ MuMate`
    if (typeof navigator !== "undefined" && navigator.share) void navigator.share({ title: "ทำนายเบอร์มือถือ", text }).catch(() => {})
    else if (typeof navigator !== "undefined") void navigator.clipboard?.writeText(text).catch(() => {})
  }

  const digits = reading ? reading.normalized.split("") : []
  const closingLen = reading?.closing.pair.length ?? 2

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-v3-bg-cream font-ibm">
      <Head><title>ทำนายเบอร์มือถือ · MuMate</title></Head>
      <SkyBackdrop height={360} />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-40 pt-2">
        <SkyHeader
          title={phase === "result" ? "ผลทำนายเบอร์" : "ทำนายเบอร์มือถือ"}
          backHref="/v2/service"
          testId="phone-reading"
          right={phase === "result"
            ? <span className="rounded-full bg-[#EAF7EA] px-3 py-1 text-[12px] font-black text-[#3E7E3A]">ใช้ {QI_COST} QI</span>
            : <span className="flex items-center gap-2"><TopBarBell variant="solid" href="/v2/calendar/notifications" /><TopBarAvatar variant="sapphire" href="/v2/account" /></span>}
        />

        {phase !== "result" && (
          <>
            {/* HERO — มาสคอตใหญ่โผล่เหนือการ์ด + มาสคอตธาตุแถบบน (ไม่ทับช่องกรอก/ปุ่ม) */}
            <section className="relative mt-20 rounded-[24px] bg-v3-sapphire px-6 pb-6 pt-32 text-center" data-testid="phone-intro">
              {/* มาสคอตหลัก โผล่เหนือขอบบนการ์ดเข้าไปในท้องฟ้า */}
              <img src="/images/v2/mascot/01.webp" alt="" aria-hidden className="pointer-events-none absolute left-1/2 top-[-96px] z-10 h-[210px] w-[210px] -translate-x-1/2 object-contain drop-shadow-[0_12px_22px_rgba(0,0,0,.28)]" />
              {HERO_MASCOTS.map((mm, i) => <img key={i} src={mm.src} alt="" aria-hidden style={{ animationDelay: `${i * 0.4}s` }} className={"phone-float pointer-events-none absolute z-10 object-contain " + mm.cls} />)}

              <h1 className="text-[22px] font-black text-v3-lime">กรอกเบอร์มือถือเลยจ้า</h1>
              <p className="mt-1.5 text-[13px] leading-5 text-white/85">อ่านจากคู่เลขที่ติดกัน โดยคู่ท้าย ๆ มีน้ำหนักมากที่สุด</p>
              <input
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d\s-]/g, "").slice(0, 15))}
                onKeyDown={(e) => { if (e.key === "Enter") void submit() }}
                placeholder="กรอกเบอร์มือถือของคุณ"
                data-testid="phone-input"
                className="mt-4 w-full rounded-full bg-white px-5 py-3.5 text-center text-[16px] font-bold tracking-[0.12em] text-v3-navy outline-none placeholder:font-medium placeholder:tracking-normal placeholder:text-v3-text-muted"
              />
              <button type="button" onClick={() => void submit()} disabled={!canSubmit || phase === "loading"} data-testid="phone-submit"
                className="mt-3 grid w-full place-items-center rounded-full bg-v3-lime py-3.5 text-[16px] font-black text-v3-navy disabled:opacity-50">
                {phase === "loading" ? "กำลังทำนาย..." : "ทำนายเบอร์นี้"}
              </button>
              {error && <p className="mt-2 text-[12px] font-bold text-v3-lime" data-testid="phone-error">{error}</p>}
              {needQi && <a href="/v2/qi" className="mt-2 inline-grid h-9 place-items-center rounded-full bg-white px-5 text-[13px] font-bold text-v3-sapphire" data-testid="phone-buy-qi">เติม QI</a>}
              <p className="mt-3 text-[11px] font-bold text-v3-lime">ใช้ {QI_COST} QI ต่อการทำนาย</p>
              <p className="mt-0.5 text-[11px] text-white/70">ระบบจะตัดรหัสประเทศ 0 หรือ 66 ออกให้อัตโนมัติ</p>
            </section>

            {/* อ่านยังไง */}
            <section className="rounded-[24px] bg-white p-5 v3-shadow-card">
              <h2 className="text-[16px] font-black text-v3-navy">อ่านยังไง</h2>
              <div className="mt-3 flex flex-col gap-3">
                {[
                  "แยกเบอร์เป็นคู่เลขที่ติดกันทั้งหมด 8 คู่",
                  "คู่ต้นบอกสิ่งที่คนอื่นเห็น คู่ท้ายบอกตัวตนข้างใน",
                  "คู่สุดท้ายมีน้ำหนักมากที่สุด 100%",
                ].map((t, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="grid size-6 flex-none place-items-center rounded-full bg-v3-sapphire text-[12px] font-black text-white">{i + 1}</span>
                    <p className="text-[13px] leading-6 text-v3-text-body">{t}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {phase === "result" && reading && (
          <div className="flex flex-col gap-4" data-testid="phone-result">
            {/* การ์ดสรุป + เลขเรียง */}
            <section className="rounded-[24px] bg-v3-sapphire p-5 text-center text-white">
              <p className="text-[26px] leading-none text-v3-lime">✦✦</p>
              <p className="mt-2 text-[20px] font-black text-v3-lime">ดูผลการทำนายเลย</p>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {digits.map((d, i) => {
                  const isClosing = i >= digits.length - closingLen
                  return (
                    <span key={i} className={"grid size-10 place-items-center rounded-[10px] text-[17px] font-black " + (isClosing ? "bg-v3-lime text-v3-navy" : "bg-white text-v3-navy")}>{d}</span>
                  )
                })}
              </div>
              <p className="mt-4 text-[12px] leading-5 text-white/85">คู่ปิดท้าย {reading.closing.pair} มีน้ำหนักมากที่สุดต่อคำทำนายรวม</p>
              <button type="button" onClick={reset} data-testid="phone-again" className="mt-4 rounded-full bg-v3-lime px-6 py-2.5 text-[14px] font-black text-v3-navy">ดูทำนายเบอร์อื่น</button>
            </section>

            {/* ภาพรวม (AI) */}
            <section className="rounded-[20px] bg-white p-5 v3-shadow-card" data-testid="phone-overview">
              <h2 className="text-[16px] font-black text-v3-navy">ภาพรวมของเบอร์นี้</h2>
              {narrating && !narration && <p className="mt-2 text-[13px] text-v3-text-muted">กำลังเรียบเรียงภาพรวม…</p>}
              {narration && <p className="mt-2 whitespace-pre-line text-[14px] leading-6 text-v3-text-body">{narration}</p>}
              {!narrating && !narration && <p className="mt-2 text-[13px] text-v3-text-muted">ดูรายละเอียดคู่เลขและธาตุด้านล่างได้เลย</p>}
            </section>

            {/* แท็บ */}
            <div className="flex gap-2 rounded-full bg-v3-ghost-white p-1">
              <button type="button" onClick={() => setTab("pairs")} data-testid="phone-tab-pairs" className={"h-10 flex-1 rounded-full text-[13px] font-bold " + (tab === "pairs" ? "bg-v3-sapphire text-white" : "text-v3-navy")}>คำทำนายรายคู่</button>
              <button type="button" onClick={() => setTab("digits")} data-testid="phone-tab-digits" className={"h-10 flex-1 rounded-full text-[13px] font-bold " + (tab === "digits" ? "bg-v3-sapphire text-white" : "text-v3-navy")}>ดวงและธาตุในเบอร์</button>
            </div>

            {tab === "pairs" ? (
              <section className="flex flex-col gap-3" data-testid="phone-pairs">
                {rankedPairs.map((p, i) => <PairRow key={`${p.pair}-${p.position}`} p={p} defaultOpen={i === 0} />)}
              </section>
            ) : (
              <section className="rounded-[20px] bg-white p-4 v3-shadow-card" data-testid="phone-digits">
                <div className="flex flex-col divide-y divide-v3-border-card">
                  {reading.digitTally.map((d) => (
                    <div key={d.digit} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="grid size-8 flex-none place-items-center rounded-full bg-v3-ghost-white text-[15px] font-black text-v3-navy">{d.digit}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="text-[13px] font-black text-v3-navy">{d.planet}</span>
                          <span className="rounded-full px-1.5 py-[1px] text-[10px] font-bold" style={{ background: elColor(d.element) + "22", color: elColor(d.element) }}>ธาตุ{d.element}</span>
                        </span>
                        <span className="block text-[11px] leading-4 text-v3-text-muted">{d.keyword}</span>
                      </span>
                      <span className="flex-none text-[12px] font-bold text-v3-text-muted">×{d.count}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[12px] leading-5 text-v3-text-muted">เลขที่ซ้ำมากจะให้อิทธิพลต่อเบอร์มากตามไปด้วย</p>
              </section>
            )}

            {/* หมายเหตุ (แสดงทุกแท็บ) */}
            <div className="rounded-[14px] bg-[#FBEAF0] p-3 text-center">
              <p className="text-[12px] leading-5 text-[#9B5273]">คำทำนายมีไว้เพื่อเป็นแนวทางในการไตร่ตรอง<br />ไม่ใช่คำแนะนำทางการแพทย์ การเงิน หรือกฎหมาย</p>
            </div>

            {/* actions */}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => window.print()} data-testid="phone-pdf" className="grid h-11 place-items-center rounded-full border border-v3-border-card bg-white text-[13px] font-bold text-v3-navy">📄 บันทึก PDF</button>
              <button type="button" onClick={share} data-testid="phone-share" className="grid h-11 place-items-center rounded-full bg-v3-sapphire text-[13px] font-bold text-white">↗ แชร์</button>
            </div>
          </div>
        )}
      </div>

      <Menubar />
      <style>{`
        @keyframes phoneFloat { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-8px) } }
        .phone-float { animation: phoneFloat 2.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .phone-float { animation: none !important } }
      `}</style>
    </div>
  )
}

export default PhoneReadingScreen
