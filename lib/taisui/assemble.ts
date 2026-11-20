// ปีชง 2570 — turns bazi's facts into what the page reads, adding the prose from the content files.
// The full reading is only included for a logged-in member (the gate of plan revision 0.7).
import { APPROVED, DAY_MASTER, MONTH_TIP, PREVIEW, RELATION_NAME, ROLE, TONE, planLine, readingFor, whereOf } from '@/features/v2-taisui/content/readings'
import { ELEMENT_TH, animalImage, animalTh } from '@/features/v2-taisui/content/animals'
import type { TaisuiFacts, TaisuiReading } from './types'

export function assembleReading(facts: TaisuiFacts, opts: { member: boolean; source: 'saved' | 'typed' }): TaisuiReading {
  // A bazi older than plan revision 0.9 sends no reactions or role; the page then shows neither.
  const reactions = facts.reactions ?? []
  const pillars = facts.pillars.map((p) => {
    const elementTh = ELEMENT_TH[p.element] ?? ''
    return {
      key: p.key, stem: p.stem, branch: p.branch,
      animal: animalTh(p.branch), element: elementTh, image: animalImage(p.branch, elementTh),
      relation: p.relation, relations: p.relations, flow: p.flow,
      preview: PREVIEW[p.relation] ?? PREVIEW.none,
    }
  })
  const reading: TaisuiReading = {
    year: { stem: facts.year.stem, branch: facts.year.branch, lichun: facts.year.lichun },
    chart: { source: opts.source, hasHour: facts.chart.hasHour },
    pillars,
    mine: facts.mine,
    role: facts.role ? {
      dayMaster: facts.role.dayMaster,
      th: DAY_MASTER[facts.role.dayMaster]?.th ?? '',
      picture: DAY_MASTER[facts.role.dayMaster]?.picture ?? '',
      roleTh: ROLE[facts.role.role].th,
      line: ROLE[facts.role.role].line,
    } : null,
    marks: reactions.map((r) => ({ pillar: r.pillar, name: RELATION_NAME[r.kind], where: whereOf(r), tone: TONE[r.kind] })),
    months: facts.months.map((m) => ({ branch: m.branch, state: m.state })),
    ...(facts.partner ? { partner: { relation: facts.partner.relation } } : {}),
    locked: !opts.member,
    draft: !APPROVED,
  }
  if (opts.member) {
    reading.full = {
      readings: facts.pillars.map((p) => ({ key: p.key, ...readingFor(p.relation, p.key, reactions) })),
      monthTips: Object.fromEntries(facts.months.map((m) => [m.branch, `${MONTH_TIP[m.state]}${m.state === 'peak' && m.because.some((b) => b.startsWith('三合')) ? ' เดือนนี้ไตรภาคีครบชุด' : ''}`])),
      plan: facts.pillars.map((p) => planLine(p.relation, p.key)),
    }
  }
  return reading
}
