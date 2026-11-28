// แผนชีวิตปีใหม่ 2570 — turns bazi's year facts into the one-page plan. The facts are the same ones ปีชง 2570
// reads (lib/taisui/server.ts yearFactsFor → POST /api/taisui) and the prose is the same Sinse-drafted
// tables, so the two pages can never disagree about a chart. Nothing here calls an AI: every sentence is
// picked by the engine's facts ("engine-first", pages/api/calculator/compute.ts). The full plan is only
// included for a yearly member (the gate of team meeting 2026-11-24 item 13).
import { APPROVED, AREA, DAY_MASTER, MONTH_TIP, RELATION_NAME, TONE, fireLine, planLine, readingFor, type Luck, type PillarKey, type Relation } from '@/features/v2-taisui/content/readings'
import { ELEMENT_TH, MONTH_LABEL, animalImage, animalTh } from '@/features/v2-taisui/content/animals'
import type { TaisuiFacts } from '@/lib/taisui/types'

export type NewYearPillar = {
  key: PillarKey
  label: string
  animal: string
  element: string
  image: string
  relation: Relation
  name: string
  tone: 'good' | 'care' | 'calm'
}

export type NewYearReading = {
  year: { stem: string; branch: string; lichun: string }
  /** source says whose chart it is; signedIn says whether the viewer is a member (a member may type another birth). */
  chart: { source: 'saved' | 'typed'; hasHour: boolean; signedIn: boolean }
  /** Free: the day master as a picture, and the year's fire to it in plain words. */
  headline: { dayMaster: string; th: string; picture: string; fire: string } | null
  /** Free: the engine's 用神 / 忌神 for this chart. */
  luck: Luck | null
  /** Free: the four pillars as pictures, each with its reaction to the year. */
  pillars: NewYearPillar[]
  /** Free: the twelve months of the year and whether each is good, to be careful in, or normal. */
  months: Array<{ branch: string; name: string; short: string; state: 'peak' | 'care' | 'normal' }>
  /** How many months the preview shows unblurred. */
  previewMonths: number
  locked: boolean
  /** The prose is still waiting for the Sinse's review (features/v2-taisui/content/readings.ts APPROVED). */
  draft: boolean
  full?: {
    readings: Array<{ key: PillarKey; label: string; headline: string; story: string; actions: [string, string, string] }>
    monthTips: Record<string, string>
    plan: Array<{ key: PillarKey; label: string; line: string }>
  }
}

export const NEWYEAR_PREVIEW_MONTHS = 3

export function assembleNewYear(facts: TaisuiFacts, opts: { unlocked: boolean; source: 'saved' | 'typed'; signedIn: boolean }): NewYearReading {
  // A bazi older than plan revision 0.9 sends no reactions or role; the page then shows neither.
  const reactions = facts.reactions ?? []
  const pillars: NewYearPillar[] = facts.pillars.map((p) => {
    const elementTh = ELEMENT_TH[p.element] ?? ''
    return {
      key: p.key,
      label: AREA[p.key].label,
      animal: animalTh(p.branch),
      element: elementTh,
      image: animalImage(p.branch, elementTh),
      relation: p.relation,
      name: RELATION_NAME[p.relation],
      tone: TONE[p.relation],
    }
  })
  const reading: NewYearReading = {
    year: { stem: facts.year.stem, branch: facts.year.branch, lichun: facts.year.lichun },
    chart: { source: opts.source, hasHour: facts.chart.hasHour, signedIn: opts.signedIn },
    headline: facts.role
      ? {
          dayMaster: facts.role.dayMaster,
          th: DAY_MASTER[facts.role.dayMaster]?.th ?? '',
          picture: DAY_MASTER[facts.role.dayMaster]?.picture ?? '',
          fire: fireLine(facts.role.role, facts.luck),
        }
      : null,
    luck: facts.luck ?? null,
    pillars,
    months: facts.months.map((m) => ({ branch: m.branch, name: MONTH_LABEL[m.branch]?.name ?? m.branch, short: MONTH_LABEL[m.branch]?.short ?? '', state: m.state })),
    previewMonths: NEWYEAR_PREVIEW_MONTHS,
    locked: !opts.unlocked,
    draft: !APPROVED,
  }
  if (opts.unlocked) {
    reading.full = {
      readings: facts.pillars.map((p) => ({ key: p.key, label: AREA[p.key].label, ...readingFor(p.relation, p.key, reactions, facts.luck) })),
      monthTips: Object.fromEntries(facts.months.map((m) => [m.branch, MONTH_TIP[m.state]])),
      plan: facts.pillars.map((p) => ({ key: p.key, label: AREA[p.key].label, line: planLine(p.relation, p.key) })),
    }
  }
  return reading
}
