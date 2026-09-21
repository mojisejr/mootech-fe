// pages/v2/service/birthday-color.tsx — "สีมงคลวันเกิด" (widget wallpaper สีวันเกิด, #6 Kittipon 2026-09-21)
// v1 self-designed (ยังไม่มี Figma ตรง node 1670-69 — เข้าถึงไม่ได้): วันเกิด → ธาตุประจำตัว (ก้านวัน) →
// สีมงคล (element-colors ตรง engine) → wallpaper มือถือดาวน์โหลด/แชร์ตั้งเป็นวอลเปเปอร์ได้.
// อ่านดวงผู้ใช้จาก /api/destiny (auto-user, reuse destiny-cache) เหมือน DestinyScreen.
import Head from "next/head"
import { useEffect, useRef, useState } from "react"
import type { GetServerSideProps } from "next"

import { v2RedirectIfUnauthed } from "@/lib/v2/gate"
import { SkyHeader, SkyScreen, KitButton } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { AuthRequiredCard } from "@/features/auth/components/AuthRequiredCard"
import { useCurrentUser } from "@/lib/auth/use-current-user"
import { getDestinyCache, setDestinyCache } from "@/features/v2-destiny/destiny-cache"
import type { DestinyData } from "@/features/v2-destiny/components/DestinyScreen"
import { captureShareImage } from "@/lib/v2/share-card"
import { stemColor, stemElementTh, stemEnLabel, branchZodiacTh, branchZodiacEn } from "@/lib/bazi/element-colors"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

// พรวันเกิดสั้น ๆ ต่อธาตุ (v1 — ซินแสปรับถ้อยคำได้)
const ELEMENT_BLESSING: Record<string, string> = {
  ไม้: "เติบโต งอกงาม ทุกก้าวมีชีวิตชีวา",
  ไฟ: "เปล่งประกาย อบอุ่น ดึงดูดสิ่งดีเข้าหา",
  ดิน: "มั่นคง หนักแน่น เป็นที่พึ่งของผู้คน",
  ทอง: "เด็ดเดี่ยว มีระเบียบ พร้อมสู่ความสำเร็จ",
  น้ำ: "ลื่นไหล ปราดเปรื่อง ปรับตัวได้ทุกสถานการณ์",
}

