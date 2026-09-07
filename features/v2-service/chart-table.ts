// features/v2-service/chart-table.ts — ตารางดวงจีน (Figma 720:32490 §"ตารางดวงจีน") · contract จาก engine
// (bazi-sft-dataset src/lib/bazi/chart-table.ts). pair-match แนบที่ persons.a/b.chart · work แนบที่ comparison.charts.
// FE ไม่คำนวณก้านกิ่ง/ธาตุ/นักษัตรเอง — อ่านจาก engine อย่างเดียว; ค่าที่ไม่ครบ = ไม่วาด ไม่เดา.

export type ChartPillar = { stem: string; branch: string; stemElement: string; branchElement: string; animal: string }
export type ChartDaYun = ChartPillar & { startAge: number; endAge: number; ageRange: string }
export type ChartLiuNian = ChartPillar & { year: number; yearBE: number; age: number }
export type ChartTable = {
  birthDate: string
  birthTime: string | null
  dayElement: string
  pillars: { year: ChartPillar; month: ChartPillar; day: ChartPillar; hour: ChartPillar; ascendant: ChartPillar | null }
  daYun: ChartDaYun[]
  liuNian: ChartLiuNian[]
}

/** สีตัวก้าน/กิ่งในตาราง — hex จริงจาก design context ของ Figma 720:32490 §ตารางดวงจีน + 758:3239 (2026-09-07)
 *  (ทองใช้เทาตาม variable "สีธาตุ/ทอง/ตัวอักษร" — ในไฟล์มีทั้งเทาและส้มปน เลือกเทาให้ตรง legend) */
export const CHART_ELEMENT_INK: Record<string, string> = {
  'ไม้': '#43A047',
  'ไฟ': '#E53935',
  'ดิน': '#8D6E63',
  'ทอง': '#818181',
  'โลหะ': '#818181',
  'น้ำ': '#1B9AAF',
}
/** Figma variables "สีธาตุ/<ธาตุ>/พื้นหลัง" + "/ตัวอักษร" — พื้น/ตัวหนังสือของชิปธาตุ (legend, ชิปธาตุดิถี, กล่องปฏิกิริยาธาตุ) */
export const CHART_ELEMENT_SOFT: Record<string, string> = {
  'ไม้': '#E8F5E9',
  'ไฟ': '#FCE4EC',
  'ดิน': '#F9F4F0',
  'ทอง': '#EEEEEE',
  'โลหะ': '#EEEEEE',
  'น้ำ': '#ECF0FD',
}
export const CHART_PILL_INK: Record<string, string> = {
  'ไม้': '#2E7D32',
  'ไฟ': '#E53935',
  'ดิน': '#8D6E63',
  'ทอง': '#818181',
  'โลหะ': '#818181',
  'น้ำ': '#1B9AAF',
}
export const CHART_LEGEND: readonly string[] = ['น้ำ', 'ดิน', 'ไฟ', 'ไม้', 'ทอง'] as const

export function chartInk(elementTh?: string | null): string {
  return CHART_ELEMENT_INK[(elementTh ?? '').trim()] ?? '#1A264D'
}

function isPillar(v: unknown): v is ChartPillar {
  const p = v as ChartPillar | null
  return !!p && typeof p === 'object' && typeof p.stem === 'string' && typeof p.branch === 'string'
}

/** อ่าน chart จาก blob ที่ engine ส่ง — คืน null เมื่อไม่ครบ 4 เสา (ผลเก่าก่อน 2026-09-07 ไม่มี chart) */
export function readChartTable(raw: unknown): ChartTable | null {
  const c = raw as Partial<ChartTable> | null
  if (!c || typeof c !== 'object' || !c.pillars) return null
  const p = c.pillars as Partial<ChartTable['pillars']>
  if (!isPillar(p.year) || !isPillar(p.month) || !isPillar(p.day) || !isPillar(p.hour)) return null
  return {
    birthDate: typeof c.birthDate === 'string' ? c.birthDate : '',
    birthTime: typeof c.birthTime === 'string' ? c.birthTime : null,
    dayElement: typeof c.dayElement === 'string' ? c.dayElement : p.day.stemElement ?? '',
    pillars: { year: p.year, month: p.month, day: p.day, hour: p.hour, ascendant: isPillar(p.ascendant) ? p.ascendant : null },
    daYun: Array.isArray(c.daYun) ? (c.daYun as ChartDaYun[]).filter(isPillar) : [],
    liuNian: Array.isArray(c.liuNian) ? (c.liuNian as ChartLiuNian[]).filter(isPillar) : [],
  }
}
