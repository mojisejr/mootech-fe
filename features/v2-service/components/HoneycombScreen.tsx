// features/v2-service/components/HoneycombScreen.tsx — /v2/service/honeycomb
// "เบอร์รังผึ้ง" (เบอร์ปิรามิด) — กรอกเบอร์ → engine /api/v2/honeycomb (พีระมิดผลรวมคู่เลข ไล่ชั้นถึงยอด)
// + ภาพรวม AI (/api/v2/narrate). คิด 10 QI/ครั้ง + แคชผลรายวัน + back กลับหน้ากรอก. Figma 55666-2096.
import Head from "next/head"
import { useEffect, useState } from "react"

import { SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { TopBarBell } from "@/features/v2-shell/components/TopBarBell"
import { TopBarAvatar } from "@/features/v2-shell/components/TopBarAvatar"

type PairMeaning = { pair: string; feeling: string; work: string; money: string; love: string; analysis: string }
type HoneycombPair = { pair: string; key: string; a: number; b: number; meaning: PairMeaning }
type DigitInfo = { digit: number; planet: string; element: string; keyword: string }
type Zone = "self" | "near" | "far"
type HoneycombLayer = { layerNo: number; digits: number[]; digitString: string; zone: Zone; pairs: HoneycombPair[]; digitMeaning?: DigitInfo }
type HoneycombReading = { input: string; normalized: string; rows: number[][]; layers: HoneycombLayer[] }

const ZONE_LABEL: Record<Zone, string> = { self: "ตัวเรา", near: "คนใกล้ตัว", far: "คนห่างตัว" }
const ZONE_CHIP: Record<Zone, string> = { self: "bg-v3-lime text-v3-navy", near: "bg-v3-cyan text-white", far: "bg-white text-v3-navy" }
const ZONE_PILL: Record<Zone, string> = { self: "bg-v3-lime/20 text-v3-navy", near: "bg-v3-cyan/15 text-v3-cyan", far: "bg-v3-ghost-white text-v3-text-muted" }
// ชั้น N → โซน (1-4 ตัวเรา, 5-6 คนใกล้ตัว, 7-11 คนห่างตัว)
function zoneOfLayer(n: number): Zone { return n <= 4 ? "self" : n <= 6 ? "near" : "far" }

const CACHE_KEY = "mumate-honeycomb-reading"
type CachedReading = { date: string; phoneDigits: string; reading: HoneycombReading; narration: string | null }
function bkkToday(): string {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date()) } catch { return new Date().toISOString().slice(0, 10) }
}
function readCache(): CachedReading | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as CachedReading
    return c?.date === bkkToday() && c.reading?.layers?.length ? c : null
  } catch { return null }
}
function writeCache(c: CachedReading) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)) } catch { /* ignore */ } }

function buildEngineText(r: HoneycombReading): string {
  const lines: string[] = [`เบอร์ ${r.normalized} (พีระมิดรังผึ้ง)`]
  const apex = r.layers.find((l) => l.layerNo === 1)
  if (apex?.digitMeaning) lines.push(`ยอดปิรามิด (แก่นเบอร์ = ตัวเรา) เลข ${apex.digitMeaning.digit}: ${apex.digitMeaning.keyword} (${apex.digitMeaning.planet}/ธาตุ${apex.digitMeaning.element})`)
  for (const l of r.layers) {
    if (!l.pairs.length) continue
    const top = l.pairs.slice(0, 3).map((p) => `${p.pair} ${p.meaning.analysis}`).join(" | ")
    lines.push(`ชั้น ${l.layerNo} [${ZONE_LABEL[l.zone]}] ${l.digitString}: ${top}`)
  }
  return lines.join("\n")
}

const HERO_MASCOTS = [
  { src: "/images/v2/referral/mascot-fire.png", cls: "left-1 top-[-40px] h-12 w-12" },
  { src: "/images/v2/referral/mascot-earth.png", cls: "right-2 top-[-46px] h-11 w-11" },
  { src: "/images/v2/referral/mascot-wood.png", cls: "right-1 top-11 h-11 w-11" },
  { src: "/images/v2/referral/mascot-water.png", cls: "left-1 top-11 h-11 w-11" },
]

