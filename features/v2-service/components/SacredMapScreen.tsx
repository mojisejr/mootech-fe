// features/v2-service/components/SacredMapScreen.tsx — /v2/service/sacred-map (แผนที่ศักดิ์สิทธิ์)
// ต่อ ENGINE: /api/sacred-map (ผ่าน BFF /api/v2/sacred-map) — directory สถานที่ศักดิ์สิทธิ์ verified
// แผนที่ Leaflet + หมุดสีธาตุ + การ์ด + โมดัลรายละเอียด (โพยการมู/บันทึก/เช็คอิน/ตั้งเตือน/แชร์)
// รูปเสิร์ฟจาก engine (base64 ใน DB) ผ่าน /api/v2/sacred-map/image/[id] — ไม่พึ่ง Supabase.
import Head from "next/head"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState } from "react"

import { SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { normalizeElement } from "@/lib/personalization"

const SacredMapLeaflet = dynamic(() => import("./SacredMapLeaflet"), {
  ssr: false,
  loading: () => <div className="h-56 w-full animate-pulse rounded-[20px] bg-v3-ghost-white" />,
})

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
  rasiUpper: string | null
  rasiLower: string | null
  element: string | null
  needs: string[]
  worshipGuide: string | null
  imageUrl: string | null
  hasImage?: boolean
  googleMapUrl: string | null
  checkinCount: number
}

const EL: Record<string, { th: string; color: string }> = {
  wood: { th: "ไม้", color: "#22c55e" },
  fire: { th: "ไฟ", color: "#ef4444" },
  earth: { th: "ดิน", color: "#eab308" },
  metal: { th: "ทอง", color: "#94a3b8" },
  water: { th: "น้ำ", color: "#3b82f6" },
}
const NEED_OPTIONS = ["การงาน", "เงิน", "รัก", "สุขภาพ", "โชคลาภ", "จิตใจ"] as const
const CHECKIN_KEY = "mumate-sacred-checkin"
const SAVED_KEY = "mumate-sacred-saved"
const CARD = "v3-shadow-card w-full rounded-[24px] bg-white p-4"

// พิกัดที่ใช้ปักหมุดได้จริง — ต้องอยู่ในกรอบประเทศไทย (กัน seed เสีย เช่น 0,0 ไปโผล่แอฟริกา)
function isValidCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 5.5 && lat <= 21 && lng >= 97 && lng <= 106
}

