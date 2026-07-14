import { Card } from './Card'
import type { HealthStatus } from '@/lib/ops/health'

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
export function MetricCard({
  title,
  value,
  delta,
  unit,
  status = 'ok',
}: {
  title: string
  value: number
  delta: number
  unit: string
  status?: HealthStatus
}) {
  return (
    <Card status={status} title={title}>
      <div className="flex items-baseline justify-end gap-1.5 tabular-nums">
        <span className="text-2xl font-semibold text-ops_text">{formatNumber(value)}</span>
        <span className="text-xs text-ops_text_muted">{unit}</span>
      </div>
      <div className="mt-1 text-right text-xs text-ops_text_muted tabular-nums">{formatDelta(delta)} จากเมื่อวาน</div>
    </Card>
  )
}
