// ปีชง 2570 — the shapes the page reads (ciel-os workstream mumate-taisui-2570-001, design/CONTRACT.md).
import type { ElementRole, Flow, Luck, PillarKey, ReactionFact, Relation } from '@/features/v2-taisui/content/readings'

/** What bazi POST /api/taisui returns: facts only. */
export type TaisuiFacts = {
  year: { gregorian: number; stem: string; branch: string; element: string; lichun: string }
  chart: { hasHour: boolean }
  pillars: Array<{ key: PillarKey; stem: string; branch: string; element: string; relation: Relation; relations: string[]; flow: Flow }>
  /** Plan revision 0.9: every reaction by the Sinse's method, and the year's role to the day master. */
  reactions?: ReactionFact[]
  role?: { dayMaster: string; dayElement: string; role: ElementRole; th: string }
  luck?: Luck
  mine: string[]
  months: Array<{ branch: string; startsAt: string; state: 'peak' | 'care' | 'normal'; because: string[] }>
  partner?: { yearBranch: string; relation: Relation }
}

export type TaisuiReading = {
  year: { stem: string; branch: string; lichun: string }
  chart: { source: 'saved' | 'typed'; hasHour: boolean }
  pillars: Array<{
    key: PillarKey; stem: string; branch: string; animal: string; element: string; image: string
    relation: Relation; relations: string[]; flow: Flow; preview: [string, string]
  }>
  mine: string[]
  /** Free for everyone: the day master as a picture and the year's fire to it. */
  role: { dayMaster: string; th: string; picture: string; roleTh: string; line: string } | null
  /** Free for everyone: the reactions' names and where they land, without the stories. */
  marks: Array<{ pillar: PillarKey; name: string; where: string; tone: 'good' | 'care' | 'calm' }>
  /** Free for everyone: each reaction as the chart animates it, the year's character flying to yours. */
  hits: Array<{ pillar: PillarKey; at: 'top' | 'bottom'; kind: Exclude<Relation, 'none'>; tone: 'good' | 'care' | 'calm'; mine: string; year: string; name: string; why: string; plain: string; into?: ReactionFact['into'] }>
  /** Free: the engine's 用神 / 忌神 for this chart, so the page can say whether an element helps. */
  luck: Luck | null
  months: Array<{ branch: string; state: 'peak' | 'care' | 'normal' }>
  partner?: { relation: Relation }
  locked: boolean
  full?: {
    readings: Array<{
      key: PillarKey; headline: string; story: string; actions: [string, string, string]
      details: Array<{ name: string; why: string; story: string }>
    }>
    monthTips: Record<string, string>
    plan: string[]
  }
  draft: boolean
}
