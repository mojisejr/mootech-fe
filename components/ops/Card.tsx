import type { ReactNode } from 'react'
import { StatusDot } from './StatusDot'
import type { HealthStatus } from '@/lib/ops/health'

// Indicator position is fixed top-left on every card that has one (design review with มุน) so
// the eye can scan the same spot card to card instead of hunting for status. `status` is
// intentionally optional: per มุน's Q2 review, a status badge that never changes (e.g. Business
// Metrics — Phase 1 has no threshold logic) isn't a status, it's decoration that dilutes the
// status vocabulary everywhere else on the page. Only pass `status` for surfaces with real state
// (Hero, HealthCard, ActivityList) — a future metric with a real threshold can opt back in.
export function Card({ status, title, children }: { status?: HealthStatus; title: string; children: ReactNode }) {
  return (
    <div className="relative rounded-xl border border-ops_border bg-ops_surface p-4">
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
