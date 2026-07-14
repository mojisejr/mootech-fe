import type { ReactNode } from 'react'
import { StatusDot } from './StatusDot'
import type { HealthStatus } from '@/lib/ops/health'

// Indicator position is fixed top-left on every card (design review with มุน) so the eye can
// scan the same spot card to card instead of hunting for status.
export function Card({ status, title, children }: { status: HealthStatus; title: string; children: ReactNode }) {
  return (
    <div className="relative rounded-xl border border-ops_border bg-ops_surface p-4">
      <div className="absolute left-4 top-4">
        <StatusDot status={status} />
      </div>
      <div className="pt-7">
        <h3 className="mb-2 text-sm text-ops_text_muted">{title}</h3>
        {children}
      </div>
    </div>
  )
}
