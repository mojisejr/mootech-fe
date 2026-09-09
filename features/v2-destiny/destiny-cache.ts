// CLIENT cache ของผล /api/destiny — MEMORY-ONLY (ไม่ลง localStorage: ดวงเป็น PII, จุดยืนเดียวกับ
// summary-cache.ts/chart-cache.ts). อยู่ระดับ module → คงอยู่ข้ามการสลับหน้าใน SPA (pages router
// client-nav) แต่หายเมื่อ reload/ปิดแท็บ. จุดประสงค์: กดเข้าหน้าดวงซ้ำระหว่าง session ไม่ต้องยิง
// /api/destiny ใหม่ (ซึ่งฝั่ง server ก็มี DB cache ต่อวันเวลาเกิดอีกชั้น — 0021_destiny_cache).
// ล้างเมื่อ: แก้วันเกิดสำเร็จ (birth เปลี่ยน) + logout.
import type { DestinyData } from "@/features/v2-destiny/components/DestinyScreen"

let CACHE: DestinyData | null = null

export function getDestinyCache(): DestinyData | null {
  return CACHE
}

export function setDestinyCache(data: DestinyData): void {
  CACHE = data
}

/** ล้าง cache — เรียกตอนแก้วันเกิดสำเร็จ (ดวงต้องคำนวณใหม่) และตอน logout */
export function clearDestinyCache(): void {
  CACHE = null
}
