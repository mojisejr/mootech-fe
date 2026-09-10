// features/v2-service/sacred-map-shared.ts — types + helpers ใช้ร่วมทั้งหน้า list และหน้า detail
export type SacredLocation = {
  id: string
  slug?: string | null
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
  updatedAt?: string | null
  googleMapUrl: string | null
  checkinCount: number
}

export const EL: Record<string, { th: string; color: string }> = {
  wood: { th: "ไม้", color: "#22c55e" },
  fire: { th: "ไฟ", color: "#ef4444" },
  earth: { th: "ดิน", color: "#eab308" },
  metal: { th: "ทอง", color: "#94a3b8" },
  water: { th: "น้ำ", color: "#3b82f6" },
}
export const NEED_OPTIONS = ["การงาน", "เงิน", "รัก", "สุขภาพ", "โชคลาภ", "จิตใจ"] as const
export const CHECKIN_KEY = "mumate-sacred-checkin"
export const SAVED_KEY = "mumate-sacred-saved"

// พิกัดที่ใช้ปักหมุดได้จริง — ต้องอยู่ในกรอบประเทศไทย (กัน seed เสีย เช่น 0,0 ไปโผล่แอฟริกา)
export function isValidCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 5.5 && lat <= 21 && lng >= 97 && lng <= 106
}

export function mapsLink(loc: SacredLocation): string {
  if (loc.googleMapUrl && loc.googleMapUrl.trim()) return loc.googleMapUrl.trim()
  const q = isValidCoord(loc.lat, loc.lng)
    ? `${loc.name ?? ""} ${loc.lat},${loc.lng}`.trim()
    : [loc.name, loc.province].filter(Boolean).join(" ")
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}
/** รูป: เสิร์ฟจาก engine (base64) ถ้ามี ไม่งั้น fallback imageUrl เดิม (supabase) */
export function imageSrc(loc: SacredLocation): string | null {
  if (loc.hasImage) return `/api/v2/sacred-map/image/${encodeURIComponent(loc.id)}?v=${encodeURIComponent(loc.updatedAt ?? "")}`
  return loc.imageUrl || null
}
/** ตั้งเตือน = สร้าง event บน Google Calendar (เตือนไปไหว้) */
export function calendarLink(loc: SacredLocation): string {
  const text = encodeURIComponent(`ไปไหว้ ${loc.name}`)
  const details = encodeURIComponent(`${loc.deity ? loc.deity + "\n" : ""}${mapsLink(loc)}`)
  const location = encodeURIComponent(loc.address || loc.province || "")
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&location=${location}`
}
// ── ระยะทาง/เส้นทาง (ตำแหน่งผู้ใช้จริง; ไม่ประดิษฐ์ turn-by-turn) ──
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}
export function fmtKm(km: number): string { return km < 1 ? `${Math.round(km * 1000)} ม.` : `${km.toFixed(1)} กม.` }
// ความเร็วเฉลี่ยในเมือง (km/h) × 1.3 อ้อมถนน → เวลาโดยประมาณ (ระบุ ~ ให้ชัดว่าไม่เป๊ะ)
export const TRAVEL: { key: "transit" | "driving" | "walking"; th: string; icon: string; kmh: number }[] = [
  { key: "transit", th: "รถไฟฟ้า", icon: "🚈", kmh: 18 },
  { key: "driving", th: "รถยนต์", icon: "🚗", kmh: 24 },
  { key: "walking", th: "เดิน", icon: "🚶", kmh: 4.8 },
]
export function estMin(km: number, kmh: number): number { return Math.max(1, Math.round((km / kmh) * 60 * 1.3)) }
export function dirLink(loc: SacredLocation, mode: string, from: { lat: number; lng: number } | null): string {
  const dest = isValidCoord(loc.lat, loc.lng) ? `${loc.lat},${loc.lng}` : encodeURIComponent([loc.name, loc.province].filter(Boolean).join(" "))
  const origin = from ? `&origin=${from.lat},${from.lng}` : ""
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}${origin}&travelmode=${mode}`
}

export function readSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}
