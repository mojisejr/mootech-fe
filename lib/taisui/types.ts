// ปีชง 2570 — the shapes the page reads (ciel-os workstream mumate-taisui-2570-001, design/CONTRACT.md).
import type { Flow, PillarKey, Relation } from '@/features/v2-taisui/content/readings'

/** What bazi POST /api/taisui returns: facts only. */
export type TaisuiFacts = {
  year: { gregorian: number; stem: string; branch: string; element: string; lichun: string }
  chart: { hasHour: boolean }
  pillars: Array<{ key: PillarKey; stem: string; branch: string; element: string; relation: Relation; relations: string[]; flow: Flow }>
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
  months: Array<{ branch: string; state: 'peak' | 'care' | 'normal' }>
  partner?: { relation: Relation }
  locked: boolean
  full?: {
    readings: Array<{ key: PillarKey; headline: string; opportunity: string; strengths: string; cautions: string; actions: [string, string, string] }>
    monthTips: Record<string, string>
    plan: string[]
  }
  draft: boolean
}
