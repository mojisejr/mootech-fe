import type { ReactNode } from 'react'
import { StatusDot } from './StatusDot'
import type { HealthStatus } from '@/lib/ops/health'

// Measured by มุน (PR#56 design review): collapsed MetricCard/QuotaCard rows without a
// [ดูย่อย] affordance line rendered 131px vs 179px for the ones with it — an uneven collapsed
// row breaks the "gridded/clean" scan surface. Set to 182px (not 180px) because min-height is a
// floor, not a fixed height: cards WITH the affordance button naturally render at 182px, so a
// 180px floor left a 2px residual gap — verified by measuring actual rendered heights, not
// assumed. Shared here so MetricCard and QuotaCard can't drift apart on this value.
export const METRIC_CARD_MIN_HEIGHT = 'min-h-[182px]'

// Indicator position is fixed top-left on every card that has one (design review with มุน) so
// the eye can scan the same spot card to card instead of hunting for status. `status` is
// intentionally optional: per มุน's Q2 review, a status badge that never changes (e.g. Business
// Metrics — Phase 1 has no threshold logic) isn't a status, it's decoration that dilutes the
// status vocabulary everywhere else on the page. Only pass `status` for surfaces with real state
// (Hero, HealthCard, ActivityList) — a future metric with a real threshold can opt back in.
export function Card({
  status,
  title,
  children,
  className = '',
}: {
  status?: HealthStatus
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`relative rounded-xl border border-ops_border bg-ops_surface p-4 ${className}`}>
      {status && (
        <div className="absolute left-4 top-4">
          <StatusDot status={status} />
        </div>
      )}
      <div className={status ? 'pt-7' : ''}>
        <h3 className="mb-2 text-sm text-ops_text_muted">{title}</h3>
        {children}
      </div>
    </div>
  )
}
