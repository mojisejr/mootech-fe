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

// ── #226 · the paywall, at the SOURCE ────────────────────────────────────────────────────────────────
// Until this shipped, /api/v2/day-detail returned every field to everyone and the SCREEN hid the paid
// ones behind `{paid && …}`. That is not a gate: the whole object was already in the browser before the
// tier was evaluated — Network tab, `curl`, anything. UI hiding is a layout decision, never an access one.
//
// 🔴 ALLOW-LIST, NOT A DENY-LIST — the single most important line in this file.
// A deny-list ("delete compatAreas, insight, …") is correct only for the fields that exist TODAY. bazi is
// an upstream we do not own; the day mapper grows when it grows, and every field added later would ship to
// free users automatically until somebody remembered to extend the list. With an allow-list the default
// for anything new is "not sent", and the failure mode of forgetting is a missing free field (visible,
// harmless) instead of a leaked paid one (invisible, costs money).
//
// The list below is exactly what the FREE screen renders — traced call site by call site in
// pages/v2/calendar/[date].tsx, not guessed:
//   percent → PersonalCalendarUpsell (the free upsell card ITSELF shows the score — cutting it breaks the
//             thing that sells the upgrade) · yams → YamTimes (free sees the list; the ADD button is what
//             remindersLocked disables) · luckyColors + dayDeity → LuckyColors · summary/suitable/avoid/
//             ganzhi/grade/date/wanPhra → the header + score card.
export const FREE_DAY_DETAIL_FIELDS = [
  'date',
  'dayGanzhi',
  'overallPercent',
  'grade',
  'summary',
  'suitable',
  'avoid',
  'yams',
  'dayDeity',
  'wanPhra',
  'colors',
  // 🔴 luckyDirection IS free — corrected after a proper sweep. My first pass called it paid-only because
  // its only match in pages/v2/calendar/[date].tsx is `<EightGates …>` under `{paid && advanced && …}`.
  // That was a scope-of-check error: <DayScoreCard/> renders for EVERYONE (it is the score card, not a paid
  // section) and shows a "ทิศมงคล …" chip from this field via its own prop. Grepping the PAGE cannot see a
  // field a COMPONENT reads — the sweep has to follow the tree.
  'luckyDirection',
] as const satisfies readonly (keyof DayDetail)[]

/** The free-tier view of a day. Paid fields are ABSENT (not null, not empty) — a caller cannot tell a
 *  trimmed field from one bazi never returned, and there is nothing to un-hide.
 *  `dithi` is the one field carried PARTIALLY: see FREE_DITHI_KEYS below. */
export type FreeDayDetail = Pick<DayDetail, (typeof FREE_DAY_DETAIL_FIELDS)[number]> & {
  dithi: Pick<DayDetail['dithi'], 'officer'>
}

// `dithi` is not free-or-paid, it is BOTH — the only field in the payload that splits inside itself.
//   officer      → the free score card's chip (<DayScoreCard/>, rendered for every tier)
//   officerDesc  → the paid <Dithi/> section
//   jianchu      → the paid <Dithi/> section
// Cutting the whole object would silently remove a chip a free user sees today; keeping the whole object
// would ship the paid section's text. So the trim goes one level deeper here, and ONLY here.
const FREE_DITHI_KEYS = ['officer'] as const satisfies readonly (keyof DayDetail['dithi'])[]

/**
 * Keep only the free fields. PURE — the route calls it on the way OUT, so the server cache can keep
 * storing the FULL day (one upstream computation serves both tiers, and a free user's cached copy can
 * never be handed to a paying one).
 *
 * 🔴 Fields deliberately NOT in the list, and why:
 *   compatAreas · insight · advice · gates · spirits — the paid sections (ใบ #226's DoD)
 *   dithi.officerDesc · dithi.jianchu — the paid half of the split field above
 *   verdict · dayPillars · ownerPillars — no consumer at all today (day-detail-adapter maps none of the
 *     three), so they are over-fetch rather than a leak; they stay out because the allow-list only carries
 *     what the free screen actually renders. Wiring MyChart is μุน's ticket, not this one.
 */
export function pickFreeDayDetail(detail: DayDetail): FreeDayDetail {
  const out = {} as Record<string, unknown>
  for (const k of FREE_DAY_DETAIL_FIELDS) out[k] = detail[k]
  const dithi = {} as Record<string, unknown>
  for (const k of FREE_DITHI_KEYS) dithi[k] = detail.dithi?.[k]
  out.dithi = dithi
  return out as FreeDayDetail
}
