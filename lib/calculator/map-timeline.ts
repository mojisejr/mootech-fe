import type { BaziElement } from '@/lib/calculator/elements'

export type DecadeLuckItem = { chinese_symbol: string; element: BaziElement; ageStart: number; ageEnd: number; isCurrent: boolean }
export type AnnualLuckItem = { year: number; above: { chinese_symbol: string; element: BaziElement }; below: { chinese_symbol: string; element: BaziElement } }

type RawLifeEntry = { id: string; element: string; ageStart: number; ageEnd: number; is_above: boolean; isAge?: boolean }

// Byte-for-byte port of box-chinese-table.tsx's `getDisplayResultCycle` (already shipped,
// production-proven on /my-destiny) — NOT a re-derivation. The raw `cycleLife.life` array's
// above/below pairing isn't obvious from field names alone (ageStart doesn't line up the way a
// naive "stem+branch share one age window" reading would suggest), so this deliberately copies
// the exact loop rather than reinterpreting it — including the hardcoded cap at 18 items (not
// the full 20), which matches the reference's 9-column grid.
function getDisplayResultCycle(raws: RawLifeEntry[] | undefined, wantAbove: boolean): RawLifeEntry[] {
  const result: RawLifeEntry[] = []
  const display: RawLifeEntry[] = []
  if (raws && raws.length > 0) {
    for (let i = 0; i < 18; i++) result.push(raws[i])
    for (let i = result.length - 1; i >= 0; i--) {
      if (wantAbove ? i % 2 === 0 : i % 2 === 1) display.push(result[i])
    }
  }
  return display
}

export function mapDecadeLuck(cycleLife: { life?: RawLifeEntry[] } | null | undefined): DecadeLuckItem[] {
  const aboveRow = getDisplayResultCycle(cycleLife?.life, true)
  const belowRow = getDisplayResultCycle(cycleLife?.life, false)
  const out: DecadeLuckItem[] = []
  for (let i = 0; i < Math.max(aboveRow.length, belowRow.length); i++) {
    const above = aboveRow[i]
    const below = belowRow[i]
    if (!above && !below) continue
    const anchor = above ?? below
    out.push({
      chinese_symbol: above?.id ?? '',
      element: (above?.element as BaziElement) ?? (below?.element as BaziElement),
      ageStart: anchor.ageStart,
      ageEnd: anchor.ageEnd,
      isCurrent: !!(above?.isAge || below?.isAge),
    })
  }
  return out
}

type RawYearEntry = {
  year: number
  yearAbove: { chinese_symbol: string; element: string }
  yearBelow: { chinese_symbol: string; element: string }
}

export function mapAnnualLuck(cycleYearLife: RawYearEntry[] | null | undefined): AnnualLuckItem[] {
  if (!cycleYearLife) return []
  return cycleYearLife.map((y) => ({
    year: y.year,
    above: { chinese_symbol: y.yearAbove.chinese_symbol, element: y.yearAbove.element as BaziElement },
    below: { chinese_symbol: y.yearBelow.chinese_symbol, element: y.yearBelow.element as BaziElement },
  }))
}
