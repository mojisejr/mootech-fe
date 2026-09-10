// features/v2-service/components/SacredMapScreen.tsx — /v2/service/sacred-map (แผนที่ศักดิ์สิทธิ์)
// ต่อ ENGINE: /api/sacred-map (ผ่าน BFF /api/v2/sacred-map) — directory สถานที่ศักดิ์สิทธิ์ verified
// รายการ + แผนที่ Leaflet + ฟอร์มเสนอที่ (→ pending รอแอดมิน). รายละเอียด = หน้าแยก /v2/service/sacred-map/[id]
import Head from "next/head"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState } from "react"

import { SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import {
  EL, NEED_OPTIONS, SAVED_KEY, fmtKm, haversineKm, imageSrc, isValidCoord, readSet,
  type SacredLocation,
} from "@/features/v2-service/sacred-map-shared"

const SacredMapLeaflet = dynamic(() => import("./SacredMapLeaflet"), {
  ssr: false,
  loading: () => <div className="h-56 w-full animate-pulse rounded-[20px] bg-v3-ghost-white" />,
})

const CARD = "v3-shadow-card w-full rounded-[24px] bg-white p-4"

function FilterPill({ active, onClick, testId, color, children }: { active: boolean; onClick: () => void; testId?: string; color?: string; children: React.ReactNode }) {
  // ธาตุ (มี color): active = พื้นสีธาตุ ตัวขาว / inactive = พื้นขาว ตัวอักษรสีธาตุ. ทั่วไป (ไม่มี color): active = lime.
  const style = color ? (active ? { background: color, color: "#fff" } : { background: "#fff", color }) : undefined
  const cls = color ? "" : active ? "bg-v3-lime text-v3-navy" : "bg-white text-v3-navy"
  return (
    <button type="button" onClick={onClick} data-testid={testId} style={style} className={"rounded-full px-3 py-1 text-[12px] font-bold " + cls}>
      {children}
    </button>
  )
}

export function SacredMapScreen() {
  const [elementFilter, setElementFilter] = useState<string | null>(null)
  const [need, setNeed] = useState<string | null>(null)
  const [onlySaved, setOnlySaved] = useState(false)
  const [locations, setLocations] = useState<SacredLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [bootstrapped, setBootstrapped] = useState(false)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)

  // ฟอร์มเสนอสถานที่
  const [submitOpen, setSubmitOpen] = useState(false)
  const emptyForm = { name: "", deity: "", province: "", address: "", element: "", needs: [] as string[], worshipGuide: "", googleMapUrl: "", contact: "", lat: null as number | null, lng: null as number | null }
  const [form, setForm] = useState(emptyForm)
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [submitMsg, setSubmitMsg] = useState("")
  const [pinState, setPinState] = useState<"idle" | "asking">("idle")

  const visible = useMemo(() => (onlySaved ? locations.filter((l) => saved.has(l.id)) : locations), [locations, onlySaved, saved])
  const pins = useMemo(
    () => visible.filter((l) => isValidCoord(l.lat, l.lng)).map((l) => ({ id: l.id, name: l.name, deity: l.deity, lat: l.lat, lng: l.lng, element: l.element })),
    [visible],
  )

  useEffect(() => {
    setSaved(readSet(SAVED_KEY))
    setBootstrapped(true)
  }, [])

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    )
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (elementFilter) qs.set("element", elementFilter)
    if (need) qs.set("need", need)
    try {
      const j = await fetch(`/api/v2/sacred-map${qs.toString() ? `?${qs}` : ""}`).then((x) => (x.ok ? x.json() : null))
      setLocations(Array.isArray(j?.locations) ? j.locations : [])
      setUnavailable(!!j?.unavailable)
    } catch {
      setLocations([]); setUnavailable(true)
    } finally {
      setLoading(false)
    }
  }, [elementFilter, need])

  useEffect(() => { if (bootstrapped) void load() }, [bootstrapped, load])

  // ── ฟอร์มเสนอสถานที่ ──
  const openSubmit = () => { setForm(emptyForm); setSubmitState("idle"); setSubmitMsg(""); setSubmitOpen(true) }
  const setF = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const parseCoordsFromUrl = (url: string): { lat: number; lng: number } | null => {
    const pats = [/@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/, /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/]
    for (const p of pats) { const mm = url.match(p); if (mm) return { lat: parseFloat(mm[1]), lng: parseFloat(mm[2]) } }
    return null
  }
  const onMapUrlChange = (url: string) => {
    const c = parseCoordsFromUrl(url)
    setForm((f) => ({ ...f, googleMapUrl: url, ...(c ? { lat: c.lat, lng: c.lng } : {}) }))
  }
  const usePinLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return
    setPinState("asking")
    navigator.geolocation.getCurrentPosition(
      (p) => { setForm((f) => ({ ...f, lat: p.coords.latitude, lng: p.coords.longitude })); setPinState("idle") },
      () => setPinState("idle"),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }
  const submitLocation = async () => {
    if (!form.name.trim()) { setSubmitState("error"); setSubmitMsg("กรุณากรอกชื่อสถานที่"); return }
    if (form.lat === null || form.lng === null) { setSubmitState("error"); setSubmitMsg("กรุณาปักตำแหน่ง (ใช้ตำแหน่งของฉัน หรือวางลิงก์ Google Maps)"); return }
    setSubmitState("sending"); setSubmitMsg("")
    try {
      const body = {
        name: form.name.trim(), deity: form.deity.trim() || null, province: form.province.trim() || null,
        address: form.address.trim() || null, element: form.element || null, needs: form.needs,
        worshipGuide: form.worshipGuide.trim() || null, googleMapUrl: form.googleMapUrl.trim() || null,
        lat: form.lat, lng: form.lng, submitterContact: form.contact.trim() || null,
      }
      const res = await fetch("/api/v2/sacred-map/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j?.ok) setSubmitState("done")
      else { setSubmitState("error"); setSubmitMsg(j?.error?.message || "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง") }
    } catch {
      setSubmitState("error"); setSubmitMsg("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง")
    }
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-v3-bg-cream font-ibm">
      <SkyBackdrop height={420} />
      <Head><title>แผนที่ศักดิ์สิทธิ์ · สถานที่เสริมดวงของคุณ · MuMate</title></Head>
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-40 pt-2">
        <SkyHeader
          title="แผนที่สถานที่ศักดิ์สิทธิ์"
          backHref="/v2/service"
          testId="sacred-map"
          right={<button type="button" onClick={openSubmit} data-testid="sacred-map-suggest" className="rounded-full bg-v3-sapphire px-3 py-1.5 text-[12px] font-bold text-white">+ เสนอที่</button>}
        />
        {/* FILTER CARD */}
        <section className="rounded-[24px] bg-v3-sapphire p-5 text-white" data-testid="sacred-map-filters">
          <h2 className="text-center text-[16px] font-black">ค้นหาสถานที่ศักดิ์สิทธิ์</h2>
          <div className="mt-3 border-t border-dashed border-white/35" />
          <p className="mt-4 text-[12px] font-bold text-white/80">ธาตุ</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <FilterPill active={elementFilter === null} onClick={() => setElementFilter(null)}>ทั้งหมด</FilterPill>
            {(["wood", "fire", "earth", "metal", "water"] as const).map((k) => (
              <FilterPill key={k} active={elementFilter === k} color={EL[k].color} onClick={() => setElementFilter(elementFilter === k ? null : k)}>{EL[k].th}</FilterPill>
            ))}
          </div>
          <p className="mt-4 text-[12px] font-bold text-white/80">เรื่องที่ขอ</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <FilterPill active={need === null} onClick={() => setNeed(null)}>ทั้งหมด</FilterPill>
            {NEED_OPTIONS.map((n) => (
              <FilterPill key={n} active={need === n} testId={`sacred-map-need-${n}`} onClick={() => setNeed(need === n ? null : n)}>{n}</FilterPill>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2 text-[12px] font-bold">
            <input type="checkbox" checked={onlySaved} onChange={(e) => setOnlySaved(e.target.checked)} data-testid="sacred-map-only-saved" className="size-4" />
            เฉพาะที่บันทึก {saved.size > 0 ? `(${saved.size})` : ""}
          </label>
        </section>

        {/* MAP */}
        {!loading && pins.length > 0 ? (
          <section className="v3-shadow-card overflow-hidden rounded-[20px]" data-testid="sacred-map-map" style={{ height: 224 }}>
            <SacredMapLeaflet pins={pins} onSelect={(id) => { const l = locations.find((x) => x.id === id); window.location.href = `/v2/service/sacred-map/${l?.slug || id}` }} />
          </section>
        ) : null}

        <h2 className="px-1 pt-1 text-[18px] font-black text-v3-navy">สถานที่ทั้งหมด</h2>

        {/* LIST */}
        {loading ? (
          <div className="h-40 w-full animate-pulse rounded-[24px] bg-v3-ghost-white" data-testid="sacred-map-loading" />
        ) : visible.length === 0 ? (
          <section className={CARD + " text-center"} data-testid="sacred-map-empty">
            <p className="text-[32px]">🙏</p>
            <p className="mt-1 text-[15px] font-black text-v3-navy">{unavailable ? "ยังเชื่อมต่อไม่ได้" : onlySaved ? "ยังไม่มีที่บันทึกไว้" : "ยังไม่มีสถานที่ในตัวกรองนี้"}</p>
            <p className="mt-1 text-[13px] leading-5 text-v3-text-body">
              {unavailable ? "ลองใหม่อีกครั้งภายหลัง" : onlySaved ? "แตะ ☆ บันทึก ในสถานที่ที่สนใจ" : "ลองเปลี่ยนตัวกรอง หรือปิด “เฉพาะที่บันทึก” เพื่อดูทั้งหมด"}
            </p>
          </section>
        ) : (
          <section className="flex flex-col gap-3" data-testid="sacred-map-list">
            {visible.map((loc) => {
              const m = loc.element ? EL[loc.element] : null
              const img = imageSrc(loc)
              const dist = userPos && isValidCoord(loc.lat, loc.lng) ? haversineKm(userPos, loc) : null
              return (
                <Link key={loc.id} href={`/v2/service/sacred-map/${loc.slug || loc.id}`} className={CARD + " flex gap-3 text-left"} data-testid="sacred-map-item">
                  <span className="relative size-16 flex-none overflow-hidden rounded-[12px] bg-v3-ghost-white">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" loading="lazy" className="size-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }} />
                    ) : <span className="grid size-full place-items-center text-[22px]">🙏</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-1.5">
                      <span className="min-w-0 flex-1 text-[14px] font-black leading-5 text-v3-navy">{loc.name}</span>
                      {m ? <span className="flex-none rounded-full px-2 py-[2px] text-[10px] font-bold" style={{ background: m.color + "22", color: m.color }}>{m.th}</span> : null}
                    </span>
                    {loc.deity ? <span className="block truncate text-[12px] text-v3-text-body">{loc.deity}</span> : null}
                    {loc.needs?.length ? (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {loc.needs.slice(0, 3).map((n) => <span key={n} className="rounded-full bg-[#FBEAF0] px-2 py-[1px] text-[10px] font-bold text-[#B14A6C]">{n}</span>)}
                      </span>
                    ) : null}
                    <span className="mt-1 flex items-center gap-2 text-[11px] text-v3-text-muted">
                      <span className="truncate">{[loc.province, dist ? fmtKm(dist) : null].filter(Boolean).join(" · ")}</span>
                      {loc.checkinCount > 0 ? <span className="ml-auto flex-none rounded-full bg-[#EAF7EA] px-2 py-[1px] font-bold text-[#3E7E3A]">เช็คอิน {loc.checkinCount}</span> : null}
                    </span>
                  </span>
                </Link>
              )
            })}
          </section>
        )}

        <p className="px-2 text-center text-[11px] leading-4 text-v3-text-muted">
          รู้จักสถานที่ศักดิ์สิทธิ์ที่ควรมี? <button type="button" onClick={openSubmit} className="font-bold text-v3-cyan">เสนอให้เราได้</button>
        </p>
      </div>

      {/* SUBMIT SHEET — เสนอสถานที่ (เข้าคิว pending รอแอดมิน) */}
      {submitOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45" onClick={() => setSubmitOpen(false)} data-testid="sacred-map-submit">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between border-b border-v3-border-card bg-white px-5 py-4">
              <h2 className="text-[17px] font-black text-v3-navy">เสนอสถานที่ศักดิ์สิทธิ์</h2>
              <button type="button" onClick={() => setSubmitOpen(false)} data-testid="sacred-map-submit-close" className="grid size-8 place-items-center rounded-full bg-v3-ghost-white text-[16px] font-bold text-v3-navy">✕</button>
            </div>

            {submitState === "done" ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center" data-testid="sacred-map-submit-done">
                <span className="text-[44px]">🙏</span>
                <p className="text-[16px] font-black text-v3-navy">ส่งให้ทีมงานตรวจแล้ว</p>
                <p className="text-[13px] leading-5 text-v3-text-body">ขอบคุณที่ช่วยแบ่งปัน สถานที่จะขึ้นแสดงบนแผนที่หลังแอดมินยืนยันความถูกต้อง</p>
                <button type="button" onClick={() => setSubmitOpen(false)} className="mt-3 grid h-11 w-full place-items-center rounded-full bg-v3-sapphire text-[14px] font-bold text-white">เรียบร้อย</button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 p-5">
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-bold text-v3-navy">ชื่อสถานที่ <span className="text-v3-error">*</span></span>
                  <input value={form.name} onChange={(e) => setF("name", e.target.value)} data-testid="sacred-map-submit-name" placeholder="เช่น ศาลเจ้าพ่อเสือ (เสาชิงช้า)" className="w-full rounded-xl border border-v3-border-card px-3 py-2 text-[14px] text-v3-navy outline-none focus:border-v3-sapphire" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-bold text-v3-navy">เทพ / สิ่งศักดิ์สิทธิ์</span>
                  <input value={form.deity} onChange={(e) => setF("deity", e.target.value)} placeholder="เช่น เจ้าพ่อเสือ (ตั่วเหล่าเอี๊ย)" className="w-full rounded-xl border border-v3-border-card px-3 py-2 text-[14px] text-v3-navy outline-none focus:border-v3-sapphire" />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] font-bold text-v3-navy">จังหวัด</span>
                    <input value={form.province} onChange={(e) => setF("province", e.target.value)} placeholder="กรุงเทพมหานคร" className="w-full rounded-xl border border-v3-border-card px-3 py-2 text-[14px] text-v3-navy outline-none focus:border-v3-sapphire" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] font-bold text-v3-navy">ธาตุ</span>
                    <select value={form.element} onChange={(e) => setF("element", e.target.value)} className="w-full rounded-xl border border-v3-border-card px-3 py-2 text-[14px] text-v3-navy outline-none focus:border-v3-sapphire">
                      <option value="">— ไม่ระบุ —</option>
                      {(["wood", "fire", "earth", "metal", "water"] as const).map((k) => <option key={k} value={k}>{EL[k].th}</option>)}
                    </select>
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-bold text-v3-navy">ที่อยู่</span>
                  <input value={form.address} onChange={(e) => setF("address", e.target.value)} placeholder="ถนน แขวง เขต" className="w-full rounded-xl border border-v3-border-card px-3 py-2 text-[14px] text-v3-navy outline-none focus:border-v3-sapphire" />
                </label>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold text-v3-navy">ขอพรเรื่อง</span>
                  <div className="flex flex-wrap gap-2">
                    {NEED_OPTIONS.map((n) => {
                      const on = form.needs.includes(n)
                      return (
                        <button key={n} type="button" onClick={() => setF("needs", on ? form.needs.filter((x) => x !== n) : [...form.needs, n])}
                          className={"rounded-full px-3 py-1 text-[12px] font-bold " + (on ? "bg-v3-sapphire text-white" : "bg-v3-ghost-white text-v3-navy")}>{n}</button>
                      )
                    })}
                  </div>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-bold text-v3-navy">ของไหว้ / วิธีสักการะ</span>
                  <textarea value={form.worshipGuide} onChange={(e) => setF("worshipGuide", e.target.value)} rows={2} placeholder="เช่น ไข่ต้ม หมูสามชั้น จุดธูป 18 ดอก" className="w-full resize-none rounded-xl border border-v3-border-card px-3 py-2 text-[14px] leading-5 text-v3-navy outline-none focus:border-v3-sapphire" />
                </label>

                {/* ตำแหน่ง (จำเป็น) */}
                <div className="flex flex-col gap-1.5 rounded-xl bg-v3-ghost-white p-3">
                  <span className="text-[12px] font-bold text-v3-navy">ตำแหน่ง <span className="text-v3-error">*</span></span>
                  <input value={form.googleMapUrl} onChange={(e) => onMapUrlChange(e.target.value)} data-testid="sacred-map-submit-mapurl" placeholder="วางลิงก์ Google Maps ที่นี่" className="w-full rounded-xl border border-v3-border-card px-3 py-2 text-[13px] text-v3-navy outline-none focus:border-v3-sapphire" />
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={usePinLocation} data-testid="sacred-map-submit-pin" className="flex-none rounded-full border border-v3-sapphire px-3 py-1.5 text-[12px] font-bold text-v3-sapphire">📍 {pinState === "asking" ? "กำลังปัก…" : "ใช้ตำแหน่งของฉัน"}</button>
                    {form.lat !== null && form.lng !== null ? (
                      <span className="text-[11px] font-bold text-[#3E7E3A]">✓ ปักแล้ว ({form.lat.toFixed(4)}, {form.lng.toFixed(4)})</span>
                    ) : <span className="text-[11px] text-v3-text-muted">ยังไม่ได้ปักตำแหน่ง</span>}
                  </div>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-bold text-v3-navy">ช่องทางติดต่อกลับ (ถ้ามี)</span>
                  <input value={form.contact} onChange={(e) => setF("contact", e.target.value)} placeholder="LINE / เบอร์โทร เผื่อทีมงานสอบถามเพิ่ม" className="w-full rounded-xl border border-v3-border-card px-3 py-2 text-[14px] text-v3-navy outline-none focus:border-v3-sapphire" />
                </label>

                {submitState === "error" && submitMsg ? <p className="text-[12px] font-bold text-v3-error" data-testid="sacred-map-submit-error">{submitMsg}</p> : null}

                <button type="button" onClick={() => void submitLocation()} disabled={submitState === "sending"} data-testid="sacred-map-submit-send" className="mt-1 grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-[15px] font-bold text-white disabled:opacity-50">
                  {submitState === "sending" ? "กำลังส่ง…" : "ส่งให้แอดมินตรวจ"}
                </button>
                <p className="text-center text-[11px] leading-4 text-v3-text-muted">สถานที่จะแสดงบนแผนที่หลังทีมงานยืนยันความถูกต้อง</p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <Menubar />
    </div>
  )
}

export default SacredMapScreen
