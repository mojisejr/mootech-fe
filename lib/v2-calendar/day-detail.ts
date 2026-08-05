// lib/v2-calendar/day-detail.ts — the day-detail BFF mapper (goo lane). Trims the ~2.3MB man-vs-day +
// almanac reply down to only what the day screen renders. EVERY field traces back to a raw upstream field —
// the pipe invents nothing (gates carry no good/bad level — ตำราไม่มี, ส่งดิบ; colors stay Thai names, no hex).
//
// TWO upstreams: man-vs-day(day) embeds only 9 almanac keys; deity · spirits(8เทพ) · thaiLunar(วันพระ) ·
// dayPillar/monthPillar/yearPillar(ธาตุ) come from a SECOND almanac fetch (the rich month day-object). Bong's
// field map is followed exactly.

export type DayDetailArea = { key: string; label: string; percent: number | null; grade: string | null; isStrength: boolean }
export type DayDetailPillar = { stem: string; branch: string; ganzhi: string; element: string }
export type DayDetailYam = { id: string; window: string; label: string }
export type DayDetailSpirit = { name: string; keywords: string[] }
export type DayDetailGate = { name: string; direction: string; meaning: string }
export type DayDetailColor = { element: string; colors: string }

export type DayDetail = {
  date: string
  dayGanzhi: string
  overallPercent: number | null
  grade: string | null // bazi pass-through (ApiGrade|null), never re-derived
  verdict: string
  summary: string // summaryHeadline
  suitable: string // summaryItems key=best
  avoid: string // summaryItems key=worst
  insight: string // elementRelation.summaryTh
  compatAreas: DayDetailArea[] // facets[]
  advice: string[] // the main facet's lines[].text
  yams: DayDetailYam[] // almanac.luckyHours
  dithi: { officer: string; officerDesc: string; jianchu: string } // officer + officerDesc + jianchu
  dayDeity: string // almanac.deity  ①
  spirits: DayDetailSpirit[] // almanac.spirits (8 เทพ)  ①
  wanPhra: { isWanPhra: boolean; label: string } // almanac.thaiLunar  ①
  dayPillars: { day: DayDetailPillar | null; month: DayDetailPillar | null; year: DayDetailPillar | null } // ①
  ownerPillars: Record<string, unknown> // person.fourPillars (raw block: year/month/day/hour)
  gates: DayDetailGate[] // raw — no good/bad level (ตำราไม่มี)
  colors: DayDetailColor[] // raw Thai names — no hex (งานดีไซน์)
}

const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d)
const num = (v: unknown): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const byKey = (items: unknown[], key: string): string =>
  str((items.find((x) => (x as { key?: unknown }).key === key) as { text?: unknown } | undefined)?.text)

function pillar(v: unknown): DayDetailPillar | null {
  const p = v as { stem?: unknown; branch?: unknown; ganzhi?: unknown; element?: unknown } | null
  if (!p || typeof p.ganzhi !== 'string') return null
  return { stem: str(p.stem), branch: str(p.branch), ganzhi: p.ganzhi, element: str(p.element) }
}

/** map raw man-vs-day(day) + the rich almanac day-object → the lean DayDetail the screen needs. */
export function mapDayDetail(mvd: unknown, almanacDay: unknown): DayDetail {
  const m = (mvd ?? {}) as Record<string, unknown>
  const a = (almanacDay ?? {}) as Record<string, unknown>
  const facets = arr(m.facets)
  const summaryItems = arr(m.summaryItems)
  const mainFacet = (facets.find((f) => (f as { isMain?: unknown }).isMain) ?? facets[0] ?? {}) as {
    lines?: unknown
  }
  const er = (m.elementRelation ?? {}) as { summaryTh?: unknown }
  const tl = (a.thaiLunar ?? {}) as { isWanPhra?: unknown; label?: unknown }
  const jc = (a.jianchu ?? {}) as { name?: unknown; meaning?: unknown }

  return {
    date: str(m.date),
    dayGanzhi: str(m.dayGanzhi),
    overallPercent: num(m.overallPercent),
    grade: typeof m.grade === 'string' ? m.grade : null,
    verdict: str(m.verdict),
    summary: str(m.summaryHeadline) || str(m.summary),
    suitable: byKey(summaryItems, 'best'),
    avoid: byKey(summaryItems, 'worst'),
    insight: str(er.summaryTh),
    compatAreas: facets.map((f) => {
      const fa = f as { key?: unknown; label?: unknown; percent?: unknown; grade?: unknown; isMain?: unknown }
      return {
        key: str(fa.key),
        label: str(fa.label),
        percent: num(fa.percent),
        grade: typeof fa.grade === 'string' ? fa.grade : null,
        isStrength: fa.isMain === true,
      }
    }),
    advice: arr(mainFacet.lines)
      .map((l) => str((l as { text?: unknown }).text))
      .filter((t) => t !== ''),
    yams: arr(a.luckyHours ?? (m.almanac as { luckyHours?: unknown } | undefined)?.luckyHours).map((y) => {
      const yy = y as { code?: unknown; range?: unknown; god?: unknown; meaning?: unknown }
      return { id: str(yy.code), window: str(yy.range), label: [str(yy.god), str(yy.meaning)].filter(Boolean).join(' · ') }
    }),
    dithi: { officer: str(a.officer), officerDesc: str(a.officerDesc), jianchu: [str(jc.name), str(jc.meaning)].filter(Boolean).join(' · ') },
    dayDeity: str(a.deity),
    spirits: arr(a.spirits).map((s) => {
      const ss = s as { name?: unknown; keywords?: unknown }
      return { name: str(ss.name), keywords: arr(ss.keywords).map((k) => str(k)) }
    }),
    wanPhra: { isWanPhra: tl.isWanPhra === true, label: str(tl.label) },
    dayPillars: { day: pillar(a.dayPillar), month: pillar(a.monthPillar), year: pillar(a.yearPillar) },
    ownerPillars: ((m.person ?? {}) as { fourPillars?: unknown }).fourPillars as Record<string, unknown> ?? {},
    gates: arr(a.gates).map((g) => {
      const gg = g as { name?: unknown; direction?: unknown; meaning?: unknown }
      return { name: str(gg.name), direction: str(gg.direction), meaning: str(gg.meaning) }
    }),
    colors: arr(a.colors).map((c) => {
      const cc = c as { element?: unknown; colors?: unknown }
      return { element: str(cc.element), colors: str(cc.colors) }
    }),
  }
}
