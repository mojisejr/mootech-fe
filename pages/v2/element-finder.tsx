// pages/v2/element-finder.tsx — "มาหาธาตุแท้กันเถอะ / Bazi Element Finder" (#6 Kittipon 2026-09-21)
// flow 3 จอ: กรอกวันเกิด → loading → ผลธาตุ (wallpaper + แชร์). **ไม่ต้อง login** (เอ็ม 2026-09-23) —
// เป็นหน้าเชิญชวน (viral) ใครก็เช็คได้. มาสคอต = การ์ด 60 (นักษัตร×ธาตุ) จาก resolveMascotFromCompute.
// คำนวณผ่าน /api/calculator/compute (ต้องมี nonce cookie). แชร์ = Twitter/X intent อย่างเดียว.
import Head from "next/head"
import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import type { GetServerSideProps } from "next"

import { SkyScreen } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { ELEMENT_CONTENT, toElementKey, type ElementContent } from "@/features/v2-element-finder/content"
import { WallpaperCard, WallpaperStage } from "@/features/v2-element-finder/WallpaperCard"
import { pickWallpaper, type WallpaperPick } from "@/features/v2-element-finder/wallpaper"
import { ELEMENT_COLOR } from "@/lib/bazi/element-colors"
import { resolveMascotFromCompute, type ComputeMascotSource } from "@/lib/personalization/mascot"
import { openInExternalBrowser, isLineInAppBrowser } from "@/lib/line/liff"
import { issueNonce, NONCE_COOKIE } from "@/lib/calculator/nonce"

// ธาตุ (en) → ชื่อไทย + ไอคอนตัวแทน (ใช้ทำ Twitter/OG card ตอนแชร์ ?el=)
const EL_OG: Record<string, { th: string; img: string }> = {
  fire: { th: "ธาตุไฟ", img: "/images/v2/destiny/el-fire.png" },
  wood: { th: "ธาตุไม้", img: "/images/v2/destiny/el-wood.png" },
  earth: { th: "ธาตุดิน", img: "/images/v2/destiny/el-earth.png" },
  metal: { th: "ธาตุทอง", img: "/images/v2/destiny/el-metal.png" },
  water: { th: "ธาตุน้ำ", img: "/images/v2/destiny/el-water.png" },
}
type FinderProps = { ogImage: string; ogTitle: string; ogDesc: string; pageUrl: string }

export const getServerSideProps: GetServerSideProps<FinderProps> = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  // ไม่มี v2 gate/login — หน้านี้เปิดให้ทุกคนใช้ (viral). /api/calculator/compute ต้องมี nonce cookie เท่านั้น.
  const nonce = issueNonce()
  ctx.res.setHeader("Set-Cookie", `${NONCE_COOKIE}=${nonce}; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=600`)
  // Twitter/OG card: แชร์ ?el=<ธาตุ> → card เฉพาะธาตุ (ผ่าน /api/og/share); ไม่มี el → การ์ดแบรนด์ทั่วไป
  const proto = (ctx.req.headers["x-forwarded-proto"] as string)?.split(",")[0] || "https"
  const origin = `${proto}://${ctx.req.headers.host ?? "bazichart.mumate.co"}`
  const str = (v: unknown): string => (typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? "") : "")
  const el = str(ctx.query.el)
  const meta = EL_OG[el] ?? null
  const ogTitle = meta ? `ฉันคือ${meta.th} · มาหาธาตุแท้กันเถอะ` : "มาหาธาตุแท้กันเถอะ · MuMate"
  const ogDesc = "เช็คธาตุแท้จากวันเกิด รู้ใน 10 วิ พร้อมนิสัย & wallpaper — กับ Mumate"
  // ลำดับความสำคัญ: (1) มี bg/ch/txt → การ์ด "wallpaper เต็มใบ" (/api/og/finder), (2) มี el → การ์ดธาตุ static, (3) default
  const bg = str(ctx.query.bg), ch = str(ctx.query.ch), txt = str(ctx.query.txt)
  const ogImage =
    bg && ch && txt
      ? `${origin}/api/og/finder?${new URLSearchParams({ bg, ch, txt }).toString()}`
      : meta
        ? `${origin}/images/v2/og/finder-${el}.png`
        : `${origin}/images/v2/features/13_มาหาธาตุแท้.png`
  const pageUrl = `${origin}${ctx.resolvedUrl}`
  return { props: { ogImage, ogTitle, ogDesc, pageUrl } }
}

