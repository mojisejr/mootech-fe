// pages/v2/element-finder.tsx — "มาหาธาตุแท้กันเถอะ / Bazi Element Finder" (#6 Kittipon 2026-09-21)
// flow 3 จอ: กรอกวันเกิด → loading (หาเสาวัน/ยาม) → ผลธาตุ (มาสคอต+quote+นิสัย+แชร์). login-only (เอ็ม).
// v1 self-designed จาก Figma screenshots (node 1670-69 เข้าตรงไม่ได้). เนื้อหา DRAFT → ซินแสรีวิว.
// คำนวณธาตุจากวันเกิดผ่าน /api/bazi/element-summary → dayMaster(ก้านวัน) → ธาตุ (แม่นกว่าราศีเดือน).
import Head from "next/head"
import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import type { GetServerSideProps } from "next"

import { v2RedirectIfUnauthed } from "@/lib/v2/gate"
import { SkyScreen } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { AuthRequiredCard } from "@/features/auth/components/AuthRequiredCard"
import { useCurrentUser } from "@/lib/auth/use-current-user"
import { ELEMENT_CONTENT, toElementKey, type ElementContent } from "@/features/v2-element-finder/content"
import { stemElementTh, ELEMENT_COLOR } from "@/lib/bazi/element-colors"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

const STEPS = ["อ่านวันเดือนปีเกิด", "หาเสาวัน (日柱) ของคุณ", "หาเสายาม (時柱) จากเวลาเกิด", "สรุปธาตุแท้และนิสัย"]

const ELEMENT_ICONS: { key: keyof typeof ELEMENT_CONTENT; emoji: string }[] = [
  { key: "ไฟ", emoji: "🔥" }, { key: "ไม้", emoji: "🌱" }, { key: "ดิน", emoji: "⛰️" }, { key: "ทอง", emoji: "🪙" }, { key: "น้ำ", emoji: "💧" },
]