// พีระมิด: rows[0] = ฐานกว้างสุด (11) … rows[last] = ยอด (1). สีชิปตามโซนของชั้น (ความยาวแถว = เลขชั้น)
function Pyramid({ rows }: { rows: number[][] }) {
  return (
    <div className="flex flex-col items-stretch gap-1.5" data-testid="honeycomb-pyramid">
      {rows.map((row, i) => {
        const layerNo = row.length
        const zone = zoneOfLayer(layerNo)
        return (
          <div key={i} className="flex items-center gap-1">
            <span className="w-9 flex-none text-right text-[10px] font-bold text-white/70">ชั้น {layerNo}</span>
            <div className="flex flex-1 flex-nowrap justify-center gap-0.5">
              {row.map((d, j) => (
                <span key={j} className={"grid size-[22px] flex-none place-items-center rounded-md text-[11px] font-black " + ZONE_CHIP[zone]}>{d}</span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// การ์ดชั้นแบบพับได้
function LayerRow({ l, defaultOpen }: { l: HoneycombLayer; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen)
  const fields = (m: PairMeaning) => ([
    { label: "บุคลิกภาพ", icon: "🧑", text: m.feeling },
    { label: "การงาน", icon: "💼", text: m.work },
    { label: "การเงิน", icon: "💰", text: m.money },
    { label: "ความรัก", icon: "❤️", text: m.love },
    { label: "บทวิเคราะห์", icon: "⭐", text: m.analysis },
  ].filter((f) => f.text))
  return (
    <div className="rounded-[16px] bg-white p-4 v3-shadow-card" data-testid="honeycomb-layer">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 text-left">
        <span className="grid size-10 flex-none place-items-center rounded-[14px] bg-[#EAF7EA] text-[16px] font-black text-[#3E7E3A]">{l.layerNo}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-black text-v3-navy">ชั้น {l.layerNo} · {l.digitString}</span>
          <span className={"mt-0.5 inline-block rounded-full px-2 py-[1px] text-[11px] font-bold " + ZONE_PILL[l.zone]}>{ZONE_LABEL[l.zone]}</span>
        </span>
        <span className={"flex-none text-[14px] text-v3-text-muted transition-transform " + (open ? "rotate-180" : "")}>⌄</span>
      </button>
      {open ? (
        <div className="mt-3 flex flex-col gap-3 border-t border-dashed border-v3-border-card pt-3">
          {l.digitMeaning ? (
            <div className="rounded-[12px] bg-[#EDF7EE] p-3">
              <p className="text-[13px] font-black text-[#2F7A46]">ยอดปิรามิด · เลข {l.digitMeaning.digit}</p>
              <p className="mt-0.5 text-[13px] leading-6 text-v3-text-body">{l.digitMeaning.keyword} · {l.digitMeaning.planet} · ธาตุ{l.digitMeaning.element}</p>
            </div>
          ) : null}
          {l.pairs.map((p, pi) => (
            <div key={pi} className="flex flex-col gap-2">
              <p className="text-[13px] font-black text-v3-sapphire">คำทำนายรายคู่ {p.pair}</p>
              {fields(p.meaning).map((f) => (
                <div key={f.label}>
                  <p className="flex items-center gap-1.5 text-[13px] font-black text-v3-navy"><span>{f.icon}</span>{f.label}</p>
                  <p className="mt-0.5 text-[13px] leading-6 text-v3-text-body">{f.text}</p>
                </div>
              ))}
            </div>
          ))}
          {!l.digitMeaning && !l.pairs.length ? <p className="text-[13px] text-v3-text-muted">—</p> : null}
        </div>
      ) : null}
    </div>
  )
}

export function HoneycombScreen() {
  const [phone, setPhone] = useState("")
  const [phase, setPhase] = useState<"intro" | "loading" | "result">("intro")
  const [reading, setReading] = useState<HoneycombReading | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [narration, setNarration] = useState<string | null>(null)
  const [narrating, setNarrating] = useState(false)
  const [needQi, setNeedQi] = useState(false)

  const canSubmit = phone.replace(/\D/g, "").length >= 9
  const QI_COST = 10

  useEffect(() => {
    const c = readCache()
    if (c) { setReading(c.reading); setNarration(c.narration); setPhone(c.phoneDigits); setPhase("result") }
  }, [])

  useEffect(() => {
    if (phase !== "result") return
    window.history.pushState({ honeycombResult: true }, "")
    const onPop = () => setPhase("intro")
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [phase])

  const submit = async () => {
    if (!canSubmit || phase === "loading") return
    const digits = phone.replace(/\D/g, "")
    const cached = readCache()
    if (cached && cached.phoneDigits === digits) {
      setReading(cached.reading); setNarration(cached.narration); setNarrating(false); setError(null); setNeedQi(false); setPhase("result")
      return
    }
    setPhase("loading"); setError(null); setNeedQi(false); setReading(null); setNarration(null)
    try {
      const spend = await fetch("/api/qi-spend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "honeycomb_reading" }) })
      if (!spend.ok) {
        if (spend.status === 409) { setError(`แต้ม QI ไม่พอ (ใช้ ${QI_COST} QI ต่อการทำนาย)`); setNeedQi(true) }
        else if (spend.status === 401) setError("กรุณาเข้าสู่ระบบก่อนใช้งาน")
        else setError("หักแต้ม QI ไม่สำเร็จ ลองใหม่อีกครั้ง")
        setPhase("intro"); return
      }
      const res = await fetch("/api/v2/honeycomb", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber: phone }) })
      const j = (await res.json().catch(() => ({}))) as HoneycombReading & { error?: { message?: string } }
      if (!res.ok || !j.layers?.length) {
        setError(j.error?.message || "คำนวณปิรามิดไม่สำเร็จ ลองใหม่อีกครั้ง")
        setPhase("intro"); return
      }
      setReading(j); setPhase("result"); setNarrating(true)
      writeCache({ date: bkkToday(), phoneDigits: digits, reading: j, narration: null })
      void fetch("/api/v2/narrate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engineText: buildEngineText(j), domainLabel: "ทำนายเบอร์รังผึ้ง (เบอร์ปิรามิด)", feature: "phone_reading" }),
      })
        .then((r) => r.json().catch(() => ({})))
        .then((n) => {
          const text = typeof n?.text === "string" ? n.text : null
          setNarration(text)
          writeCache({ date: bkkToday(), phoneDigits: digits, reading: j, narration: text })
        })
        .catch(() => setNarration(null))
        .finally(() => setNarrating(false))
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง"); setPhase("intro")
    }
  }

  const reset = () => { setPhone(""); setReading(null); setNarration(null); setError(null); setNeedQi(false); setPhase("intro") }

  const share = () => {
    if (!reading) return
    const apex = reading.layers.find((l) => l.layerNo === 1)?.digitMeaning
    const text = `เบอร์รังผึ้ง ${reading.normalized}${apex ? ` · ยอดปิรามิด ${apex.keyword}` : ""}\n${narration ? narration.slice(0, 160) : ""}…\nทำนายเบอร์รังผึ้งที่ MuMate`
    if (typeof navigator !== "undefined" && navigator.share) void navigator.share({ title: "ทำนายเบอร์รังผึ้ง", text }).catch(() => {})
    else if (typeof navigator !== "undefined") void navigator.clipboard?.writeText(text).catch(() => {})
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-v3-bg-cream font-ibm">
      <Head><title>เบอร์รังผึ้ง · MuMate</title></Head>
      <SkyBackdrop height={360} />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-40 pt-2">
        <SkyHeader
          title={phase === "result" ? "ผลทำนายเบอร์" : "Honeycomb"}
          backHref="/v2/service"
          testId="honeycomb"
          right={phase === "result"
            ? <span className="rounded-full bg-[#EAF7EA] px-3 py-1 text-[12px] font-black text-[#3E7E3A]">ใช้ {QI_COST} QI</span>
            : <span className="flex items-center gap-2"><TopBarBell variant="solid" href="/v2/calendar/notifications" /><TopBarAvatar variant="sapphire" href="/v2/account" /></span>}
        />

        {phase !== "result" && (
          <>
            <section className="relative mt-20 rounded-[24px] bg-v3-sapphire px-6 pb-6 pt-32 text-center" data-testid="honeycomb-intro">
              <img src="/images/v2/mascot/01.webp" alt="" aria-hidden className="pointer-events-none absolute left-1/2 top-[-96px] z-10 h-[210px] w-[210px] -translate-x-1/2 object-contain drop-shadow-[0_12px_22px_rgba(0,0,0,.28)]" />
              {HERO_MASCOTS.map((mm, i) => <img key={i} src={mm.src} alt="" aria-hidden style={{ animationDelay: `${i * 0.4}s` }} className={"honey-float pointer-events-none absolute z-10 object-contain " + mm.cls} />)}

              <h1 className="text-[22px] font-black leading-7 text-v3-lime">กรอกเบอร์มือถือ<br />ประเมินเบอร์รังผึ้งเลยจ้า</h1>
              <p className="mt-1.5 text-[13px] leading-5 text-white/85">รวมเลขคู่ที่ติดกันไล่ลงมาทีละชั้นจนเหลือหลักเดียว<br />แล้วอ่านพลังงานจากแต่ละชั้น</p>
              <input
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d\s-]/g, "").slice(0, 15))}
                onKeyDown={(e) => { if (e.key === "Enter") void submit() }}
                placeholder="กรอกเบอร์มือถือของคุณ"
                data-testid="honeycomb-input"
                className="mt-4 w-full rounded-full bg-white px-5 py-3.5 text-center text-[16px] font-bold tracking-[0.12em] text-v3-navy outline-none placeholder:font-medium placeholder:tracking-normal placeholder:text-v3-text-muted"
              />
              <button type="button" onClick={() => void submit()} disabled={!canSubmit || phase === "loading"} data-testid="honeycomb-submit"
                className="mt-3 grid w-full place-items-center rounded-full bg-v3-lime py-3.5 text-[16px] font-black text-v3-navy disabled:opacity-50">
                {phase === "loading" ? "กำลังคำนวณ..." : "ทำนายเบอร์นี้"}
              </button>
              {error && <p className="mt-2 text-[12px] font-bold text-v3-lime" data-testid="honeycomb-error">{error}</p>}
              {needQi && <a href="/v2/qi" className="mt-2 inline-grid h-9 place-items-center rounded-full bg-white px-5 text-[13px] font-bold text-v3-sapphire" data-testid="honeycomb-buy-qi">เติม QI</a>}
              <p className="mt-3 text-[11px] font-bold text-v3-lime">ใช้ {QI_COST} QI ต่อการทำนาย</p>
              <p className="mt-0.5 text-[11px] text-white/70">ระบบจะตัดรหัสประเทศ 0 หรือ 66 ออกให้อัตโนมัติ</p>
            </section>

            <section className="rounded-[24px] bg-white p-5 v3-shadow-card">
              <h2 className="text-[16px] font-black text-v3-navy">แต่ละชั้นบอกอะไร</h2>
              <div className="mt-3 flex flex-col gap-3">
                {[
                  { pill: "ชั้น 1-4", tone: ZONE_PILL.self, label: "ตัวเรา", desc: "ตัวตนและพลังงานที่อยู่กับคุณเองมากที่สุด" },
                  { pill: "ชั้น 5-6", tone: ZONE_PILL.near, label: "คนใกล้ตัว", desc: "ครอบครัว คนรัก เพื่อนสนิท" },
                  { pill: "ชั้น 7-11", tone: ZONE_PILL.far, label: "คนห่างตัว", desc: "เพื่อนร่วมงาน สังคม คนที่เพิ่งรู้จัก" },
                ].map((z) => (
                  <div key={z.pill} className="flex items-start gap-3">
                    <span className={"mt-0.5 flex-none rounded-full px-2 py-[2px] text-[11px] font-bold " + z.tone}>{z.pill}</span>
                    <p className="min-w-0 flex-1 text-[13px] leading-5 text-v3-text-body"><span className="font-black text-v3-navy">{z.label}</span> · {z.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {phase === "result" && reading && (
          <div className="flex flex-col gap-4" data-testid="honeycomb-result">
            <section className="rounded-[24px] bg-v3-sapphire p-5 text-center text-white">
              <svg viewBox="0 0 48 32" className="mx-auto h-8 w-12" aria-hidden fill="#F5C518">
                <path d="M30 2c1 6 3 8 9 9-6 1-8 3-9 9-1-6-3-8-9-9 6-1 8-3 9-9Z" />
                <path d="M13 14c.6 3.5 1.8 4.7 5.3 5.3-3.5.6-4.7 1.8-5.3 5.3-.6-3.5-1.8-4.7-5.3-5.3 3.5-.6 4.7-1.8 5.3-5.3Z" />
              </svg>
              <p className="mt-2 text-[20px] font-black text-v3-lime">ดูผลการทำนายเลย</p>
              <div className="mt-4"><Pyramid rows={reading.rows} /></div>
              <p className="mt-4 text-[12px] leading-5 text-white/85">ชั้น 1 คือผลรวมสุดท้าย · สีชั้นคือชั้นที่เป็นตัวเรา</p>
              <button type="button" onClick={reset} data-testid="honeycomb-again" className="mt-4 rounded-full bg-v3-lime px-6 py-2.5 text-[14px] font-black text-v3-navy">ดูทำนายเบอร์อื่น</button>
            </section>

            <section className="rounded-[20px] bg-white p-5 v3-shadow-card" data-testid="honeycomb-overview">
              <h2 className="text-[16px] font-black text-v3-navy">ภาพรวมของเบอร์นี้</h2>
              {narrating && !narration && <p className="mt-2 text-[13px] text-v3-text-muted">กำลังเรียบเรียงภาพรวม…</p>}
              {narration && <p className="mt-2 whitespace-pre-line text-[14px] leading-6 text-v3-text-body">{narration}</p>}
              {!narrating && !narration && <p className="mt-2 text-[13px] text-v3-text-muted">ดูรายละเอียดแต่ละชั้นด้านล่างได้เลย</p>}
            </section>

            <h2 className="px-1 text-[16px] font-black text-v3-navy">คำทำนายรายคู่</h2>
            <section className="flex flex-col gap-3" data-testid="honeycomb-layers">
              {reading.layers.map((l, i) => <LayerRow key={l.layerNo} l={l} defaultOpen={i === 0} />)}
            </section>

            <div className="rounded-[14px] bg-[#FBEAF0] p-3 text-center">
              <p className="text-[12px] leading-5 text-[#9B5273]">คำทำนายมีไว้เพื่อเป็นแนวทางในการไตร่ตรอง<br />ไม่ใช่คำแนะนำทางการแพทย์ การเงิน หรือกฎหมาย</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => window.print()} data-testid="honeycomb-pdf" className="grid h-11 place-items-center rounded-full border border-v3-border-card bg-white text-[13px] font-bold text-v3-navy">📄 บันทึก PDF</button>
              <button type="button" onClick={share} data-testid="honeycomb-share" className="grid h-11 place-items-center rounded-full bg-v3-sapphire text-[13px] font-bold text-white">↗ แชร์</button>
            </div>
          </div>
        )}
      </div>

      <Menubar />
      <style>{`
        @keyframes honeyFloat { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-8px) } }
        .honey-float { animation: honeyFloat 2.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .honey-float { animation: none !important } }
      `}</style>
    </div>
  )
}

export default HoneycombScreen
