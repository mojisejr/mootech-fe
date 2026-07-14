import { Card } from './Card'

function formatNumber(n: number): string {
  return n.toLocaleString('th-TH', { maximumFractionDigits: 2 })
}

function formatDelta(n: number): string {
  if (n === 0) return '±0'
  const sign = n > 0 ? '+' : ''
  return `${sign}${formatNumber(n)}`
}

// Convention (design review): label + number + delta + unit, always together, right-aligned,
// tabular-nums so digits don't jump around on refresh.
//
// No status badge here (design review with มุน, Q2): Phase 1 has no threshold logic for these
// numbers, so a badge would always read "ปกติ" regardless of the actual value — that's not a
// status, it's decoration, and it dilutes the status vocabulary the Hero/HealthCard/ActivityList
// actually rely on to pull the eye during an incident. `delta` carries the real signal instead.
export function MetricCard({
  title,
  value,
  delta,
  unit,
}: {
  title: string
  value: number
  delta: number
  unit: string
}) {
  return (
    <Card title={title}>
      <div className="flex items-baseline justify-end gap-1.5 tabular-nums">
        <span className="text-2xl font-semibold text-ops_text">{formatNumber(value)}</span>
        <span className="text-xs text-ops_text_muted">{unit}</span>
      </div>
      <div className="mt-1 text-right text-xs text-ops_text_muted tabular-nums">{formatDelta(delta)} จากเมื่อวาน</div>
    </Card>
  )
}
