// pages/v2/element-finder.tsx — "มาหาธาตุแท้กันเถอะ / Bazi Element Finder" (#6 Kittipon 2026-09-21)
// flow 3 จอ: กรอกวันเกิด → loading → ผลธาตุ (มาสคอต 60 การ์ด + quote + นิสัย + แชร์). login-only.
// มาสคอต = การ์ด 60 character (นักษัตร×ธาตุ) แบบเดียวกับหน้า "ธาตุของคุณ" (resolveMascotFromCompute →
// /images/v2/cards/NN_นักษัตร-ธาตุ.jpg). คำนวณจากวันเกิดที่กรอกผ่าน /api/calculator/compute.
// gender ไม่กระทบมาสคอต/ธาตุ (แค่ facets ที่ไม่ใช้) → default MALE. แชร์ = shareAsInvite เหมือนจอผลอื่น.
import Head from "next/head"
import Link from "next/link"
import Image from "next/image"
import { useRef, useState } from "react"
import type { GetServerSideProps } from "next"

import { v2RedirectIfUnauthed } from "@/lib/v2/gate"
import { SkyScreen } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { AuthRequiredCard } from "@/features/auth/components/AuthRequiredCard"
import { useCurrentUser } from "@/lib/auth/use-current-user"
import { ELEMENT_CONTENT, toElementKey, type ElementContent } from "@/features/v2-element-finder/content"
import { WallpaperCard, WallpaperStage } from "@/features/v2-element-finder/WallpaperCard"
import { pickWallpaper, type WallpaperPick } from "@/features/v2-element-finder/wallpaper"
import { ELEMENT_COLOR } from "@/lib/bazi/element-colors"
import { resolveMascotFromCompute, type ComputeMascotSource } from "@/lib/personalization/mascot"
import { shareAsInvite } from "@/lib/v2/share-invite"
import { issueNonce, NONCE_COOKIE } from "@/lib/calculator/nonce"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  // /api/calculator/compute ต้องมี nonce cookie (lib/calculator/nonce.ts) — ออกตอนโหลดหน้าเหมือน /calculator
  const nonce = issueNonce()
  ctx.res.setHeader("Set-Cookie", `${NONCE_COOKIE}=${nonce}; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=600`)
  return { props: {} }
}

const STEPS = ["อ่านวันเดือนปีเกิด", "หาเสาวัน (日柱) ของคุณ", "หาเสายาม (時柱) จากเวลาเกิด", "สรุปธาตุแท้และนิสัย"]
// ใช้ไอคอนธาตุของเรา (/images/v2/destiny/el-*.png ผ่าน ELEMENT_CONTENT[key].mascot) แทน emoji
// — emoji ทอง 🪙 ขึ้น □ (ไม่มี glyph ในบางเครื่อง) · ชุดนี้ครบ 5 ธาตุ สม่ำเสมอกับทั้งแอป (เอ็ม 2026-09-22)
const ELEMENT_ICON_ORDER: (keyof typeof ELEMENT_CONTENT)[] = ["ไฟ", "ไม้", "ดิน", "ทอง", "น้ำ"]