export default function BirthdayColorPage() {
  const { status: authStatus } = useCurrentUser()
  const [data, setData] = useState<DestinyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const wallRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (authStatus !== "authed") return
    const cached = getDestinyCache()
    if (cached) { setData(cached); setLoading(false); return }
    let alive = true
    ;(async () => {
      try {
        const res = await fetch("/api/destiny", { method: "POST" })
        if (!res.ok) return
        const j = (await res.json()) as DestinyData
        if (alive) { setData(j); setDestinyCache(j) }
      } catch { /* ปล่อยว่าง — โชว์สถานะโหลดไม่ได้ */ } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [authStatus])

  const pillars = data?.calculatedState?.fourPillars ?? null
  const dayStem = pillars?.day?.stem ?? ""
  const yearBranch = pillars?.year?.branch ?? ""
  const color = stemColor(dayStem)
  const elementTh = stemElementTh(dayStem)
  const elementEn = stemEnLabel(dayStem) // "Yin Metal"
  const zodiacTh = branchZodiacTh(yearBranch)
  const zodiacEn = branchZodiacEn(yearBranch)
  const ready = Boolean(dayStem && elementTh)

  const save = async () => {
    if (!wallRef.current || saving) return
    setSaving(true); setMsg(null)
    try {
      const file = await captureShareImage(wallRef.current)
      if (!file) { setMsg("บันทึกภาพไม่สำเร็จ ลองใหม่อีกครั้ง"); return }
      // มือถือ: แชร์ไฟล์ (เลือก "บันทึกภาพ" → ตั้งวอลเปเปอร์ได้) — ไม่รองรับค่อย fallback ดาวน์โหลด
      const canShareFile = typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] })
      if (canShareFile) {
        try { await navigator.share({ files: [file], title: "สีมงคลวันเกิด · MuMate" }); return } catch { /* ยกเลิก → ดาวน์โหลดแทน */ }
      }
      const url = URL.createObjectURL(file)
      const a = document.createElement("a"); a.href = url; a.download = "mumate-สีมงคลวันเกิด.jpg"; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      setMsg("บันทึกแล้ว — กดค้างที่ภาพเพื่อตั้งเป็นวอลเปเปอร์")
    } finally { setSaving(false) }
  }

  return (
    <SkyScreen bgImage="/images/v2/fortune/sage-bg.png">
      <Head><title>สีมงคลวันเกิด · MuMate</title></Head>
      <SkyHeader title="สีมงคลวันเกิด" backHref="/v2/service" testId="birthday-color" />

      {authStatus === "anon" ? (
        <div className="mt-4"><AuthRequiredCard testId="birthday-color-auth" message="เข้าสู่ระบบก่อนเพื่อดูสีมงคลของคุณ" /></div>
      ) : loading || authStatus === "loading" ? (
        <p className="mt-10 text-center text-[13px] text-v3-text-body">กำลังคำนวณสีมงคลจากดวงของคุณ…</p>
      ) : !ready ? (
        <p className="mt-10 text-center text-[13px] text-v3-text-body">ยังคำนวณดวงไม่ได้ — ตรวจว่าตั้งวันเดือนปีเกิดในโปรไฟล์แล้ว</p>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-4" data-testid="birthday-color-ready">
          <p className="text-center text-[13px] leading-5 text-v3-text-body">ธาตุประจำตัวของคุณคือ <b>ธาตุ{elementTh}</b> — สีมงคลด้านล่างเซฟไปตั้งเป็นวอลเปเปอร์เสริมดวงได้เลย</p>

          {/* วอลเปเปอร์มือถือ (จับภาพด้วย html2canvas → บันทึก/แชร์) */}
          <div
            ref={wallRef}
            data-testid="birthday-color-wallpaper"
            className="relative w-full max-w-[290px] overflow-hidden rounded-[28px]"
            style={{ aspectRatio: "9 / 18", background: `linear-gradient(155deg, ${color}E6 0%, ${color} 45%, ${shade(color, -28)} 100%)` }}
          >
            {/* แสงเรืองมุมบน */}
            <div aria-hidden className="absolute -left-10 -top-10 h-52 w-52 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.35), transparent 70%)" }} />
            {/* ตัวอักษรธาตุ (ก้านวัน) เป็นลายน้ำใหญ่ */}
            <span aria-hidden className="absolute inset-0 grid place-items-center text-[190px] font-black leading-none text-white/15">{dayStem}</span>

            <div className="absolute inset-0 flex flex-col justify-between p-6 text-white">
              <div>
                <p className="text-[12px] font-medium tracking-wide text-white/80">สีมงคลประจำตัว</p>
                <p className="mt-1 text-[40px] font-black leading-none drop-shadow">ธาตุ{elementTh}</p>
                <p className="mt-1 text-[14px] font-semibold text-white/90">{elementEn}{zodiacEn ? ` · ${cap(zodiacEn)}` : ""}</p>
              </div>

              <div className="flex flex-col gap-1">
                <p className="text-[14px] font-bold leading-6 drop-shadow">{ELEMENT_BLESSING[elementTh] ?? "ขอให้สีนี้นำโชคและความมั่นคงมาสู่คุณ"}</p>
                {zodiacTh && <p className="text-[12px] text-white/85">ปีนักษัตร {zodiacTh}</p>}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[13px] font-black tracking-wide">MuMate</span>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">{color}</span>
                </div>
              </div>
            </div>
          </div>

          {msg && <p className="text-center text-[12px] font-bold text-v3-sapphire" data-testid="birthday-color-msg">{msg}</p>}
          <div className="w-full max-w-[290px]">
            <KitButton onClick={() => void save()} disabled={saving} testId="birthday-color-save">{saving ? "กำลังบันทึก…" : "บันทึก / ตั้งเป็นวอลเปเปอร์"}</KitButton>
          </div>
          <p className="max-w-xs text-center text-[11px] leading-4 text-v3-text-muted">บนมือถือ: กด "บันทึก" แล้วเลือกบันทึกภาพ → ตั้งเป็นวอลเปเปอร์จากคลังรูป</p>
        </div>
      )}
      <Menubar />
    </SkyScreen>
  )
}

/** ปรับสว่าง/มืด hex (percent -100..100) — ทำ gradient เข้มปลายล่างให้ตัวอักษรอ่านชัด */
function shade(hex: string, percent: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const t = percent < 0 ? 0 : 255
  const p = Math.abs(percent) / 100
  const r = Math.round(((n >> 16) & 0xff) * (1 - p) + t * p)
  const g = Math.round(((n >> 8) & 0xff) * (1 - p) + t * p)
  const b = Math.round((n & 0xff) * (1 - p) + t * p)
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
