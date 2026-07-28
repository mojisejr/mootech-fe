// MuMate v2 — ปฏิทินดวง · the SHARED grade + day-cell color system (Lamun · DESIGN.md is the single source).
//
// goo's grade.ts owns the LOGIC (the 10-grade order, dayCellTier thresholds). This file owns the COLORS — one
// place, so the ring · badge · %-bar · calendar cell never hardcode a hex apart from here (frame done-condition
// 6: "ระบบเกรด 10 ระดับ = component ตัวเดียว ไม่มี hardcode สีกระจาย"). Every value below is copied verbatim from
// mootech-fe/DESIGN.md — NOT eyeballed from Figma. If a needed color isn't here, add it to DESIGN.md first (ฟีม A3).
import type { Grade, DayCellTier } from '../types'

/** DESIGN.md §GRADE (10-step) — card bg + accent/badge. NOTE the C+ badge-text contrast exception (#374151). */
export const GRADE_COLORS: Record<Grade, { bg: string; accent: string; badgeText: string }> = {
  A: { bg: '#E8F5E9', accent: '#2E7D32', badgeText: '#2E7D32' },
  'B+': { bg: '#EDF7ED', accent: '#43A047', badgeText: '#43A047' },
  B: { bg: '#F0F8F0', accent: '#66BB6A', badgeText: '#66BB6A' },
  'B-': { bg: '#F1F8E8', accent: '#8BC34A', badgeText: '#8BC34A' },
  'C+': { bg: '#F9FBE7', accent: '#CDDC39', badgeText: '#374151' }, // ⚠️ dark text (contrast exception — DESIGN.md)
  C: { bg: '#FFF3E0', accent: '#FFA726', badgeText: '#FFA726' },
  'C-': { bg: '#FFF0E1', accent: '#F57C00', badgeText: '#F57C00' },
  'D+': { bg: '#FBE9E7', accent: '#E64A19', badgeText: '#E64A19' },
  D: { bg: '#FFEBEE', accent: '#D32F2F', badgeText: '#D32F2F' },
  'D-': { bg: '#FCE4EC', accent: '#B71C1C', badgeText: '#B71C1C' },
}

/** DESIGN.md §CALENDAR day-cell (3-tier) — cell tint + %-text. goo's dayCellTier(percent) picks the tier. */
export const DAY_CELL_COLORS: Record<DayCellTier, { tint: string; text: string }> = {
  good: { tint: '#E2F4F6', text: '#0B7A8C' },
  medium: { tint: '#FEF1E0', text: '#B47E35' },
  bad: { tint: '#FEE7E4', text: '#CD3D2E' },
}

/** Calendar markers (DESIGN.md): selected-day / วันพระ ring — #9D85DA (≠ Accent/Purple #AF9CE0). */
export const CALENDAR_MARKER = '#9D85DA'
/** Selected-day fill (Figma month cell 14 = sapphire fill + white text). */
export const SELECTED = { fill: '#1455A4', text: '#FFFFFF' }
