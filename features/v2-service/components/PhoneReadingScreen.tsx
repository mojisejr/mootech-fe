// features/v2-service/components/PhoneReadingScreen.tsx — /v2/service/phone-number
// "ดูดวงเบอร์มือถือ" (เลขศาสตร์) — กรอกเบอร์ → engine /api/v2/phone-reading (deterministic คู่เลข/ความหมาย)
// + คำทำนายร้อยแก้วจาก AI (/api/v2/narrate). เบอร์กรอกเองทุกครั้ง (ไม่ผูก profile). Figma 55666-1122.
import Head from "next/head"
import { useState } from "react"

import { SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"

// ── shapes (ตรงกับ engine PhoneReading) ──
type PairMeaning = { pair: string; feeling: string; work: string; money: string; love: string; analysis: string }
type PhonePair = { pair: string; key: string; a: number; b: number; position: number; zone: "front" | "back"; weight: number; meaning: PairMeaning }
type DigitTally = { digit: number; planet: string; element: string; keyword: string; count: number }
type PhoneReading = { input: string; normalized: string; pairs: PhonePair[]; closing: PhonePair; digitTally: DigitTally[] }

const ZONE_LABEL: Record<"front" | "back", string> = { front: "รู้หน้า (การแสดงออก)", back: "รู้ใจ (ตัวตนภายใน)" }

// สร้าง engine-truth ให้ AI เกลา — คงตัวเลข/ความหมายครบ ไม่แต่งเพิ่ม
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

function PairCard({ p, closing }: { p: PhonePair; closing: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${closing ? "border-v3-sapphire bg-v3-sapphire/5" : "border-v3-border-card bg-white"}`} data-testid="phone-pair">
      <div className="flex items-center gap-2">
        <span className={`grid h-9 min-w-9 place-items-center rounded-lg px-2 text-[16px] font-black ${closing ? "bg-v3-sapphire text-white" : "bg-v3-ghost-white text-v3-navy"}`}>{p.pair}</span>
        <span className="text-[12px] font-medium text-v3-text-muted">{ZONE_LABEL[p.zone]}</span>
        {closing && <span className="ml-auto rounded-full bg-v3-lime px-2 py-0.5 text-[11px] font-bold text-v3-navy">คู่ปิดท้าย · เด่นสุด</span>}
      </div>
      {p.meaning.analysis && <p className="mt-2 text-[14px] leading-6 text-v3-text-body">{p.meaning.analysis}</p>}
      <div className="mt-2 flex flex-col gap-1 text-[12px] leading-5 text-v3-text-muted">
        {p.meaning.work && <p><span className="font-bold text-v3-navy">งาน:</span> {p.meaning.work}</p>}
        {p.meaning.money && <p><span className="font-bold text-v3-navy">เงิน:</span> {p.meaning.money}</p>}
        {p.meaning.love && <p><span className="font-bold text-v3-navy">ความรัก:</span> {p.meaning.love}</p>}
      </div>
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

  const canSubmit = phone.replace(/\D/g, "").length >= 9

  const submit = async () => {
    if (!canSubmit || phase === "loading") return
    setPhase("loading")
    setError(null)
    setReading(null)
    setNarration(null)
    try {
      const res = await fetch("/api/v2/phone-reading", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber: phone }) })
      const j = (await res.json().catch(() => ({}))) as PhoneReading & { error?: string }
      if (!res.ok || !j.pairs?.length) {
        setError(j.error || "ทำนายเบอร์ไม่สำเร็จ ลองใหม่อีกครั้ง")
        setPhase("intro")
        return
      }
      setReading(j)
      setPhase("result")
      // คำทำนาย AI — ยิงหลังได้ผล deterministic (ช้ากว่า) โชว์การ์ดโหลดระหว่างรอ
      setNarrating(true)
      void fetch("/api/v2/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engineText: buildEngineText(j), domainLabel: "ทำนายเบอร์มือถือ", feature: "phone_reading" }),
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
      <Head><title>ดูดวงเบอร์มือถือ · MuMate</title></Head>
      <SkyBackdrop height={360} />
      <SkyHeader title="ดูดวงเบอร์มือถือ" backHref="/v2/service" testId="phone-reading" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-40">
        {phase !== "result" && (
          <section className="mt-2 flex flex-col items-center gap-4 rounded-[24px] bg-white p-6 text-center v3-shadow-card" data-testid="phone-intro">
            <p className="text-[18px] font-black text-v3-navy">ถอดพลังตัวเลขในเบอร์ของคุณ</p>
            <p className="text-[13px] leading-5 text-v3-text-body">วิเคราะห์คู่เลขในเบอร์ตามหลักเลขศาสตร์ บอกพลังด้านการงาน เงิน ความรัก แล้วสรุปเป็นคำทำนายให้อ่านง่าย</p>
            <input
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d\s-]/g, "").slice(0, 15))}
              onKeyDown={(e) => { if (e.key === "Enter") void submit() }}
              placeholder="กรอกเบอร์มือถือ เช่น 0812345678"
              data-testid="phone-input"
              className="w-full rounded-2xl border border-v3-border-card bg-v3-ghost-white px-4 py-3 text-center text-[18px] font-bold tracking-[0.15em] text-v3-navy outline-none focus:border-v3-sapphire"
            />
            {error && <p className="text-[12px] font-bold text-v3-error" data-testid="phone-error">{error}</p>}
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit || phase === "loading"}
              data-testid="phone-submit"
              className="grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-[15px] font-bold text-white disabled:opacity-40"
            >
              {phase === "loading" ? "กำลังทำนาย..." : "ทำนายเบอร์"}
            </button>
            <p className="text-[11px] text-v3-text-muted">อ้างอิงตำรา “ทำนายชีวิตด้วยเบอร์มือถือ” โดยครูเอก · เพื่อความบันเทิงและเป็นแนวทาง</p>
          </section>
        )}

        {phase === "result" && reading && (
          <div className="mt-2 flex flex-col gap-4" data-testid="phone-result">
            <section className="flex flex-col items-center gap-1 rounded-[24px] bg-v3-sapphire px-4 py-5 text-center text-white">
              <p className="text-[12px] text-white/80">เบอร์ที่ทำนาย</p>
              <p className="text-[24px] font-black tracking-[0.12em]">{reading.normalized}</p>
            </section>

            {/* คำทำนาย AI */}
            <section className="rounded-[24px] bg-white p-5 v3-shadow-card" data-testid="phone-ai">
              <h2 className="text-[16px] font-bold text-v3-navy">คำทำนายจากเบอร์ของคุณ</h2>
              {narrating && !narration && <p className="mt-2 text-[13px] text-v3-text-muted">กำลังเรียบเรียงคำทำนาย…</p>}
              {narration && <p className="mt-2 whitespace-pre-line text-[14px] leading-6 text-v3-text-body">{narration}</p>}
              {!narrating && !narration && <p className="mt-2 text-[13px] text-v3-text-muted">ดูรายละเอียดคู่เลขด้านล่างได้เลย</p>}
            </section>

            {/* คู่เลข */}
            <section className="flex flex-col gap-3">
              <h2 className="text-[16px] font-bold text-v3-navy">ความหมายคู่เลข</h2>
              {reading.pairs.map((p, i) => <PairCard key={`${p.pair}-${i}`} p={p} closing={p.position === reading.closing.position} />)}
            </section>

            {/* เลขเด่น */}
            <section className="rounded-[24px] bg-white p-5 v3-shadow-card">
              <h2 className="text-[16px] font-bold text-v3-navy">เลขเด่นในเบอร์</h2>
              <div className="mt-3 flex flex-col gap-2">
                {reading.digitTally.map((d) => (
                  <div key={d.digit} className="flex items-center gap-3 border-b border-dashed border-v3-divider-dashed pb-2 last:border-0 last:pb-0">
                    <span className="grid size-9 place-items-center rounded-lg bg-v3-ghost-white text-[16px] font-black text-v3-navy">{d.digit}</span>
                    <span className="min-w-0 flex-1 text-[13px] leading-5 text-v3-text-body">{d.keyword} · {d.planet} · ธาตุ{d.element}</span>
                    <span className="text-[12px] font-bold text-v3-text-muted">×{d.count}</span>
                  </div>
                ))}
              </div>
            </section>

            <button type="button" onClick={reset} data-testid="phone-again" className="grid h-12 w-full place-items-center rounded-full border border-v3-border-card bg-white text-[15px] font-bold text-v3-navy">
              ทำนายเบอร์อื่น
            </button>
          </div>
        )}
      </div>

      <Menubar />
    </div>
  )
}

export default PhoneReadingScreen