const STEPS = ["อ่านวันเดือนปีเกิด", "หาเสาวัน (日柱) ของคุณ", "หาเสายาม (時柱) จากเวลาเกิด", "สรุปธาตุแท้และนิสัย"]
// ใช้ไอคอนธาตุของเรา (/images/v2/destiny/el-*.png ผ่าน ELEMENT_CONTENT[key].mascot) แทน emoji
// — emoji ทอง 🪙 ขึ้น □ (ไม่มี glyph ในบางเครื่อง) · ชุดนี้ครบ 5 ธาตุ สม่ำเสมอกับทั้งแอป (เอ็ม 2026-09-22)
const ELEMENT_ICON_ORDER: (keyof typeof ELEMENT_CONTENT)[] = ["ไฟ", "ไม้", "ดิน", "ทอง", "น้ำ"]

// วันเกิด = ค.ศ. "YYYY-MM-DD" จาก <input type="date"> (ปฏิทินมือถือ) — ไม่ต้อง parse เอง
const TODAY_ISO = new Date().toLocaleDateString("en-CA") // จำกัด max ไม่ให้เลือกอนาคต

// ป้าย FREE แบบ icon (starburst 8 แฉก แดง + FREE ขาว) — เป็น SVG จึงไม่ตกบรรทัด/ไม่พึ่งฟอนต์นอก
function FreeBadge() {
  return (
    <svg width="42" height="42" viewBox="0 0 64 64" aria-hidden className="shrink-0 drop-shadow-[0_2px_3px_rgba(0,0,0,0.28)]">
      <g transform="rotate(-8 32 32)">
        <rect x="10" y="10" width="44" height="44" rx="9" fill="#ef3b3b" />
        <rect x="10" y="10" width="44" height="44" rx="9" fill="#ef3b3b" transform="rotate(45 32 32)" />
        <text x="32" y="34" fill="#fff" fontSize="15" fontWeight="900" textAnchor="middle" dominantBaseline="middle" fontFamily="system-ui, Arial, sans-serif" style={{ letterSpacing: "0.5px" }}>FREE</text>
      </g>
    </svg>
  )
}

