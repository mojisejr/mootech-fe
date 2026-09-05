// features/v2-service/components/SacredMapScreen.tsx — /v2/service/sacred-map (แผนที่ศักดิ์สิทธิ์)
// ต่อ ENGINE: /api/sacred-map (ผ่าน BFF /api/v2/sacred-map) — directory สถานที่ศักดิ์สิทธิ์ verified
// กรองตามธาตุประจำตัว (จาก element-summary) + ความต้องการ + เช็คอิน. ไม่มีเฟรม Figma → ออกแบบเองตามภาษาแอป.
import Head from "next/head"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

import { SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { normalizeElement } from "@/lib/personalization"

type SacredLocation = {
  id: string
  name: string
  deity: string | null
  description: string | null
  province: string | null
  address: string | null
  lat: number
  lng: number
  direction: string | null
  element: string | null
  needs: string[]
  worshipGuide: string | null
  imageUrl: string | null
  googleMapUrl: string | null
  checkinCount: number
}

// engine ใช้ธาตุตัวเล็ก (wood/fire/…) — map เป็นป้าย/สีไทย
const EL: Record<string, { th: string; color: string }> = {
  wood: { th: "ไม้", color: "#22c55e" },
  fire: { th: "ไฟ", color: "#ef4444" },
  earth: { th: "ดิน", color: "#eab308" },
  metal: { th: "ทอง", color: "#94a3b8" },
  water: { th: "น้ำ", color: "#3b82f6" },
}
const NEED_OPTIONS = ["การงาน", "เงิน", "รัก", "สุขภาพ", "โชคลาภ", "จิตใจ"] as const
const CHECKIN_KEY = "mumate-sacred-checkin"
const CARD = "v3-shadow-card w-full rounded-[24px] bg-white p-4"

function mapsLink(loc: SacredLocation): string {
  if (loc.googleMapUrl && loc.googleMapUrl.trim()) return loc.googleMapUrl.trim()
  const q = encodeURIComponent(`${loc.name ?? ""} ${loc.lat},${loc.lng}`.trim())
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

function readCheckedIn(): Set<string> {
  try {
    const raw = localStorage.getItem(CHECKIN_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function SacredMapScreen() {
  const [elementTh, setElementTh] = useState<string | null>(null)
  const [byElement, setByElement] = useState(true)
  const [need, setNeed] = useState<string | null>(null)
  const [locations, setLocations] = useState<SacredLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set())
  const [bootstrapped, setBootstrapped] = useState(false)

  const elementEn = useMemo(() => normalizeElement(elementTh)?.en.toLowerCase() ?? null, [elementTh])
  const elMeta = elementEn ? EL[elementEn] : null

  // ธาตุประจำตัว (best-effort) — resolve ก่อน แล้วค่อยโหลดรายการครั้งแรก (กัน double-fetch/แข่งกัน)
  useEffect(() => {
    setCheckedIn(readCheckedIn())
    void (async () => {
      try {
        const p = await fetch("/api/profile").then((x) => (x.ok ? x.json() : null)).catch(() => null)
        const bd: string | null = p?.profile?.birthDate ?? null
        if (bd) {
          const j = await fetch("/api/bazi/element-summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ person: { birthDate: bd, birthTime: p?.profile?.birthTime ?? undefined } }),
          }).then((x) => (x.ok ? x.json() : null)).catch(() => null)
          setElementTh(j?.summary?.elementTh ?? null)
        }
      } finally {
        setBootstrapped(true)
      }
    })()
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (byElement && elementEn) qs.set("element", elementEn)
    if (need) qs.set("need", need)
    try {
      const j = await fetch(`/api/v2/sacred-map${qs.toString() ? `?${qs}` : ""}`).then((x) => (x.ok ? x.json() : null))
      setLocations(Array.isArray(j?.locations) ? j.locations : [])
      setUnavailable(!!j?.unavailable)
    } catch {
      setLocations([])
      setUnavailable(true)
    } finally {
      setLoading(false)
    }
  }, [byElement, elementEn, need])

  useEffect(() => { if (bootstrapped) void load() }, [bootstrapped, load])

  const checkin = async (id: string) => {
    if (checkedIn.has(id)) return
    const next = new Set(checkedIn).add(id)
    setCheckedIn(next)
    try { localStorage.setItem(CHECKIN_KEY, JSON.stringify(Array.from(next))) } catch { /* ignore */ }
    setLocations((ls) => ls.map((l) => (l.id === id ? { ...l, checkinCount: l.checkinCount + 1 } : l)))
    await fetch("/api/v2/sacred-map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-v3-bg-cream font-ibm">
      <SkyBackdrop height={420} />
      <Head><title>แผนที่ศักดิ์สิทธิ์ · สถานที่เสริมดวงของคุณ · MuMate</title></Head>
      <SkyHeader title="แผนที่ศักดิ์สิทธิ์" backHref="/v2/service" testId="sacred-map" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-40 pt-2">
        {/* HERO */}
        <section className="flex flex-col items-center gap-2 text-center" data-testid="sacred-map-hero">
          <p className="text-[36px]">🧭</p>
          <h1 className="text-[22px] font-black leading-7 text-v3-navy">สถานที่ศักดิ์สิทธิ์เสริมดวง</h1>
          <p className="max-w-xs text-[13px] leading-5 text-v3-text-body">รวมสถานที่ศักดิ์สิทธิ์ที่คัดมาแล้ว เลือกไหว้ให้ตรงธาตุและเรื่องที่อยากเสริม</p>
        </section>

        {/* FILTERS */}
        <section className={CARD} data-testid="sacred-map-filters">
          {elMeta ? (
            <button
              type="button"
              onClick={() => setByElement((v) => !v)}
              data-testid="sacred-map-toggle-element"
              className={"flex w-full items-center justify-between rounded-[14px] border px-3 py-2 text-[13px] font-bold " + (byElement ? "border-transparent text-white" : "border-v3-border-card bg-white text-v3-navy")}
              style={byElement ? { background: elMeta.color } : undefined}
            >
              <span>{byElement ? `กรองตามธาตุคุณ: ธาตุ${elMeta.th}` : `แสดงทุกธาตุ · ธาตุคุณ = ${elMeta.th}`}</span>
              <span className="text-[11px] opacity-90">{byElement ? "แตะเพื่อดูทุกธาตุ" : "แตะเพื่อกรอง"}</span>
            </button>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setNeed(null)} className={"rounded-full px-3 py-1 text-[12px] font-bold " + (need === null ? "bg-v3-sapphire text-white" : "bg-v3-ghost-white text-v3-navy")}>ทั้งหมด</button>
            {NEED_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNeed(need === n ? null : n)}
                data-testid={`sacred-map-need-${n}`}
                className={"rounded-full px-3 py-1 text-[12px] font-bold " + (need === n ? "bg-v3-sapphire text-white" : "bg-v3-ghost-white text-v3-navy")}
              >
                {n}
              </button>
            ))}
          </div>
        </section>

        {/* LIST */}
        {loading ? (
          <div className="h-40 w-full animate-pulse rounded-[24px] bg-v3-ghost-white" data-testid="sacred-map-loading" />
        ) : locations.length === 0 ? (
          <section className={CARD + " text-center"} data-testid="sacred-map-empty">
            <p className="text-[32px]">🙏</p>
            <p className="mt-1 text-[15px] font-black text-v3-navy">{unavailable ? "ยังเชื่อมต่อไม่ได้" : "ยังไม่มีสถานที่ในตัวกรองนี้"}</p>
            <p className="mt-1 text-[13px] leading-5 text-v3-text-body">
              {unavailable ? "ลองใหม่อีกครั้งภายหลัง" : "ลองเปลี่ยนตัวกรอง หรือปิด “กรองตามธาตุคุณ” เพื่อดูทั้งหมด"}
            </p>
          </section>
        ) : (
          <section className="flex flex-col gap-3" data-testid="sacred-map-list">
            {locations.map((loc) => {
              const m = loc.element ? EL[loc.element] : null
              const done = checkedIn.has(loc.id)
              return (
                <article key={loc.id} className={CARD} data-testid="sacred-map-item">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[15px] font-black leading-5 text-v3-navy">{loc.name}</p>
                      {loc.deity ? <p className="text-[12px] text-v3-text-body">องค์เทพ: {loc.deity}</p> : null}
                      <p className="text-[12px] text-v3-text-muted">{[loc.province, loc.direction].filter(Boolean).join(" · ")}</p>
                    </div>
                    {m ? <span className="flex-none rounded-full px-2 py-[2px] text-[11px] font-black text-white" style={{ background: m.color }}>ธาตุ{m.th}</span> : null}
                  </div>

                  {loc.description ? <p className="mt-2 text-[13px] leading-5 text-v3-text-body">{loc.description}</p> : null}

                  {loc.needs?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {loc.needs.map((n) => (
                        <span key={n} className="rounded-full bg-[#EAF3FF] px-2 py-[2px] text-[11px] font-bold text-v3-sapphire">{n}</span>
                      ))}
                    </div>
                  ) : null}

                  {loc.worshipGuide ? (
                    <details className="mt-2 rounded-[12px] bg-v3-ghost-white px-3 py-2">
                      <summary className="cursor-pointer text-[12px] font-bold text-v3-navy">วิธีสักการะ</summary>
                      <p className="mt-1 whitespace-pre-line text-[12px] leading-5 text-v3-text-body">{loc.worshipGuide}</p>
                    </details>
                  ) : null}

                  <div className="mt-3 flex items-center gap-2">
                    <a href={mapsLink(loc)} target="_blank" rel="noopener noreferrer" className="grid h-10 flex-1 place-items-center rounded-full bg-v3-sapphire text-[13px] font-bold uppercase text-v3-lime" data-testid="sacred-map-directions">เปิดแผนที่</a>
                    <button
                      type="button"
                      onClick={() => void checkin(loc.id)}
                      disabled={done}
                      data-testid="sacred-map-checkin"
                      className={"grid h-10 flex-1 place-items-center rounded-full border text-[13px] font-bold " + (done ? "border-transparent bg-[#EAF7EA] text-[#3E7E3A]" : "border-v3-border-card bg-white text-v3-navy")}
                    >
                      {done ? `✓ เช็คอินแล้ว · ${loc.checkinCount}` : `เช็คอิน · ${loc.checkinCount}`}
                    </button>
                  </div>
                </article>
              )
            })}
          </section>
        )}

        {/* เสนอสถานที่ */}
        <p className="px-2 text-center text-[11px] leading-4 text-v3-text-muted">
          รู้จักสถานที่ศักดิ์สิทธิ์ที่ควรมี? <Link href="/v2/chat" className="font-bold text-v3-cyan">แนะนำกับเราได้</Link>
        </p>
      </div>

      <Menubar />
    </div>
  )
}

export default SacredMapScreen
