// Badge system helpers (#calculator-badge-mood-FROZEN-v1). bazi-sft-dataset's public-calc route
// (PR#7) returns semantic fields only — role/element/qi/clash, never a literal icon filename —
// so icon selection and text-copy are entirely frontend-owned and can be revised without another
// backend deploy (per the icon-mapping-not-confirmed-yet note in FROZEN v1).
import type { EnrichmentBadge } from '@/pages/api/calculator/compute'

export type BadgeRole = 'wealth' | 'power'
export type BadgePoint = EnrichmentBadge

// Final icon map confirmed by มุน (2026-07-15, PR#58 review round) — public/images/box/, NOT
// mumate/ (verified the files exist there: ic_graph/ic_job/ic_charm/ic_behavior/ic_color/
// ic_warning/ic_lifestyle/ic_love/ic_holo/ic_next, a pre-existing 10-icon topic set). Swapped from
// the original placeholder guess (ic_love=wealth, ic_work=power — มุน corrected this pairing).
// ic_next is reserved for nav ("ดูต่อ" arrows), never a domain badge. ic_holo excluded — no
// "ภาพรวม" role exists in the current wealth/power-only badge system.
export function badgeIcon(role: BadgeRole): string {
  return role === 'wealth' ? '/images/box/ic_graph.svg' : '/images/box/ic_job.svg'
}

// Word-ban list ของ too (ห้าม โอกาส/ระวัง/รุ่งเรือง ฯลฯ) — fact ล้วน เทียบดิถีเสมอ, ไม่ใช่คำสัญญา.
// Reuses the same neutral-first + practitioner-term-in-parens pattern already reviewed/shipped in
// lib/calculator/enrichment-labels.ts (มุนพบ ซวย/โชคลาภ ชนคำมงคลมาแล้วรอบก่อน — ตัวนี้กันไว้ก่อน
// แทนที่จะรอ finding รอบใหม่).
const ROLE_LABEL_TH: Record<BadgeRole, string> = {
  wealth: 'บทบาททรัพย์',
  power: 'บทบาทอำนาจ',
}

export function badgePopoverText(badge: BadgePoint): string {
  const clashNote = badge.clash ? ' · จุดนี้ชนดิถี' : ''
  return `${badge.element} · ${ROLE_LABEL_TH[badge.role]} เทียบดิถี · เชี่ยงแซ ${badge.qi}${clashNote}`
}

const PILLAR_POINT_TO_COLUMN_KEY: Record<string, string> = {
  'pillar-ascendant': 'ascendant',
  'pillar-hour': 'time',
  'pillar-month': 'month',
  'pillar-year': 'year',
}

export function findPillarBadge(badges: BadgePoint[], columnKey: string): BadgePoint | undefined {
  return badges.find((b) => PILLAR_POINT_TO_COLUMN_KEY[b.point] === columnKey);
}

function parseAgeStart(ageRange: string): number {
  const m = ageRange.match(/^(\d+)-/)
  return m ? Number(m[1]) : -1
}

// decade-N badge point ids are 0-indexed ascending by age from bazi-sft-dataset's OWN daYun row
// order — but mootech-fe's own `decades[]` (mapDecadeLuck, map-timeline.ts) is NOT guaranteed to
// be in that same order (verified live: decades[] renders oldest-first, e.g. 87-91 at index 0,
// while daYun/badges are youngest-first, decade-0 = 7-11 — a full reversal). Matching by raw
// index would badge the wrong decade entirely. Derive the correct index from `daYun` (the same
// array badges were computed against) by age, same defensive pattern as map-enrichment.ts's
// findDecadePhasePair.
export function findDecadeBadge(
  badges: BadgePoint[],
  daYun: Array<{ ageRange: string }>,
  decadeAgeStart: number,
): BadgePoint | undefined {
  const rowIndex = daYun.findIndex((r) => parseAgeStart(r.ageRange) === decadeAgeStart)
  if (rowIndex === -1) return undefined
  return badges.find((b) => b.point === `decade-${Math.floor(rowIndex / 2)}`)
}

export function findAnnualBadge(badges: BadgePoint[], age: number): BadgePoint | undefined {
  return badges.find((b) => b.point === `annual-${age}`)
}

// Signal-gated ≤N/viewport caps (มุน design, FRD §5): chart ≤2, timeline (decade+annual combined)
// ≤4. Backend already filters to strong-signal-only points; this is a defensive display cap in
// case a chart happens to produce more than the design ceiling. Overflow is dropped, not hidden
// silently — callers surface the count via badgesOverflowCount().
export function capBadges<T>(badges: T[], max: number): { shown: T[]; overflow: number } {
  return { shown: badges.slice(0, max), overflow: Math.max(0, badges.length - max) }
}