export default function ElementFinderPage() {
  const { status: authStatus } = useCurrentUser()
  const [phase, setPhase] = useState<"input" | "loading" | "result">("input")
  const [birthDate, setBirthDate] = useState("")
  const [birthTime, setBirthTime] = useState("")
  const [timeUnknown, setTimeUnknown] = useState(false)
  const [result, setResult] = useState<ElementContent | null>(null)
  const [character, setCharacter] = useState<string>("") // การ์ด 60 โปร่งใส (สำหรับซ้อนบน wallpaper)
  const [wallpaper, setWallpaper] = useState<WallpaperPick | null>(null) // { bg, text } ที่สุ่มไว้
  const [saving, setSaving] = useState(false)
  const wallpaperRef = useRef<HTMLDivElement>(null) // ใบ 540px ซ่อนนอกจอ → html2canvas จับ
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(0)

  const canSubmit = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) && (timeUnknown || /^\d{2}:\d{2}$/.test(birthTime))

  const run = async () => {
    if (!canSubmit) return
    setPhase("loading"); setError(null); setStep(0)
    const started = Date.now()
    const timers = STEPS.map((_, i) => window.setTimeout(() => setStep(i + 1), 550 * (i + 1)))
    try {
      const res = await fetch("/api/calculator/compute", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dob: birthDate, time: timeUnknown ? "" : birthTime, gender: "MALE" }),
      })
      const body = (await res.json().catch(() => ({}))) as { data?: unknown }
      const mascot = res.ok ? resolveMascotFromCompute(body.data as ComputeMascotSource) : null // นักษัตร×ธาตุ → การ์ด+ธาตุ
      const key = mascot ? toElementKey(mascot.elementTh) : null
      await new Promise((r) => setTimeout(r, Math.max(0, 2600 - (Date.now() - started))))
      if (!mascot || !key) { setError("คำนวณธาตุไม่สำเร็จ ลองตรวจวันเกิดอีกครั้ง"); setPhase("input"); return }
      setCharacter(mascot.character); setWallpaper(pickWallpaper(key))
      setResult(ELEMENT_CONTENT[key]); setPhase("result")
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง"); setPhase("input")
    } finally { timers.forEach((t) => window.clearTimeout(t)) }
  }

  const reset = () => { setResult(null); setCharacter(""); setWallpaper(null); setPhase("input") }

  // สุ่มลุคใหม่ — BG (ในธาตุเดิม) + Text ใหม่ ตามสเปก Kittipon/gafiw
  const shuffle = () => { if (result) setWallpaper(pickWallpaper(result.key)) }

  // ประกอบ wallpaper (BG+Character+Text) จากใบ 540px ซ่อนนอกจอ → PNG blob
  const renderWallpaperBlob = async (): Promise<Blob | null> => {
    const node = wallpaperRef.current
    if (!node) return null
    const html2canvas = (await import("html2canvas")).default
    const canvas = await html2canvas(node, { backgroundColor: null, scale: 2, useCORS: true })
    return await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/png"))
  }

  // บันทึก wallpaper ลงเครื่อง
  const download = async () => {
    if (!wallpaper || saving) return
    setSaving(true)
    try {
      const blob = await renderWallpaperBlob()
      if (!blob) { setError("บันทึกภาพไม่สำเร็จ ลองใหม่อีกครั้ง"); return }
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a"); a.href = url; a.download = "mumate-wallpaper.png"
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } finally { setSaving(false) }
  }

  // แชร์ wallpaper ที่ประกอบแล้ว (แนบไฟล์ภาพจริง) — เอ็ม/gafiw 2026-09-22
  const share = async () => {
    if (!result || saving) return
    setSaving(true)
    try {
      const blob = await renderWallpaperBlob()
      const file = blob ? new File([blob], "mumate-wallpaper.png", { type: "image/png" }) : null
      await shareAsInvite({
        title: "มาหาธาตุแท้กันเถอะ",
        text: `ฉันคือ${result.nameTh} — “${result.quote}” มาเช็คธาตุแท้ของคุณกับ Mumate`,
        file,
      })
    } finally { setSaving(false) }
  }

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
            {ELEMENT_ICON_ORDER.map((key) => (
              <span key={key} className="flex items-center gap-1 text-[13px] font-bold" style={{ color: ELEMENT_COLOR[key] }}>
                <Image src={ELEMENT_CONTENT[key].mascot} alt="" width={22} height={22} className="size-[22px] object-contain" />{key}
              </span>
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

          {/* wallpaper ที่ประกอบแล้ว (BG ตามธาตุ + Character การ์ด 60 + Text สุ่ม) — พรีวิว + ปุ่มสุ่ม/บันทึก */}
          {wallpaper && character && (
            <>
              <div className="overflow-hidden rounded-[20px] shadow-[0_8px_24px_rgba(11,48,91,0.18)]" data-testid="finder-wallpaper">
                <WallpaperCard bg={wallpaper.bg} character={character} text={wallpaper.text} width={300} />
              </div>
              <button type="button" onClick={shuffle} data-testid="finder-shuffle" className="text-[13px] font-bold text-v3-sapphire">🎲 สุ่มลุคใหม่</button>
              {/* ใบเต็ม 540px ซ่อนนอกจอ → html2canvas จับเป็นภาพคมชัด */}
              <WallpaperStage>
                <WallpaperCard ref={wallpaperRef} bg={wallpaper.bg} character={character} text={wallpaper.text} width={540} />
              </WallpaperStage>
            </>
          )}
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

          <Link href="/v2/destiny" className="mt-1 flex w-full max-w-md items-center justify-between rounded-2xl bg-v3-sapphire/10 p-4" data-testid="finder-cta">
            <span className="text-[13px] font-bold text-v3-navy">อยากรู้ลึกกว่านี้? ดูดวงเต็มของคุณ</span>
            <span className="rounded-full bg-v3-sapphire px-4 py-2 text-[13px] font-bold text-white">ดูเลย →</span>
          </Link>

          <button onClick={() => void download()} disabled={saving} data-testid="finder-download" className="mt-1 flex h-12 w-full max-w-md items-center justify-center gap-2 rounded-full bg-v3-sapphire text-[15px] font-bold text-white disabled:opacity-50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            {saving ? "กำลังบันทึก…" : "บันทึก wallpaper"}
          </button>
          <button onClick={() => void share()} disabled={saving} data-testid="finder-share" className="flex h-11 w-full max-w-md items-center justify-center gap-2 rounded-full border border-v3-sapphire text-[14px] font-bold text-v3-sapphire disabled:opacity-50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
            แชร์ให้เพื่อนเช็คมั่ง
          </button>
          <button onClick={reset} className="mt-1 text-[13px] font-bold text-v3-sapphire" data-testid="finder-again">เช็คธาตุคนอื่นอีกครั้ง</button>
        </div>
      ) : null}
      <Menubar />
    </SkyScreen>
  )
}
