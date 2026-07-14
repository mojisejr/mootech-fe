import type { ReactNode } from 'react'
import { Card } from './Card'
import { Disclosure } from './Disclosure'

function formatNumber(n: number): string {
  return n.toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

// New card type (not MetricCard+delta) — Anatomy: label · subtitle(muted) · bar(muted) ·
// used/capacity · เหลือ N · [ดูย่อย ⌄]. Bar fill is a fixed neutral/teal tint, NEVER
// status_ok/warn/bad (Guardrails #2 — this is a capacity gauge, not a health signal).
export function QuotaCard({
  title,
  subtitle,
  used,
  capacity,
  breakdown,
}: {
  title: string
  subtitle: string
  used: number
  capacity: number
  breakdown?: ReactNode
}) {
  const percent = capacity > 0 ? Math.min(100, Math.round((used / capacity) * 100)) : 0
  const remaining = Math.max(0, capacity - used)

  return (
    <Card title={title}>
      <p className="-mt-1 mb-2 text-xs text-ops_text_muted">{subtitle}</p>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-ops_border"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${title} ใช้ไปแล้ว ${percent}%`}
      >
        <div className="h-full rounded-full bg-moumate_blue/60" style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-2 flex items-baseline justify-between text-sm tabular-nums">
        <span className="text-ops_text_muted">{percent}%</span>
        <span className="text-ops_text">
          {formatNumber(used)}/{formatNumber(capacity)}
        </span>
      </div>
      <div className="text-right text-xs text-ops_text_muted tabular-nums">เหลือ {formatNumber(remaining)}</div>

      {breakdown && <Disclosure>{breakdown}</Disclosure>}
    </Card>
  )
}
