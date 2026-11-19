// ปีชง 2570 — animal names and character images by earthly branch, from the app's zodiac table.
import { ZODIAC_TABLE } from '@/lib/personalization/zodiac'

export const ELEMENT_TH: Record<string, string> = { wood: 'ไม้', fire: 'ไฟ', earth: 'ดิน', metal: 'ทอง', water: 'น้ำ' }

export function animalTh(branch: string): string {
  return ZODIAC_TABLE.find((z) => z.branch === branch)?.th ?? ''
}

/** /images/v2/characters/NN_<animal>-<element>.webp — the 60 MuMate characters. */
export function animalImage(branch: string, elementTh: string): string {
  const z = ZODIAC_TABLE.find((e) => e.branch === branch)
  return z ? `/images/v2/characters/${z.order}_${z.th}-${elementTh}.webp` : '/images/v2/mascot/01.webp'
}

/** The wheel around the goat medallion: every branch but 未. */
export const WHEEL_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '申', '酉', '戌', '亥']

/** The twelve months of the Goat year, by branch (寅 opens at Lichun, 4 Feb 2027). */
export const MONTH_LABEL: Record<string, { name: string; short: string }> = {
  寅: { name: 'เสือ', short: 'ก.พ.' }, 卯: { name: 'กระต่าย', short: 'มี.ค.' }, 辰: { name: 'มังกร', short: 'เม.ย.' },
  巳: { name: 'งูเล็ก', short: 'พ.ค.' }, 午: { name: 'ม้า', short: 'มิ.ย.' }, 未: { name: 'แพะ', short: 'ก.ค.' },
  申: { name: 'ลิง', short: 'ส.ค.' }, 酉: { name: 'ไก่', short: 'ก.ย.' }, 戌: { name: 'หมา', short: 'ต.ค.' },
  亥: { name: 'หมู', short: 'พ.ย.' }, 子: { name: 'หนู', short: 'ธ.ค.' }, 丑: { name: 'วัว', short: 'ม.ค. 71' },
}
