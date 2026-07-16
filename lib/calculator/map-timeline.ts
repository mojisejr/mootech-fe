import type { BaziElement } from '@/lib/calculator/elements'

export type DecadeLuckItem = { chinese_symbol: string; element: BaziElement; ageStart: number; ageEnd: number; isCurrent: boolean }
export type AnnualLuckItem = {
  year: number
  ceYear: number | null
  beYear: number | null
  above: { chinese_symbol: string; element: BaziElement }
  below: { chinese_symbol: string; element: BaziElement }
  isCurrent: boolean
}

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
    // #calc-decade-annual-current-fix:
    // - ageStart MUST stay = above's own ageStart in every case, unchanged from before — it's a
    //   join key consumed elsewhere by exact-match (findDecadePhasePair in map-enrichment.ts,
    //   findDecadeBadge in badges.ts, both do `daYun.findIndex(r => parseAgeStart(r.ageRange) ===
    //   decade.ageStart)`). Switching it per-card would silently break enrichment glyph-pairing
    //   and badge-matching on exactly the current card, for any birthdate where that join
    //   currently succeeds — a worse regression than the bug being fixed. Verified live: this
    //   join key is untouched by this fix.
    // - ageEnd now always spans the FULL decade (below's ageEnd, e.g. 40, not above's own 35) —
    //   safe (not a join key anywhere) and unambiguously correct regardless of which half is
    //   current, since a "decade" genuinely covers both 5-year halves.
    // - chinese_symbol/element anchor on whichever half is actually current (previously always
    //   above) — this is what ฟีม's bug report was really about: the highlighted "current" card
    //   showed above's stale symbol (戊) even when below (辰, dob 1989-01-03) was the real current
    //   pillar. Not a join key, safe to switch. Non-current cards keep the above-anchored
    //   convention (unaffected, unambiguous — matches the pre-existing single-symbol-per-card
    //   fallback design).
    const symbolAnchor = below?.isAge ? below : (above ?? below)
    out.push({
      chinese_symbol: symbolAnchor.id ?? '',
      element: symbolAnchor.element as BaziElement,
      ageStart: (above ?? below).ageStart,
      ageEnd: (below ?? above).ageEnd,
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

// #calc-decade-annual-current-fix: `year` is a 1-indexed "Nth year of life" counter, NOT a
// calendar year (year:1 = birth year itself). Two things this function now does that it didn't
// before:
//   1. Computes a REAL calendar year locally (ceYear/beYear) from birthYear + year - 1, so the
//      UI never has to fall back to "อีก N ปี" placeholder text just because the separate
//      bazi-sft-dataset enrichment call failed/timed out (it's best-effort/nullable by design).
//      Verified live: dob 1989-01-03, year:38 → ceYear 2026 — matches bazi-sft-dataset's own
//      liuNian row for age 38 exactly.
//   2. Flags isCurrent using the SAME "age" convention mootech-be used to generate `year` in the
//      first place (currentAge, threaded in from the already-fixed `cycleLife.age` — see
//      calculate-year.ts's calculateChineseAge on the backend) — not re-derived by a third,
//      independently-written age formula that could silently disagree with the first two.
export function mapAnnualLuck(
  cycleYearLife: RawYearEntry[] | null | undefined,
  birthYear: number | null | undefined,
  currentAge: number | null | undefined,
): AnnualLuckItem[] {
  if (!cycleYearLife) return []
  return cycleYearLife.map((y) => ({
    year: y.year,
    ceYear: birthYear != null ? birthYear + y.year - 1 : null,
    beYear: birthYear != null ? birthYear + y.year - 1 + 543 : null,
    above: { chinese_symbol: y.yearAbove.chinese_symbol, element: y.yearAbove.element as BaziElement },
    below: { chinese_symbol: y.yearBelow.chinese_symbol, element: y.yearBelow.element as BaziElement },
    isCurrent: currentAge != null && y.year === currentAge,
  }))
}
