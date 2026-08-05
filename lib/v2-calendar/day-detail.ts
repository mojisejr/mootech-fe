// lib/v2-calendar/day-detail.ts — the day-detail BFF mapper (goo lane). Trims the ~2.3MB man-vs-day +
// almanac reply down to only what the day screen renders. EVERY field traces back to a raw upstream field —
// the pipe invents nothing (gates carry no good/bad level — ตำราไม่มี, ส่งดิบ; colors stay Thai names, no hex).
//
// TWO upstreams: man-vs-day(day) embeds only 9 almanac keys; deity · spirits(8เทพ) · thaiLunar(วันพระ) ·
// dayPillar/monthPillar/yearPillar(ธาตุ) come from a SECOND almanac fetch (the rich month day-object). Bong's
// field map is followed exactly.
import { parseApiGrade } from '@/lib/v2/api-grade'

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
  suitable: string[] // summaryItems key=best — a LIST (the UI does .slice().map(); a bare string crashes it)
  avoid: string[] // summaryItems key=worst — a LIST
  insight: string // elementRelation.summaryTh
  compatAreas: DayDetailArea[] // facets[]
  advice: string[] // the main facet's lines[].text
  yams: DayDetailYam[] // almanac.luckyHours
  dithi: { officer: string; officerDesc: string; jianchu: string } // officer + officerDesc + jianchu
  luckyDirection: string // ทิศมงคล — RAW from man-vs-day (lucky_dir almanac column, real ตำรา data, NOT a
  // ranking of the 8 gates). A chip alongside dithi.officer; the 財 chip is cut (bazi's 8 gates have no 財).
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

// The summaryItems best/worst text is a "/"-delimited list of activities ("อยู่กับเพื่อน / พี่น้อง / คู่ครอง").
// The UI (calendar.tsx → DailyFortuneCard Column) does .slice(0,2).map() — it needs an ARRAY. So the ADAPTER
// splits it into the list, not the screen. Empty text → [] (Column has its own empty-guard). Never a bare
// string: `"…".slice(0,2)` = first two CHARS, then .map() → TypeError on render.
const splitList = (text: string): string[] =>
  text.split(/\s*\/\s*/).map((s) => s.trim()).filter((s) => s !== '')

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
    grade: parseApiGrade(m.grade), // F1 (ตู๋ #178): validate 13, null→null, นอกลิสต์ throw (loud)
    verdict: str(m.verdict),
    summary: str(m.summaryHeadline) || str(m.summary),
    suitable: splitList(byKey(summaryItems, 'best')),
    avoid: splitList(byKey(summaryItems, 'worst')),
    insight: str(er.summaryTh),
    compatAreas: facets.map((f) => {
      const fa = f as { key?: unknown; label?: unknown; percent?: unknown; grade?: unknown; isMain?: unknown }
      return {
        key: str(fa.key),
        label: str(fa.label),
        percent: num(fa.percent),
        grade: parseApiGrade(fa.grade),
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
    luckyDirection: str(m.luckyDirection), // ทิศมงคล ดิบ (man-vs-day day, lucky_dir) — ❌ ไม่แปลงเป็นทิศย่อ/องศา/ไอคอน (งานมุน)
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
