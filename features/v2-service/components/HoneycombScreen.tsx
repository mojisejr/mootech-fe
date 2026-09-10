// features/v2-service/components/HoneycombScreen.tsx — /v2/service/honeycomb
// "เบอร์รังผึ้ง" (เบอร์ปิรามิด) — กรอกเบอร์ → engine /api/v2/honeycomb (พีระมิดผลรวมคู่เลข + ตีความรายชั้น)
// + คำทำนาย AI (/api/v2/narrate). เบอร์กรอกเองทุกครั้ง. Figma 55666-2096.
import Head from "next/head"
import { useState } from "react"

import { SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"

type PairMeaning = { pair: string; feeling: string; work: string; money: string; love: string; analysis: string }
type HoneycombPair = { pair: string; key: string; a: number; b: number; meaning: PairMeaning }
type DigitInfo = { digit: number; planet: string; element: string; keyword: string }
type HoneycombZone = "self" | "near" | "far"
type HoneycombLayer = { layerNo: number; digits: number[]; digitString: string; zone: HoneycombZone; pairs: HoneycombPair[]; digitMeaning?: DigitInfo }
type HoneycombReading = { input: string; normalized: string; rows: number[][]; layers: HoneycombLayer[] }

const ZONE_LABEL: Record<HoneycombZone, string> = { self: "ตัวเรา", near: "สิ่งแวดล้อมใกล้ตัว", far: "สิ่งแวดล้อมห่างตัว" }
const ZONE_TONE: Record<HoneycombZone, string> = { self: "bg-v3-sapphire", near: "bg-v3-cyan", far: "bg-v3-purple" }

function buildEngineText(r: HoneycombReading): string {
  const lines: string[] = [`เบอร์ ${r.normalized}`]
  const apex = r.layers.find((l) => l.layerNo === 1)
  if (apex?.digitMeaning) lines.push(`ยอดปิรามิด (แก่นเบอร์) เลข ${apex.digitMeaning.digit}: ${apex.digitMeaning.keyword} (${apex.digitMeaning.planet}/${apex.digitMeaning.element})`)
  for (const l of r.layers) {
    if (!l.pairs.length) continue
    const top = l.pairs.slice(0, 3).map((p) => `${p.pair} ${p.meaning.analysis}`).join(" | ")
    lines.push(`ชั้น ${l.layerNo} [${ZONE_LABEL[l.zone]}] ${l.digitString}: ${top}`)
  }
  return lines.join("\n")
}

// พีระมิด: rows[0] = ฐานกว้างสุด (11) … rows[last] = ยอด (1). แสดงฐานบน→ยอดล่าง (สามเหลี่ยมชี้ลง)
function Pyramid({ rows }: { rows: number[][] }) {
  return (
    <div className="flex flex-col items-center gap-1.5 overflow-x-auto" data-testid="honeycomb-pyramid">
      {rows.map((row, i) => (
        <div key={i} className="flex justify-center gap-1.5">
          {row.map((d, j) => (
            <span key={j} className="grid size-7 flex-none place-items-center rounded-full bg-v3-sapphire text-[13px] font-bold text-white shadow-sm">{d}</span>
          ))}
        </div>
      ))}
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

  const canSubmit = phone.replace(/\D/g, "").length >= 9

  const submit = async () => {
    if (!canSubmit || phase === "loading") return
    setPhase("loading"); setError(null); setReading(null); setNarration(null)
    try {
      const res = await fetch("/api/v2/honeycomb", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber: phone }) })
      const j = (await res.json().catch(() => ({}))) as HoneycombReading & { error?: { message?: string } }
      if (!res.ok || !j.layers?.length) {
        setError(j.error?.message || "คำนวณปิรามิดไม่สำเร็จ ลองใหม่อีกครั้ง")
        setPhase("intro")
        return
      }
      setReading(j)
      setPhase("result")
      setNarrating(true)
      void fetch("/api/v2/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engineText: buildEngineText(j), domainLabel: "ทำนายเบอร์รังผึ้ง (เบอร์ปิรามิด)", feature: "phone_reading" }),
      })
        .then((r) => r.json().catch(() => ({})))
        .then((n) => setNarration(typeof n?.text === "string" ? n.text : null))
        .catch(() => setNarration(null))
        .finally(() => setNarrating(false))
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง")
      setPhase("intro")
    }
  }

  const reset = () => { setReading(null); setNarration(null); setError(null); setPhase("intro") }

  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <Head><title>เบอร์รังผึ้ง · MuMate</title></Head>
      <SkyBackdrop height={360} />
      <SkyHeader title="เบอร์รังผึ้ง" backHref="/v2/service" testId="honeycomb" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-40">
        {phase !== "result" && (
          <section className="mt-2 flex flex-col items-center gap-4 rounded-[24px] bg-white p-6 text-center v3-shadow-card" data-testid="honeycomb-intro">
            <p className="text-[18px] font-black text-v3-navy">ถอดรหัสเบอร์แบบปิรามิดรังผึ้ง</p>
            <p className="text-[13px] leading-5 text-v3-text-body">นำเบอร์มาบวกคู่เลขไล่ชั้นจนถึงยอดปิรามิด อ่านพลังของคุณ (ตัวเรา) สิ่งแวดล้อมใกล้ตัว และไกลตัว</p>
            <input
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d\s-]/g, "").slice(0, 15))}
              onKeyDown={(e) => { if (e.key === "Enter") void submit() }}
              placeholder="กรอกเบอร์มือถือ เช่น 0812345678"
              data-testid="honeycomb-input"
              className="w-full rounded-2xl border border-v3-border-card bg-v3-ghost-white px-4 py-3 text-center text-[18px] font-bold tracking-[0.15em] text-v3-navy outline-none focus:border-v3-sapphire"
            />
            {error && <p className="text-[12px] font-bold text-v3-error" data-testid="honeycomb-error">{error}</p>}
            <button type="button" onClick={() => void submit()} disabled={!canSubmit || phase === "loading"} data-testid="honeycomb-submit" className="grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-[15px] font-bold text-white disabled:opacity-40">
              {phase === "loading" ? "กำลังคำนวณ..." : "ทำนายเบอร์รังผึ้ง"}
            </button>
            <p className="text-[11px] text-v3-text-muted">เพื่อความบันเทิงและเป็นแนวทาง</p>
          </section>
        )}

        {phase === "result" && reading && (
          <div className="mt-2 flex flex-col gap-4" data-testid="honeycomb-result">
            <section className="flex flex-col items-center gap-3 rounded-[24px] bg-white p-5 v3-shadow-card">
              <p className="text-[12px] text-v3-text-muted">เบอร์ {reading.normalized}</p>
              <Pyramid rows={reading.rows} />
            </section>

            <section className="rounded-[24px] bg-white p-5 v3-shadow-card" data-testid="honeycomb-ai">
              <h2 className="text-[16px] font-bold text-v3-navy">คำทำนายจากเบอร์รังผึ้ง</h2>
              {narrating && !narration && <p className="mt-2 text-[13px] text-v3-text-muted">กำลังเรียบเรียงคำทำนาย…</p>}
              {narration && <p className="mt-2 whitespace-pre-line text-[14px] leading-6 text-v3-text-body">{narration}</p>}
              {!narrating && !narration && <p className="mt-2 text-[13px] text-v3-text-muted">ดูความหมายรายชั้นด้านล่างได้เลย</p>}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-[16px] font-bold text-v3-navy">ความหมายรายชั้น</h2>
              {reading.layers.map((l) => (
                <div key={l.layerNo} className="rounded-2xl border border-v3-border-card bg-white p-4" data-testid="honeycomb-layer">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 min-w-7 place-items-center rounded-lg bg-v3-ghost-white px-2 text-[13px] font-black text-v3-navy">{l.digitString}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${ZONE_TONE[l.zone]}`}>ชั้น {l.layerNo} · {ZONE_LABEL[l.zone]}</span>
                  </div>
                  {l.digitMeaning && <p className="mt-2 text-[14px] leading-6 text-v3-text-body"><span className="font-bold text-v3-navy">ยอดปิรามิด เลข {l.digitMeaning.digit}:</span> {l.digitMeaning.keyword} · {l.digitMeaning.planet} · ธาตุ{l.digitMeaning.element}</p>}
                  {l.pairs.slice(0, 4).map((p, i) => (
                    p.meaning.analysis ? <p key={i} className="mt-2 text-[13px] leading-5 text-v3-text-body"><span className="font-bold text-v3-navy">{p.pair}:</span> {p.meaning.analysis}</p> : null
                  ))}
                </div>
              ))}
            </section>

            <button type="button" onClick={reset} data-testid="honeycomb-again" className="grid h-12 w-full place-items-center rounded-full border border-v3-border-card bg-white text-[15px] font-bold text-v3-navy">
              ทำนายเบอร์อื่น
            </button>
          </div>
        )}
      </div>

      <Menubar />
    </div>
  )
}

export default HoneycombScreen
