// 納音 (นับอิม) ธาตุ ต่อ 60 เสา (干支) — ตารางคลาสสิก 30 คู่ (เสาติดกันใช้ 納音 เดียวกัน).
// ใช้ลงสีพื้นชิป 干支 บนการ์ดคะแนน ตามธาตุนับอิม (เอกสารซินแส "ตัวอักษรขาว พื้นตามสีนับอิม").
// static ล้วน — ไม่พึ่ง engine (นับอิมเป็นวัฏจักรตายตัวของ 60 jiazi).
import type { BaziElement } from '@/lib/calculator/elements'

// 30 คู่ 干支 → ธาตุ納音 (甲子乙丑 海中金 = METAL ... 壬戌癸亥 大海水 = WATER)
const NAYIN_PAIRS: [string, string, BaziElement][] = [
  ['甲子', '乙丑', 'METAL'], ['丙寅', '丁卯', 'FIRE'], ['戊辰', '己巳', 'WOOD'],
  ['庚午', '辛未', 'EARTH'], ['壬申', '癸酉', 'METAL'], ['甲戌', '乙亥', 'FIRE'],
  ['丙子', '丁丑', 'WATER'], ['戊寅', '己卯', 'EARTH'], ['庚辰', '辛巳', 'METAL'],
  ['壬午', '癸未', 'WOOD'], ['甲申', '乙酉', 'WATER'], ['丙戌', '丁亥', 'EARTH'],
  ['戊子', '己丑', 'FIRE'], ['庚寅', '辛卯', 'WOOD'], ['壬辰', '癸巳', 'WATER'],
  ['甲午', '乙未', 'METAL'], ['丙申', '丁酉', 'FIRE'], ['戊戌', '己亥', 'WOOD'],
  ['庚子', '辛丑', 'EARTH'], ['壬寅', '癸卯', 'METAL'], ['甲辰', '乙巳', 'FIRE'],
  ['丙午', '丁未', 'WATER'], ['戊申', '己酉', 'EARTH'], ['庚戌', '辛亥', 'METAL'],
  ['壬子', '癸丑', 'WOOD'], ['甲寅', '乙卯', 'WATER'], ['丙辰', '丁巳', 'EARTH'],
  ['戊午', '己未', 'FIRE'], ['庚申', '辛酉', 'WOOD'], ['壬戌', '癸亥', 'WATER'],
]

const NAYIN_ELEMENT: Record<string, BaziElement> = Object.fromEntries(
  NAYIN_PAIRS.flatMap(([a, b, el]) => [[a, el], [b, el]]),
)

/** ธาตุ納音 (นับอิม) ของเสา 干支 เช่น "辛卯" → 'WOOD'. null ถ้ารูปแบบไม่ตรง/ไม่รู้จัก. */
export function nayinElement(ganzhi: string | null | undefined): BaziElement | null {
  if (!ganzhi) return null
  return NAYIN_ELEMENT[ganzhi.trim()] ?? null
}