export default function ElementFinderPage() {
  const { status: authStatus } = useCurrentUser()
  const [phase, setPhase] = useState<"input" | "loading" | "result">("input")
  const [birthDate, setBirthDate] = useState("") // YYYY-MM-DD (native)
  const [birthTime, setBirthTime] = useState("")
  const [timeUnknown, setTimeUnknown] = useState(false)
  const [result, setResult] = useState<ElementContent | null>(null)
  const [ganzhi, setGanzhi] = useState("") // เสาวัน (60 กะจื่อ) → มาสคอต 60 character
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(0)

  const canSubmit = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) && (timeUnknown || /^\d{2}:\d{2}$/.test(birthTime))

  const run = async () => {
    if (!canSubmit) return
    setPhase("loading"); setError(null); setStep(0)
    const started = Date.now()
    // เดินไล่ checklist ให้ดูมีชีวิต ระหว่างรอ engine
    const timers = STEPS.map((_, i) => window.setTimeout(() => setStep(i + 1), 500 * (i + 1)))
    try {
      const res = await fetch("/api/bazi/element-summary", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: { birthDate, birthTime: timeUnknown ? undefined : birthTime } }),
      })
      const j = (await res.json().catch(() => ({}))) as { summary?: { dayMaster?: string; dayGanzhi?: string; elementTh?: string } | null }
      // ธาตุจากก้านวัน (dayMaster) เป็นหลัก — แม่นกว่า elementTh (เลี่ยง split-brain), fallback elementTh
      const key = toElementKey(stemElementTh(j.summary?.dayMaster) || j.summary?.elementTh)
      await new Promise((r) => setTimeout(r, Math.max(0, 2400 - (Date.now() - started))))
      if (!key) { setError("คำนวณธาตุไม่สำเร็จ ลองตรวจวันเกิดอีกครั้ง"); setPhase("input"); return }
      setGanzhi(j.summary?.dayGanzhi ?? ""); setResult(ELEMENT_CONTENT[key]); setPhase("result")
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง"); setPhase("input")
    } finally { timers.forEach((t) => window.clearTimeout(t)) }
  }

  const reset = () => { setResult(null); setPhase("input") }

  const shareText = result ? `ฉันคือ${result.nameTh} — “${result.quote}” มาเช็คธาตุแท้ของคุณกับ Mumate` : "มาเช็คธาตุแท้ของคุณกับ Mumate"
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/v2/element-finder` : "https://bazichart.mumate.co/v2/element-finder"
  const shareX = () => window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, "_blank", "noopener")
  const shareLine = () => window.open(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`, "_blank", "noopener")

  return (
    <SkyScreen bgImage="/images/v2/fortune/sage-bg.png">
      <Head><title>มาหาธาตุแท้กันเถอะ · MuMate</title></Head>

      {authStatus === "anon" ? (
        <div className="mt-6"><AuthRequiredCard testId="finder-auth" message="เข้าสู่ระบบก่อนเพื่อค้นหาธาตุแท้ของคุณ" /></div>
      ) : authStatus === "loading" ? (
        <p className="mt-10 text-center text-[13px] text-v3-text-body">กำลังเตรียม…</p>
      ) : phase === "input" ? (
        <div className="mt-4 flex flex-col items-center gap-4" data-testid="finder-input">
          <span className="rounded-full bg-v3-sapphire/10 px-3 py-1 text-[11px] font-black tracking-wide text-v3-sapphire">BAZI ELEMENT FINDER</span>
          <h1 className="text-center text-[28px] font-black leading-9 text-v3-navy">มาหาธาตุแท้กันเถอะ</h1>
          <p className="-mt-1 text-center text-[13px] text-v3-text-body">กรอกวันเกิด รู้ธาตุของคุณใน 10 วินาที · คุณจะได้ 1 ใน 5 ธาตุนี้</p>
          <div className="flex flex-wrap justify-center gap-3">
            {ELEMENT_ICONS.map(({ key, emoji }) => (
              <span key={key} className="flex items-center gap-1 text-[13px] font-bold" style={{ color: ELEMENT_COLOR[key] }}><span aria-hidden>{emoji}</span>{key}</span>
            ))}
          </div>

          <section className="v3-shadow-card mt-1 flex w-full max-w-md flex-col gap-3 rounded-[24px] bg-white p-5">
            <label className="text-[13px] font-bold text-v3-navy">วันเกิดของคุณ
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} data-testid="finder-date"
                className="mt-1 w-full rounded-2xl border border-v3-border-card bg-white px-4 py-3 text-[14px] text-v3-navy outline-none focus:border-v3-sapphire" />
            </label>
            <label className={"text-[13px] font-bold text-v3-navy " + (timeUnknown ? "opacity-40" : "")}>เวลาเกิด (ถ้ารู้ จะแม่นขึ้น)
              <input type="time" value={birthTime} disabled={timeUnknown} onChange={(e) => setBirthTime(e.target.value)} data-testid="finder-time"
                className="mt-1 w-full rounded-2xl border border-v3-border-card bg-white px-4 py-3 text-[14px] text-v3-navy outline-none focus:border-v3-sapphire disabled:bg-black/5" />
            </label>
            <label className="flex items-center gap-2 text-[12px] font-medium text-v3-text-body">
              <input type="checkbox" checked={timeUnknown} onChange={(e) => setTimeUnknown(e.target.checked)} data-testid="finder-time-unknown" /> ไม่ทราบเวลาเกิด
            </label>
            {error && <p className="text-center text-[12px] font-bold text-v3-error" data-testid="finder-error">{error}</p>}
            <button type="button" onClick={() => void run()} disabled={!canSubmit} data-testid="finder-submit"
              className="mt-1 grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-[15px] font-bold text-white disabled:opacity-40">เช็คธาตุฉันเลย →</button>
          </section>
          <p className="text-center text-[11px] text-v3-text-muted">ปาจื่อดูธาตุจาก “วันเกิด” ไม่ใช่ราศีเดือนเกิด เลยแม่นกว่าดวงทั่วไป</p>
        </div>
      ) : phase === "loading" ? (
        <div className="mt-10 flex flex-col items-center gap-4 text-center" data-testid="finder-loading">
          <span className="animate-fortune-breathe relative size-40"><Image src="/images/v2/destiny/el-water.png" alt="" fill sizes="160px" className="object-contain" /></span>
          <p className="text-[20px] font-black text-v3-navy">กำลังหาธาตุแท้ของคุณ…</p>
          <section className="v3-shadow-card flex w-full max-w-md flex-col gap-2 rounded-[24px] bg-white p-5 text-left">
            {STEPS.map((s, i) => (
              <p key={s} className={"flex items-center gap-2 text-[14px] " + (i < step ? "font-bold text-v3-navy" : "text-v3-text-muted")}>
                <span aria-hidden>{i < step ? "✅" : "⏳"}</span>{s}
              </p>
            ))}
          </section>
          <p className="max-w-xs text-[11px] text-v3-text-muted">ปาจื่อดูธาตุจาก “วันเกิด” ไม่ใช่ราศีเดือนเกิด เลยแม่นกว่าดวงทั่วไป</p>
        </div>
      ) : result ? (
        <div className="mt-3 flex flex-col items-center gap-3" data-testid="finder-result">
          <div className="rounded-2xl bg-white px-4 py-2 text-center text-[14px] font-bold text-v3-navy shadow-sm">“{result.quote}”</div>
          {/* มาสคอต 60 character ตามเสาวัน (60 กะจื่อ) — เช่นระกา+ทอง; โหลดไม่ขึ้นถอยไปมาสคอตธาตุรวม */}
          <span className="relative size-44">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ganzhi ? `/api/bazi-mascot?ganzhi=${encodeURIComponent(ganzhi)}` : result.mascot}
              alt={result.nameTh}
              className="size-full object-contain drop-shadow"
              onError={(e) => { const img = e.currentTarget; if (!img.dataset.fb) { img.dataset.fb = "1"; img.src = result.mascot } }}
            />
          </span>
          <div className="text-center">
            <p className="text-[30px] font-black" style={{ color: ELEMENT_COLOR[result.key] }}>{result.nameTh}</p>
            <p className="text-[12px] font-black tracking-widest text-v3-text-muted">{result.nameEn}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {result.traits.map((t) => (
              <span key={t} className="rounded-full px-4 py-1.5 text-[12px] font-bold" style={{ background: `${ELEMENT_COLOR[result.key]}1A`, color: ELEMENT_COLOR[result.key] }}>{t}</span>
            ))}
          </div>
          <p className="max-w-md text-center text-[13px] leading-[22px] text-v3-text-body">{result.description}</p>

          {/* login-only → CTA ภายในไปดวงเต็ม (แทน "แอด LINE OA" ที่ออกแบบไว้สำหรับ public) */}
          <Link href="/v2/destiny" className="mt-1 flex w-full max-w-md items-center justify-between rounded-2xl bg-v3-sapphire/10 p-4" data-testid="finder-cta">
            <span className="text-[13px] font-bold text-v3-navy">อยากรู้ลึกกว่านี้? ดูดวงเต็มของคุณ</span>
            <span className="rounded-full bg-v3-sapphire px-4 py-2 text-[13px] font-bold text-white">ดูเลย →</span>
          </Link>

          <p className="mt-1 text-[13px] font-bold text-v3-navy">แชร์ผลลัพธ์นี้ให้เพื่อนเช็คมั่ง</p>
          <div className="flex w-full max-w-md gap-2">
            <button onClick={shareX} data-testid="finder-share-x" className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-black text-[14px] font-bold text-white">𝕏 แชร์ลง X</button>
            <button onClick={shareLine} data-testid="finder-share-line" className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#06C755] text-[14px] font-bold text-white">แชร์ลง LINE</button>
          </div>
          <button onClick={reset} className="mt-1 text-[13px] font-bold text-v3-sapphire" data-testid="finder-again">เช็คธาตุคนอื่นอีกครั้ง</button>
        </div>
      ) : null}
      <Menubar />
    </SkyScreen>
  )
}
