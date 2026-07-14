import type { ReactNode } from 'react'
import { Card } from './Card'
import { Disclosure } from './Disclosure'

function formatNumber(n: number): string {
  return n.toLocaleString('th-TH', { maximumFractionDigits: 2 })
}

function formatDelta(n: number): string {
  if (n === 0) return '±0'
  const sign = n > 0 ? '+' : ''
  return `${sign}${formatNumber(n)}`
}

// Anatomy v2 (#mumate-ops-dashboard-pr56, มุน): label · subtitle(muted) · BIG+unit · delta(muted)
// · [ดูย่อย ⌄]? — the disclosure only renders for cards with a REAL breakdown (แต้ม/Revenue).
// ขอดูดวง/Survey pass no `breakdown` and get no affordance (Guardrails: "ห้าม fake affordance
// บนการ์ดที่ไม่มี breakdown จริง").
//
// No status badge here (carried over from PR#55 design review, Q2): Phase 1 has no threshold
// logic for these numbers, so a badge would always read "ปกติ" regardless of value — decoration,
// not status, and it dilutes the vocabulary Hero/HealthCard/ActivityList rely on.
export function MetricCard({
  title,
  subtitle,
  value,
  delta,
  unit,
  breakdown,
}: {
  title: string
  subtitle: string
  value: number
  delta: number
  unit: string
  breakdown?: ReactNode
}) {
  return (
    <Card title={title}>
      <p className="-mt-1 mb-2 text-xs text-ops_text_muted">{subtitle}</p>
      <div className="flex items-baseline justify-end gap-1.5 tabular-nums">
        <span className="text-2xl font-semibold text-ops_text">{formatNumber(value)}</span>
        <span className="text-xs text-ops_text_muted">{unit}</span>
      </div>
      <div className="mt-1 text-right text-xs text-ops_text_muted tabular-nums">{formatDelta(delta)} จากเมื่อวาน</div>
      {breakdown && <Disclosure>{breakdown}</Disclosure>}
    </Card>
  )
}
