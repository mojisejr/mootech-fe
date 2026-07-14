import type { PillarColumn, PillarSlot } from '@/components/calculator/PillarGrid'
import type { BaziElement } from '@/lib/calculator/elements'

// Maps the compute API's `detail` object into the 5-pillar column order frozen by มุน's frame
// sheet: ลัคนา | ยาม | วัน | เดือน | ปี (day centered). Reads glyph char + element from
// `detail.<pillar>Above/Below`, NOT `summary.<pillar>.element` — see PillarGrid.tsx for why.
type DetailField = { chinese_symbol?: string; element?: string } | null | undefined

function toSlot(field: DetailField): PillarSlot {
  if (!field || !field.chinese_symbol) return null
  return { chinese_symbol: field.chinese_symbol, element: field.element as BaziElement }
}

export function mapPillarColumns(detail: Record<string, DetailField> | null | undefined): PillarColumn[] {
  const d = detail ?? {}
  return [
    { key: 'ascendant', label: 'ลัคนา', above: toSlot(d.ascendantAbove), below: toSlot(d.ascendantBelow), isDay: false },
    { key: 'time', label: 'ยาม', above: toSlot(d.timeAbove), below: toSlot(d.timeBelow), isDay: false },
    { key: 'day', label: 'วัน', above: toSlot(d.dayAbove), below: toSlot(d.dayBelow), isDay: true },
    { key: 'month', label: 'เดือน', above: toSlot(d.monthAbove), below: toSlot(d.monthBelow), isDay: false },
    { key: 'year', label: 'ปี', above: toSlot(d.yearAbove), below: toSlot(d.yearBelow), isDay: false },
  ]
}
