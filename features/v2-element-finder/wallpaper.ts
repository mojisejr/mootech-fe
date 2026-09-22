// features/v2-element-finder/wallpaper.ts — assets + สุ่มสำหรับ wallpaper "มาหาธาตุแท้"
// (Quiz Mumate · Kittipon/gafiw 2026-09-22). องค์ประกอบ = BG (ตามธาตุ→สุ่ม) + Character (การ์ด 60 โปร่งใส)
// + Text (คำ 15 แบบ สุ่มล้วน). ไฟล์อยู่ public/images/v2/element-finder/{bg,text}/.
import type { ElementKey } from "./content"

const BG_DIR = "/images/v2/element-finder/bg"
const TEXT_DIR = "/images/v2/element-finder/text"

// BG 3 แบบต่อธาตุ (ตรงชื่อไฟล์จริงจาก Kittipon: 1_ไม้..15_น้ำ). เลือกตามธาตุผู้ใช้ แล้วสุ่ม 1 ใน 3.
export const ELEMENT_BG: Record<ElementKey, readonly string[]> = {
  ไม้: [`${BG_DIR}/1_ไม้.png`, `${BG_DIR}/2_ไม้.png`, `${BG_DIR}/3_ไม้.png`],
  ไฟ: [`${BG_DIR}/4_ไฟ.png`, `${BG_DIR}/5_ไฟ.png`, `${BG_DIR}/6_ไฟ.png`],
  ดิน: [`${BG_DIR}/7_ดิน.png`, `${BG_DIR}/8_ดิน.png`, `${BG_DIR}/9_ดิน.png`],
  ทอง: [`${BG_DIR}/10_ทอง.png`, `${BG_DIR}/11_ทอง.png`, `${BG_DIR}/12_ทอง.png`],
  น้ำ: [`${BG_DIR}/13_น้ำ.png`, `${BG_DIR}/14_น้ำ.png`, `${BG_DIR}/15_น้ำ.png`],
}

// คำ 15 แบบ (สุ่มล้วน ไม่ผูกธาตุ) — 1.png..15.png
export const TEXT_OVERLAYS: readonly string[] = Array.from({ length: 15 }, (_, i) => `${TEXT_DIR}/${i + 1}.png`)

const pickRandom = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

export type WallpaperPick = { bg: string; text: string }

/** สุ่ม 1 ชุด: BG ตามธาตุ (1 ใน 3) + Text (1 ใน 15). กด "สุ่มใหม่" ได้เรื่อย ๆ */
export function pickWallpaper(element: ElementKey): WallpaperPick {
  return { bg: pickRandom(ELEMENT_BG[element]), text: pickRandom(TEXT_OVERLAYS) }
}