function mapsLink(loc: SacredLocation): string {
  if (loc.googleMapUrl && loc.googleMapUrl.trim()) return loc.googleMapUrl.trim()
  // พิกัดเสีย → ค้นด้วยชื่อ+จังหวัด แทน (ไม่ยิง 0,0)
  const q = isValidCoord(loc.lat, loc.lng)
    ? `${loc.name ?? ""} ${loc.lat},${loc.lng}`.trim()
    : [loc.name, loc.province].filter(Boolean).join(" ")
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}
/** รูป: เสิร์ฟจาก engine (base64) ถ้ามี ไม่งั้น fallback imageUrl เดิม (supabase) */
function imageSrc(loc: SacredLocation): string | null {
  if (loc.hasImage) return `/api/v2/sacred-map/image/${encodeURIComponent(loc.id)}`
  return loc.imageUrl || null
}
/** ตั้งเตือน = สร้าง event บน Google Calendar (เตือนไปไหว้) */
function calendarLink(loc: SacredLocation): string {
  const text = encodeURIComponent(`ไปไหว้ ${loc.name}`)
  const details = encodeURIComponent(`${loc.deity ? loc.deity + "\n" : ""}${mapsLink(loc)}`)
  const location = encodeURIComponent(loc.address || loc.province || "")
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&location=${location}`
}
function readSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function SacredMapScreen() {
  const [elementTh, setElementTh] = useState<string | null>(null)
  const [byElement, setByElement] = useState(true)
  const [need, setNeed] = useState<string | null>(null)
  const [onlySaved, setOnlySaved] = useState(false)
  const [locations, setLocations] = useState<SacredLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [bootstrapped, setBootstrapped] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const elementEn = useMemo(() => normalizeElement(elementTh)?.en.toLowerCase() ?? null, [elementTh])
  const elMeta = elementEn ? EL[elementEn] : null

  const visible = useMemo(() => (onlySaved ? locations.filter((l) => saved.has(l.id)) : locations), [locations, onlySaved, saved])
  const pins = useMemo(
    () => visible
      .filter((l) => isValidCoord(l.lat, l.lng))
      .map((l) => ({ id: l.id, name: l.name, deity: l.deity, lat: l.lat, lng: l.lng, element: l.element })),
    [visible],
  )
  const selected = useMemo(() => locations.find((l) => l.id === selectedId) ?? null, [locations, selectedId])

  useEffect(() => {
    setCheckedIn(readSet(CHECKIN_KEY))
    setSaved(readSet(SAVED_KEY))
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
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  const toggleSave = (id: string) => {
    setSaved((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      try { localStorage.setItem(SAVED_KEY, JSON.stringify(Array.from(next))) } catch { /* ignore */ }
      return next
    })
  }

  const share = (loc: SacredLocation) => {
    const url = mapsLink(loc)
    const text = `${loc.name}${loc.deity ? " · " + loc.deity : ""}`
    if (typeof navigator !== "undefined" && navigator.share) void navigator.share({ title: loc.name, text, url }).catch(() => {})
    else if (typeof navigator !== "undefined" && navigator.clipboard) void navigator.clipboard.writeText(`${text} ${url}`).catch(() => {})
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
          <label className="mt-3 flex items-center gap-2 text-[12px] font-bold text-v3-navy">
            <input type="checkbox" checked={onlySaved} onChange={(e) => setOnlySaved(e.target.checked)} data-testid="sacred-map-only-saved" className="size-4" />
            เฉพาะที่บันทึก {saved.size > 0 ? `(${saved.size})` : ""}
          </label>
        </section>

        {/* MAP */}
        {!loading && pins.length > 0 ? (
          <section className="v3-shadow-card overflow-hidden rounded-[20px]" data-testid="sacred-map-map" style={{ height: 224 }}>
            <SacredMapLeaflet pins={pins} onSelect={(id) => setSelectedId(id)} />
          </section>
        ) : null}

        {/* LIST */}
        {loading ? (
          <div className="h-40 w-full animate-pulse rounded-[24px] bg-v3-ghost-white" data-testid="sacred-map-loading" />
        ) : visible.length === 0 ? (
          <section className={CARD + " text-center"} data-testid="sacred-map-empty">
            <p className="text-[32px]">🙏</p>
            <p className="mt-1 text-[15px] font-black text-v3-navy">{unavailable ? "ยังเชื่อมต่อไม่ได้" : onlySaved ? "ยังไม่มีที่บันทึกไว้" : "ยังไม่มีสถานที่ในตัวกรองนี้"}</p>
            <p className="mt-1 text-[13px] leading-5 text-v3-text-body">
              {unavailable ? "ลองใหม่อีกครั้งภายหลัง" : onlySaved ? "แตะ ☆ บันทึก ในสถานที่ที่สนใจ" : "ลองเปลี่ยนตัวกรอง หรือปิด “กรองตามธาตุคุณ” เพื่อดูทั้งหมด"}
            </p>
          </section>
        ) : (
          <section className="flex flex-col gap-3" data-testid="sacred-map-list">
            {visible.map((loc) => {
              const m = loc.element ? EL[loc.element] : null
              const img = imageSrc(loc)
              return (
                <button key={loc.id} type="button" onClick={() => setSelectedId(loc.id)} className={CARD + " flex gap-3 text-left"} data-testid="sacred-map-item">
                  <span className="relative size-16 flex-none overflow-hidden rounded-[12px] bg-v3-ghost-white">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" loading="lazy" className="size-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }} />
                    ) : <span className="grid size-full place-items-center text-[22px]">🙏</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate text-[14px] font-black text-v3-navy">{loc.name}</span>
                      {m ? <span className="flex-none rounded-full px-2 py-[1px] text-[10px] font-black text-white" style={{ background: m.color }}>ธาตุ{m.th}</span> : null}
                    </span>
                    {loc.deity ? <span className="block truncate text-[12px] text-v3-text-body">🙏 {loc.deity}</span> : null}
                    <span className="block truncate text-[11px] text-v3-text-muted">{[loc.province, loc.direction].filter(Boolean).join(" · ")}</span>
                    {loc.needs?.length ? (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {loc.needs.slice(0, 3).map((n) => <span key={n} className="rounded-full bg-[#EAF3FF] px-1.5 py-[1px] text-[10px] font-bold text-v3-sapphire">{n}</span>)}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex-none self-center text-[16px] text-v3-text-muted">›</span>
                </button>
              )
            })}
          </section>
        )}

        <p className="px-2 text-center text-[11px] leading-4 text-v3-text-muted">
          รู้จักสถานที่ศักดิ์สิทธิ์ที่ควรมี? <Link href="/v2/chat" className="font-bold text-v3-cyan">แนะนำกับเราได้</Link>
        </p>
      </div>

      {/* DETAIL MODAL */}
      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" onClick={() => setSelectedId(null)} data-testid="sacred-map-detail">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-white sm:rounded-[24px]" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const loc = selected
              const m = loc.element ? EL[loc.element] : null
              const img = imageSrc(loc)
              const isSaved = saved.has(loc.id)
              const done = checkedIn.has(loc.id)
              return (
                <>
                  <div className="relative">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={loc.name} className="aspect-[16/9] w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }} />
                    ) : <div className="grid aspect-[16/9] w-full place-items-center bg-v3-ghost-white text-[40px]">🙏</div>}
                    <button type="button" onClick={() => setSelectedId(null)} data-testid="sacred-map-detail-close" className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-white/90 text-[16px] font-bold text-v3-navy shadow">✕</button>
                  </div>
                  <div className="flex flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-[19px] font-black leading-6 text-v3-navy">{loc.name}</h2>
                      {m ? <span className="flex-none rounded-full px-2 py-[2px] text-[11px] font-black text-white" style={{ background: m.color }}>ธาตุ{m.th}</span> : null}
                    </div>
                    {loc.deity ? <p className="text-[14px] font-bold text-v3-text-body">🙏 {loc.deity}</p> : null}
                    {loc.description ? <p className="text-[13px] leading-5 text-v3-text-body">{loc.description}</p> : null}

                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                      {loc.direction ? <div><p className="text-[11px] text-v3-text-muted">ทิศมงคล</p><p className="text-[13px] font-bold text-v3-navy">{loc.direction}</p></div> : null}
                      {(loc.rasiUpper || loc.rasiLower) ? <div><p className="text-[11px] text-v3-text-muted">ตัวแทนราศี</p><p className="text-[13px] font-bold text-v3-navy">{[loc.rasiUpper, loc.rasiLower].filter(Boolean).join(" / ")}</p></div> : null}
                      {loc.province ? <div><p className="text-[11px] text-v3-text-muted">จังหวัด</p><p className="text-[13px] font-bold text-v3-navy">{loc.province}</p></div> : null}
                      {loc.address ? <div className="col-span-2"><p className="text-[11px] text-v3-text-muted">ที่อยู่</p><p className="text-[13px] text-v3-text-body">{loc.address}</p></div> : null}
                      {loc.needs?.length ? <div><p className="text-[11px] text-v3-text-muted">ช่วยเรื่อง</p><p className="text-[13px] font-bold text-v3-navy">{loc.needs.join(" · ")}</p></div> : null}
                      <div><p className="text-[11px] text-v3-text-muted">เช็คอินแล้ว</p><p className="text-[13px] font-bold text-v3-navy">{loc.checkinCount} ครั้ง</p></div>
                    </div>

                    {loc.worshipGuide ? (
                      <div className="rounded-[14px] border border-[#EAD9AE] bg-[#FBF7EC] p-3">
                        <p className="text-[13px] font-black text-[#B08A3B]">โพยการมู</p>
                        <p className="mt-1 whitespace-pre-line text-[13px] leading-5 text-v3-text-body">{loc.worshipGuide}</p>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-2">
                      <a href={mapsLink(loc)} target="_blank" rel="noopener noreferrer" className="col-span-2 grid h-11 place-items-center rounded-full bg-v3-sapphire text-[14px] font-bold uppercase text-v3-lime" data-testid="sacred-map-detail-maps">🗺 เปิด Google Maps</a>
                      <button type="button" onClick={() => toggleSave(loc.id)} data-testid="sacred-map-detail-save" className={"grid h-11 place-items-center rounded-full border text-[13px] font-bold " + (isSaved ? "border-transparent bg-[#FFF3E0] text-[#C77800]" : "border-v3-border-card bg-white text-v3-navy")}>{isSaved ? "★ บันทึกแล้ว" : "☆ บันทึก"}</button>
                      <button type="button" onClick={() => void checkin(loc.id)} disabled={done} data-testid="sacred-map-detail-checkin" className={"grid h-11 place-items-center rounded-full border text-[13px] font-bold " + (done ? "border-transparent bg-[#EAF7EA] text-[#3E7E3A]" : "border-v3-border-card bg-white text-v3-navy")}>{done ? "✓ เช็คอินแล้ว" : "📍 เช็คอิน"}</button>
                      <a href={calendarLink(loc)} target="_blank" rel="noopener noreferrer" className="grid h-11 place-items-center rounded-full border border-v3-border-card bg-white text-[13px] font-bold text-v3-navy" data-testid="sacred-map-detail-remind">⏰ ตั้งเตือน</a>
                      <button type="button" onClick={() => share(loc)} className="grid h-11 place-items-center rounded-full border border-v3-border-card bg-white text-[13px] font-bold text-v3-navy" data-testid="sacred-map-detail-share">↗ แชร์</button>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      ) : null}

      <Menubar />
    </div>
  )
}

export default SacredMapScreen
