// features/v2-service/components/SacredPlaceDetailScreen.tsx — /v2/service/sacred-map/[id]
// หน้ารายละเอียดสถานที่ศักดิ์สิทธิ์ (หน้าแยก ไม่ใช่ modal) ตาม Figma 55666-4641
// header = back + "สถานที่ศักดิ์สิทธิ์" + กระดิ่ง + โปรไฟล์ · การ์ดเส้นทาง + คำทำนายรายด้าน + ชวนเพื่อน
import Head from "next/head"
import { useEffect, useState } from "react"

import { SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { TopBarBell } from "@/features/v2-shell/components/TopBarBell"
import { TopBarAvatar } from "@/features/v2-shell/components/TopBarAvatar"
import {
  CHECKIN_KEY, EL, SAVED_KEY, TRAVEL, calendarLink, dirLink, estMin, fmtKm,
  haversineKm, imageSrc, isValidCoord, mapsLink, readSet, type SacredLocation,
} from "@/features/v2-service/sacred-map-shared"

export function SacredPlaceDetailScreen({ loc }: { loc: SacredLocation }) {
  const [saved, setSaved] = useState(false)
  const [checked, setChecked] = useState(false)
  const [checkinCount, setCheckinCount] = useState(loc.checkinCount)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const [geoState, setGeoState] = useState<"idle" | "asking" | "denied">("idle")
  const [travelMode, setTravelMode] = useState<"transit" | "driving" | "walking">("transit")
  const [shareOpen, setShareOpen] = useState(false)
  const [shareOpts, setShareOpts] = useState({ route: true, guide: true, direction: false })
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [qiToast, setQiToast] = useState<string | null>(null)

  useEffect(() => {
    setSaved(readSet(SAVED_KEY).has(loc.id))
    setChecked(readSet(CHECKIN_KEY).has(loc.id))
  }, [loc.id])

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setGeoState("denied"); return }
    setGeoState("asking")
    navigator.geolocation.getCurrentPosition(
      (p) => { setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setGeoState("idle") },
      () => setGeoState("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    )
  }, [])

  const requestLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setGeoState("denied"); return }
    setGeoState("asking")
    navigator.geolocation.getCurrentPosition(
      (p) => { setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setGeoState("idle") },
      () => setGeoState("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    )
  }

  const dist = userPos && isValidCoord(loc.lat, loc.lng) ? haversineKm(userPos, loc) : null
  const m = loc.element ? EL[loc.element] : null
  const img = imageSrc(loc)

  const toggleSave = () => {
    const next = readSet(SAVED_KEY)
    if (next.has(loc.id)) next.delete(loc.id); else next.add(loc.id)
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(Array.from(next))) } catch { /* ignore */ }
    setSaved(next.has(loc.id))
  }
  const checkin = async () => {
    if (checked) return
    const next = readSet(CHECKIN_KEY).add(loc.id)
    try { localStorage.setItem(CHECKIN_KEY, JSON.stringify(Array.from(next))) } catch { /* ignore */ }
    setChecked(true); setCheckinCount((c) => c + 1)
    await fetch("/api/v2/sacred-map", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: loc.id }) }).catch(() => {})
  }

  const openShare = () => {
    setShareOpts({ route: true, guide: true, direction: false })
    setShareOpen(true)
    if (inviteCode === null) {
      void fetch("/api/referral").then((r) => (r.ok ? r.json() : null)).then((j) => { if (typeof j?.code === "string") setInviteCode(j.code) }).catch(() => {})
    }
  }
  const buildShareUrl = (): string => {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const p = new URLSearchParams({ r: shareOpts.route ? "1" : "0", g: shareOpts.guide ? "1" : "0", d: shareOpts.direction ? "1" : "0" })
    if (inviteCode) p.set("invite", inviteCode)
    return `${origin}/p/${encodeURIComponent(loc.slug || loc.id)}?${p}`
  }
  const earnShareQi = async () => {
    try {
      const res = await fetch("/api/qi-earn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "share" }) })
      const j = await res.json().catch(() => ({}))
      if (j?.awarded) { setQiToast("+10 QI"); setTimeout(() => setQiToast(null), 2500) }
    } catch { /* ignore */ }
  }
  const doShare = (target: "line" | "facebook" | "copy" | "more") => {
    const url = buildShareUrl()
    const text = `ไปมูกันไหม ${loc.name}${shareOpts.guide ? " มีเส้นทางกับโพยการมูให้พร้อมเลย" : ""}`
    void earnShareQi()
    if (target === "line") window.open(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`, "_blank", "noopener")
    else if (target === "facebook") window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank", "noopener")
    else if (target === "copy") { void navigator.clipboard?.writeText(url).then(() => { setQiToast((t) => t ?? "คัดลอกลิงก์แล้ว"); setTimeout(() => setQiToast(null), 2000) }).catch(() => {}) }
    else if (navigator.share) void navigator.share({ title: loc.name, text, url }).catch(() => {})
    else void navigator.clipboard?.writeText(url).catch(() => {})
  }

  const needsText = loc.needs?.length ? loc.needs.join(" ") : "เสริมดวง"
  const toggles: { key: keyof typeof shareOpts; label: string; hint: string }[] = [
    { key: "route", label: "แนบเส้นทางจากตำแหน่งเพื่อน", hint: "เพื่อนกดแล้วเปิด Google Maps ได้เลย" },
    { key: "guide", label: "แนบโพยการมู", hint: "ของไหว้ วันเวลา และคำอธิษฐาน" },
    { key: "direction", label: "แนบทิศมงคลของฉัน", hint: "ทิศของเพื่อนอาจต่างจากคุณ" },
  ]
  const shareBtns: { key: "line" | "facebook" | "copy" | "more"; label: string; icon: string; tone: string }[] = [
    { key: "line", label: "LINE", icon: "💬", tone: "text-[#06C755]" },
    { key: "facebook", label: "Facebook", icon: "f", tone: "text-[#1877F2]" },
    { key: "copy", label: "คัดลอกลิงก์", icon: "🔗", tone: "text-v3-text-muted" },
    { key: "more", label: "เพิ่มเติม", icon: "···", tone: "text-v3-text-muted" },
  ]

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-v3-bg-cream font-ibm">
      <SkyBackdrop height={340} />
      <Head><title>{loc.name} · แผนที่ศักดิ์สิทธิ์ · MuMate</title></Head>
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-32 pt-2">
        <SkyHeader
          title="สถานที่ศักดิ์สิทธิ์"
          backHref="/v2/service/sacred-map"
          testId="sacred-place"
          right={<span className="flex items-center gap-2"><TopBarBell variant="solid" href="/v2/calendar/notifications" /><TopBarAvatar variant="sapphire" href="/v2/account" /></span>}
        />

        {/* hero */}
        <div className="overflow-hidden rounded-[24px] bg-white v3-shadow-card">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={loc.name} className="aspect-[16/10] w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }} />
          ) : <div className="grid aspect-[16/10] w-full place-items-center bg-v3-ghost-white text-[44px]">🙏</div>}
        </div>

        {/* หัวเรื่อง */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-[20px] font-black leading-6 text-v3-navy">{loc.name}</h1>
            {m ? <span className="mt-0.5 flex-none rounded-full px-2 py-[2px] text-[11px] font-bold" style={{ background: m.color + "22", color: m.color }}>{m.th}</span> : null}
          </div>
          {loc.deity ? <p className="text-[13px] text-v3-text-body">{loc.deity}</p> : null}
          {loc.needs?.length ? (
            <div className="flex flex-wrap gap-1">
              {loc.needs.map((n) => <span key={n} className="rounded-full bg-[#FBEAF0] px-2 py-[1px] text-[11px] font-bold text-[#B14A6C]">{n}</span>)}
            </div>
          ) : null}
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-v3-text-muted">
            <span>{[loc.province, dist ? fmtKm(dist) : null].filter(Boolean).join(" · ")}</span>
            {checkinCount > 0 ? <span className="ml-auto rounded-full bg-[#EAF7EA] px-2 py-[1px] font-bold text-[#3E7E3A]">เช็คอิน {checkinCount}</span> : null}
          </div>
        </div>

        {/* การ์ดเส้นทาง */}
        <section className="rounded-[18px] border border-v3-border-card bg-white p-4" data-testid="sacred-place-route">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-black text-v3-navy">เส้นทางจากตำแหน่งคุณ</h2>
            {dist ? <span className="text-[15px] font-black text-v3-sapphire">{fmtKm(dist)}</span> : null}
          </div>
          <div className="my-3 border-t border-dashed border-v3-border-card" />
          {userPos ? (
            <div className="grid grid-cols-3 gap-2">
              {TRAVEL.map((t) => {
                const on = travelMode === t.key
                return (
                  <button key={t.key} type="button" onClick={() => setTravelMode(t.key)} data-testid={`sacred-place-mode-${t.key}`}
                    className={"flex flex-col items-center gap-0.5 rounded-[14px] border py-2.5 " + (on ? "border-v3-sapphire bg-[#EAF3FF]" : "border-v3-border-card bg-white")}>
                    <span className="text-[20px] leading-none">{t.icon}</span>
                    <span className={"text-[12px] font-bold " + (on ? "text-v3-sapphire" : "text-v3-navy")}>{t.th}</span>
                    {dist ? <span className="text-[11px] text-v3-text-muted">~{estMin(dist, t.kmh)} นาที</span> : null}
                  </button>
                )
              })}
            </div>
          ) : (
            <button type="button" onClick={requestLocation} data-testid="sacred-place-geo" className="grid h-11 w-full place-items-center rounded-full border border-v3-border-card bg-white text-[13px] font-bold text-v3-sapphire">
              {geoState === "asking" ? "กำลังขอตำแหน่ง…" : geoState === "denied" ? "เปิดตำแหน่งเพื่อดูเวลาเดินทาง" : "แชร์ตำแหน่งเพื่อดูเวลาเดินทาง"}
            </button>
          )}
          {dist ? <p className="mt-2 text-center text-[10px] text-v3-text-muted">เวลาโดยประมาณ · เปิด Google Maps เพื่อดูเส้นทางจริง</p> : null}
          <a href={dirLink(loc, travelMode, userPos)} target="_blank" rel="noopener noreferrer" data-testid="sacred-place-maps"
            className="mt-3 grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-[14px] font-bold text-white">เปิดใน GOOGLE MAPS</a>
        </section>

        {/* คำทำนายรายด้าน */}
        {(loc.worshipGuide || loc.direction || loc.needs?.length) ? (
          <section className="rounded-[18px] border border-v3-border-card bg-white p-4" data-testid="sacred-place-guide">
            <h2 className="text-[15px] font-black text-v3-navy">คำทำนายรายด้าน</h2>
            <div className="my-3 border-t border-dashed border-v3-border-card" />
            <div className="flex flex-col gap-2">
              {loc.worshipGuide ? (
                <div className="rounded-[12px] bg-[#EDF7EE] p-3">
                  <p className="text-[13px] font-black text-[#2F7A46]">ของไหว้</p>
                  <p className="mt-0.5 whitespace-pre-line text-[13px] leading-5 text-v3-text-body">{loc.worshipGuide}</p>
                </div>
              ) : null}
              {loc.direction ? (
                <div className="rounded-[12px] bg-[#EDF7EE] p-3">
                  <p className="text-[13px] font-black text-[#2F7A46]">ทิศมงคลของคุณ</p>
                  <p className="mt-0.5 text-[13px] leading-5 text-v3-text-body">หันหน้าไปทาง{loc.direction}</p>
                </div>
              ) : null}
              {loc.needs?.length ? (
                <div className="rounded-[12px] bg-[#EDF7EE] p-3">
                  <p className="text-[13px] font-black text-[#2F7A46]">คำอธิษฐาน</p>
                  <p className="mt-0.5 text-[13px] leading-5 text-v3-text-body">ขอเรื่อง{loc.needs.join(" และ ")}</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* ปุ่มจัดการ */}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={toggleSave} data-testid="sacred-place-save" className={"grid h-11 place-items-center rounded-full border text-[13px] font-bold " + (saved ? "border-transparent bg-[#FFF3E0] text-[#C77800]" : "border-v3-border-card bg-white text-v3-navy")}>{saved ? "★ บันทึกแล้ว" : "☆ บันทึก"}</button>
          <button type="button" onClick={() => void checkin()} disabled={checked} data-testid="sacred-place-checkin" className={"grid h-11 place-items-center rounded-full border text-[13px] font-bold " + (checked ? "border-transparent bg-[#EAF7EA] text-[#3E7E3A]" : "border-v3-border-card bg-white text-v3-navy")}>{checked ? "✓ เช็คอินแล้ว" : "📍 เช็คอิน"}</button>
          <a href={calendarLink(loc)} target="_blank" rel="noopener noreferrer" className="grid h-11 place-items-center rounded-full border border-v3-border-card bg-white text-[13px] font-bold text-v3-navy" data-testid="sacred-place-remind">⏰ ตั้งเตือน</a>
          <button type="button" onClick={openShare} data-testid="sacred-place-share" className="grid h-11 place-items-center rounded-full border border-v3-border-card bg-white text-[13px] font-bold text-v3-navy">↗ ชวนเพื่อน</button>
        </div>
      </div>

      {/* SHARE SHEET */}
      {shareOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45" onClick={() => setShareOpen(false)} data-testid="sacred-place-share-sheet">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-black text-v3-navy">ชวนเพื่อนไปมูด้วยกัน</h2>
              <span className="rounded-full bg-[#EAF7EA] px-2.5 py-1 text-[12px] font-black text-[#3E7E3A]">+10 QI</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-[18px] border border-v3-border-card">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" className="aspect-[16/9] w-full object-cover" />
              ) : <div className="grid aspect-[16/9] w-full place-items-center bg-v3-ghost-white text-[36px]">🙏</div>}
              <div className="p-3">
                <p className="text-[14px] font-black text-v3-navy">{loc.name}</p>
                <p className="mt-0.5 text-[12px] leading-4 text-v3-text-body">คุณพี่มูชวนคุณไปขอพรเรื่อง{needsText}{shareOpts.route || shareOpts.guide ? " · มี" : ""}{shareOpts.route ? "เส้นทาง" : ""}{shareOpts.route && shareOpts.guide ? "และ" : ""}{shareOpts.guide ? "โพยการมู" : ""}{shareOpts.route || shareOpts.guide ? "ให้พร้อม" : ""}</p>
                <p className="mt-1 text-[11px] text-v3-text-muted">mumate.co</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {toggles.map((t) => {
                const on = shareOpts[t.key]
                return (
                  <button key={t.key} type="button" onClick={() => setShareOpts((s) => ({ ...s, [t.key]: !s[t.key] }))} data-testid={`sacred-place-share-${t.key}`}
                    className="flex items-center justify-between gap-3 rounded-[14px] border border-v3-border-card px-4 py-3 text-left">
                    <span className="min-w-0">
                      <span className="block text-[14px] font-bold text-v3-navy">{t.label}</span>
                      <span className="block text-[11px] leading-4 text-v3-text-muted">{t.hint}</span>
                    </span>
                    <span className={"relative h-6 w-11 flex-none rounded-full transition-colors " + (on ? "bg-v3-sapphire" : "bg-v3-border-card")}>
                      <span className={"absolute top-0.5 size-5 rounded-full bg-white shadow transition-all " + (on ? "left-[22px]" : "left-0.5")} />
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-5 text-center text-[15px] font-black text-v3-sapphire">แชร์ลิงก์ชวนเพื่อน</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {shareBtns.map((b) => (
                <button key={b.key} type="button" onClick={() => doShare(b.key)} data-testid={`sacred-place-share-btn-${b.key}`}
                  className="flex flex-col items-center gap-1.5 rounded-[14px] border border-v3-border-card py-3">
                  <span className={"grid size-9 place-items-center rounded-full bg-v3-ghost-white text-[16px] font-black " + b.tone}>{b.icon}</span>
                  <span className="text-[11px] font-bold text-v3-navy">{b.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-[11px] leading-4 text-v3-text-muted">ได้ +10 QI เมื่อกดแชร์ วันละ 1 ครั้ง · ถ้าเพื่อนสมัครจากลิงก์รับเพิ่ม 50 QI</p>
          </div>
        </div>
      ) : null}

      {qiToast ? (
        <div className="fixed inset-x-0 bottom-24 z-[70] flex justify-center" data-testid="sacred-place-qi-toast">
          <span className="rounded-full bg-v3-navy px-4 py-2 text-[13px] font-bold text-v3-lime shadow-lg">{qiToast}</span>
        </div>
      ) : null}

      <Menubar />
    </div>
  )
}

export default SacredPlaceDetailScreen