export default function ElementFinderPage({ ogImage, ogTitle, ogDesc, pageUrl }: FinderProps) {
  const [phase, setPhase] = useState<"input" | "loading" | "result">("input")
  const [birthDate, setBirthDate] = useState("") // "YYYY-MM-DD" (ค.ศ.) จากปฏิทิน
  const [birthTime, setBirthTime] = useState("")
  const [timeUnknown, setTimeUnknown] = useState(false)
  const [result, setResult] = useState<ElementContent | null>(null)
  const [character, setCharacter] = useState<string>("") // การ์ด 60 โปร่งใส (สำหรับซ้อนบน wallpaper)
  const [wallpaper, setWallpaper] = useState<WallpaperPick | null>(null) // { bg, text } ที่สุ่มไว้
  const [saving, setSaving] = useState(false)
  const [copyHint, setCopyHint] = useState(false) // แชร์ X: คัดลอกรูปแล้ว → บอกให้ "แตะค้าง→วาง" ในโพสต์ X
  const [saveImg, setSaveImg] = useState<string | null>(null) // LINE: โชว์รูปให้กดค้างบันทึก (<a download> ถูกบล็อก)
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

  // บันทึก wallpaper ลงเครื่อง — LINE in-app browser บล็อก <a download> → โชว์รูปให้ "กดค้างเพื่อบันทึก" แทน
  const download = async () => {
    if (!wallpaper || saving) return
    setSaving(true)
    try {
      const blob = await renderWallpaperBlob()
      if (!blob) { setError("บันทึกภาพไม่สำเร็จ ลองใหม่อีกครั้ง"); return }
      const url = URL.createObjectURL(blob)
      if (isLineInAppBrowser()) {
        setSaveImg(url) // เปิด overlay รูปเดี่ยว → ผู้ใช้กดค้างที่รูปเพื่อบันทึก (ไม่ revoke จนปิด overlay)
        return
      }
      const a = document.createElement("a"); a.href = url; a.download = "mumate-wallpaper.png"
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } finally { setSaving(false) }
  }

  const closeSaveImg = () => { if (saveImg) URL.revokeObjectURL(saveImg); setSaveImg(null) }

  // แชร์ลง X พร้อม wallpaper แนวตั้งเต็มใบ (เอ็ม 2026-09-23). ข้อจำกัด X: การ์ดลิงก์บังคับแนวนอน 1.91:1 เสมอ
  //   (รูปแนวตั้งโดนใส่กรอบขอบข้าง). วิธีเดียวที่ได้ "รูปแนวตั้งเต็มจริง" ในโพสต์ = แนบไฟล์รูปจริง.
  // (1) Web Share sheet (navigator.share files) = ตัวหลัก — แตะ X ในชีต → รูปแนวตั้งแนบให้อัตโนมัติ (ไม่ต้องวางเอง).
  // (2) เครื่องแชร์ไฟล์ไม่ได้ (เช่น desktop) แต่คัดลอกรูปได้ → คัดลอก wallpaper + เปิด X ให้ "วาง" (มี toast บอก).
  // (3) ไม่รองรับเลย/LINE in-app → X intent (การ์ดพรีวิวแนวนอน — เป็น fallback สุดท้ายเท่านั้น).
  const shareX = async () => {
    if (!result || saving) return
    const text = `ฉันคือ${result.nameTh} — “${result.quote}” มาเช็คธาตุแท้ของคุณกับ Mumate`
    const p = new URLSearchParams()
    if (wallpaper?.bg && character && wallpaper?.text) { p.set("bg", wallpaper.bg); p.set("ch", character); p.set("txt", wallpaper.text) }
    const finderUrl = `https://bazichart.mumate.co/v2/element-finder${p.toString() ? `?${p.toString()}` : ""}`
    const webIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(finderUrl)}`

    setSaving(true)
    let blob: Blob | null = null
    try { blob = await renderWallpaperBlob() } catch { /* ประกอบรูปไม่ได้ */ }
    setSaving(false)

    // (1) Web Share sheet — แนบรูปแนวตั้งอัตโนมัติ (แตะ X ในชีตแล้วรูปติดไปเลย ไม่ต้องวางเอง) = วิธีที่ได้รูปตั้งจริง
    try {
      if (blob && typeof navigator !== "undefined" && typeof navigator.canShare === "function") {
        const file = new File([blob], "mumate-wallpaper.png", { type: "image/png" })
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return }
      }
    } catch {
      /* ผู้ใช้ยกเลิก/ไม่รองรับ → ลองคัดลอก/ถอยไป intent */
    }

    // (2) แชร์ไฟล์ไม่ได้ แต่คัดลอกรูปได้ (desktop) → คัดลอก wallpaper + เปิด X ให้ "วาง"
    const canCopyImg = typeof navigator !== "undefined" && !!navigator.clipboard && typeof window !== "undefined" && "ClipboardItem" in window
    if (blob && canCopyImg && !isLineInAppBrowser()) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
        setCopyHint(true); window.setTimeout(() => setCopyHint(false), 8000)
        void openInExternalBrowser(webIntent)
        return
      } catch {
        /* คัดลอกไม่ได้ → intent */
      }
    }

    // (3) fallback สุดท้าย: X intent (การ์ดพรีวิวแนวนอน)
    void openInExternalBrowser(webIntent)
  }

  // ขนาด wallpaper preview แบบ responsive — ขยายให้เต็มความสูงจอที่เหลือ (ไม่เหลือช่องว่างล่าง / ไม่ต้องเลื่อน)
  const [wpW, setWpW] = useState(220)
  useEffect(() => {
    const calc = () => {
      const avail = window.innerHeight - 330 // เผื่อ โลโก้ + CTA + ปุ่มแชร์/บันทึก + เมนูล่าง
      setWpW(Math.round(Math.min(300, Math.max(170, (avail * 9) / 16))))
    }
    calc()
    window.addEventListener("resize", calc)
    return () => window.removeEventListener("resize", calc)
  }, [])

  return (
    <SkyScreen bgImage="/images/v2/fortune/sage-bg.png">
      <Head>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDesc} />
        {/* Twitter/OG card — ให้ "แชร์ลง X" มีรูปตามไป (per-element เมื่อลิงก์มี ?el=) */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:site_name" content="MuMate" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDesc} />
        <meta name="twitter:image" content={ogImage} />
      </Head>

      {phase === "input" ? (
        <div className="mt-2 flex flex-col items-center gap-3" data-testid="finder-input">
          {/* โลโก้ muMate */}
          <Image src="/images/v2/logo/splash-logo.png" alt="Mumate" width={148} height={36} priority className="mt-1 h-9 w-auto object-contain" />
          {/* HERO — ตัวละครโปร่งใส (cutout) ขนาดพอดี ไม่ใช่ฉาก bg (เอ็ม 2026-09-22 "เอาตัวละคร ไม่ต้องใหญ่") + ธาตุลอยรอบ */}
          <div className="relative mt-1 h-[190px] w-full max-w-[280px]">
            <Image src="/images/v2/mascot/01.webp" alt="" fill sizes="200px" priority className="object-contain" />
            <Image src={ELEMENT_CONTENT["ไม้"].mascot} alt="" width={38} height={38} className="absolute left-0 top-4 size-9 object-contain drop-shadow" />
            <Image src={ELEMENT_CONTENT["ไฟ"].mascot} alt="" width={40} height={40} className="absolute right-0 top-2 size-10 object-contain drop-shadow" />
            <Image src={ELEMENT_CONTENT["น้ำ"].mascot} alt="" width={34} height={34} className="absolute left-1 top-1/2 size-[34px] object-contain drop-shadow" />
            <Image src={ELEMENT_CONTENT["ดิน"].mascot} alt="" width={34} height={34} className="absolute bottom-3 left-3 size-[34px] object-contain drop-shadow" />
            <Image src={ELEMENT_CONTENT["ทอง"].mascot} alt="" width={36} height={36} className="absolute bottom-2 right-2 size-9 object-contain drop-shadow" />
          </div>

          <span className="rounded-full bg-v3-sapphire/10 px-3 py-1 text-[11px] font-black tracking-wide text-v3-sapphire">BAZI ELEMENT FINDER</span>
          <h1 className="text-center text-[27px] font-black leading-9 text-v3-navy">มาหาธาตุแท้กันเถอะ</h1>
          <p className="-mt-1.5 text-center text-[13px] leading-5 text-v3-text-body">กรอกวันเกิด รู้ธาตุของคุณใน 10 วินาที</p>
          <p className="-mt-2 text-center text-[12px] font-medium text-v3-text-muted">คุณจะได้ 1 ใน 5 ธาตุนี้</p>
          <div className="flex flex-wrap justify-center gap-3">
            {ELEMENT_ICON_ORDER.map((key) => (
              <span key={key} className="flex items-center gap-1 text-[13px] font-bold" style={{ color: ELEMENT_COLOR[key] }}>
                <Image src={ELEMENT_CONTENT[key].mascot} alt="" width={22} height={22} className="size-[22px] object-contain" />{key}
              </span>
            ))}
          </div>

          <section className="v3-shadow-card mt-1 flex w-full max-w-md flex-col gap-4 rounded-[24px] bg-white p-5">
            {/* วันเกิด — เลือกจากปฏิทินในมือถือ (ไม่ต้องพิมพ์เอง) เอ็ม 2026-09-23 */}
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-v3-navy">วันเกิดของคุณ
              <input
                type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)}
                min="1900-01-01" max={TODAY_ISO} aria-label="วันเกิด" data-testid="finder-date"
                className="w-full rounded-2xl border border-v3-border-card bg-white px-4 py-3 text-[15px] font-medium text-v3-navy outline-none focus:border-v3-sapphire"
              />
              <span className="text-[11px] font-normal text-v3-text-muted">แตะเพื่อเลือกวันเกิดจากปฏิทิน</span>
            </label>

            {/* เวลาเกิด + ไม่ทราบเวลา (บนแถวเดียวกัน) */}
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between">
                <span className={"text-[13px] font-bold text-v3-navy " + (timeUnknown ? "opacity-40" : "")}>เวลาเกิด (ถ้ารู้ จะแม่นขึ้น)</span>
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-v3-text-body">
                  <input type="checkbox" checked={timeUnknown} onChange={(e) => setTimeUnknown(e.target.checked)} data-testid="finder-time-unknown" className="size-4 accent-v3-sapphire" />
                  ไม่ทราบเวลาเกิด
                </span>
              </span>
              <input type="time" value={birthTime} disabled={timeUnknown} onChange={(e) => setBirthTime(e.target.value)} data-testid="finder-time"
                className="w-full rounded-2xl border border-v3-border-card bg-white px-4 py-3 text-[15px] text-v3-navy outline-none focus:border-v3-sapphire disabled:bg-black/5 disabled:text-v3-placeholder" />
            </label>

            {error && <p className="text-center text-[12px] font-bold text-v3-error" data-testid="finder-error">{error}</p>}
            <button type="button" onClick={() => void run()} disabled={!canSubmit} data-testid="finder-submit"
              className="mt-1 grid h-12 w-full place-items-center rounded-full bg-v3-navy text-[15px] font-bold text-white disabled:opacity-40">เช็คธาตุฉันเลย →</button>
          </section>

          {/* social proof */}
          <div className="mt-1 flex items-center gap-2">
            <span className="flex -space-x-2">
              {(["ไฟ", "น้ำ", "ไม้"] as const).map((k) => (
                <span key={k} className="grid size-6 place-items-center overflow-hidden rounded-full border-2 border-white bg-white shadow-sm">
                  <Image src={ELEMENT_CONTENT[k].mascot} alt="" width={22} height={22} className="size-[22px] object-contain" />
                </span>
              ))}
            </span>
            <span className="text-[12px] font-medium text-v3-text-body"><b className="text-v3-navy">12,450</b> คนเช็คธาตุแล้ววันนี้</span>
          </div>
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
        // ผลลัพธ์ = หน้าเดียวไม่ต้องเลื่อน (เอ็ม 2026-09-23): wallpaper คือภาพที่บอกทุกอย่างอยู่แล้ว
        // (ธาตุ+นิสัย+คำ baked ในภาพ) → ตัดข้อความซ้ำ (quote/traits/คำบรรยาย) ออก เหลือ ภาพ+CTA+ปุ่มแชร์
        <div className="mt-1 flex flex-col items-center gap-2" data-testid="finder-result">
          {/* โลโก้ Mumate ด้านบน (กันหัวติดขอบ) — เหมือนหน้ากรอกวันเกิด */}
          <Image src="/images/v2/logo/splash-logo.png" alt="Mumate" width={132} height={32} priority className="h-8 w-auto object-contain" />
          {/* wallpaper — ขยายเต็มความสูงจอที่เหลือ (responsive) ให้ไม่เหลือช่องว่าง ภาพเดียวบอกครบ */}
          {wallpaper && character && (
            <>
              <div className="overflow-hidden rounded-[18px] shadow-[0_8px_24px_rgba(11,48,91,0.18)]" data-testid="finder-wallpaper">
                <WallpaperCard bg={wallpaper.bg} character={character} text={wallpaper.text} width={wpW} />
              </div>
              <button type="button" onClick={shuffle} data-testid="finder-shuffle" className="text-[13px] font-bold text-v3-sapphire">🎲 สุ่มลุคใหม่</button>
              <WallpaperStage>
                <WallpaperCard ref={wallpaperRef} bg={wallpaper.bg} character={character} text={wallpaper.text} width={540} />
              </WallpaperStage>
            </>
          )}

          {/* CTA ดูดวงเต็ม — แถวเดียว: ข้อความ | ป้าย FREE | ปุ่มดูเลย */}
          <Link href="/v2/destiny" className="flex w-full max-w-md items-center gap-2 rounded-2xl bg-v3-sapphire/10 px-3.5 py-2.5" data-testid="finder-cta">
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-v3-navy">อยากรู้ลึกกว่านี้? ดูดวงเต็มของคุณ</span>
            <FreeBadge />
            <span className="shrink-0 rounded-full bg-v3-sapphire px-4 py-1.5 text-[13px] font-bold text-white">ดูเลย →</span>
          </Link>

          {/* แชร์ X แบบคัดลอกรูป → บอกวิธีวางในโพสต์ X (เอ็ม 2026-09-23) */}
          {copyHint ? (
            <div data-testid="finder-copy-hint" className="w-full max-w-md rounded-2xl bg-v3-navy px-4 py-2.5 text-center text-[12.5px] font-bold leading-5 text-white">
              📋 คัดลอกรูปแล้ว — ในหน้าเขียนโพสต์ X แตะค้างที่ช่องข้อความ แล้วเลือก “วาง” เพื่อแนบรูป
            </div>
          ) : null}
          {/* แชร์ = Twitter/X อย่างเดียว (ปุ่มดำ ไอคอน X) + บันทึก wallpaper */}
          <div className="flex w-full max-w-md gap-2">
            <button onClick={() => void shareX()} disabled={saving} data-testid="finder-share" className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-black text-[14px] font-bold text-white disabled:opacity-50">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              {saving ? "กำลังเตรียมรูป…" : "แชร์ลง X"}
            </button>
            <button onClick={() => void download()} disabled={saving} data-testid="finder-download" className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-v3-sapphire text-[14px] font-bold text-v3-sapphire disabled:opacity-50">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </div>
          <button onClick={reset} className="text-[13px] font-bold text-v3-sapphire" data-testid="finder-again">เช็คธาตุคนอื่นอีกครั้ง</button>
        </div>
      ) : null}

      {/* LINE in-app browser: <a download> ถูกบล็อก → โชว์รูปเดี่ยวให้ "กดค้างที่รูป" เพื่อบันทึกลงเครื่อง */}
      {saveImg ? (
        <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-3 bg-black/80 px-6" onClick={closeSaveImg} data-testid="finder-save-overlay">
          <p className="text-center text-[14px] font-bold text-white">กดค้างที่รูป ▸ “บันทึกรูปภาพ”</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={saveImg} alt="wallpaper" onClick={(e) => e.stopPropagation()} className="max-h-[75vh] w-auto rounded-[16px] shadow-2xl" />
          <button type="button" onClick={closeSaveImg} className="mt-1 rounded-full bg-white px-6 py-2 text-[14px] font-bold text-v3-navy">ปิด</button>
        </div>
      ) : null}

      <Menubar />
    </SkyScreen>
  )
}
