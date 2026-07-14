import { StatusDot } from './StatusDot'
import type { HealthStatus } from '@/lib/ops/health'

// Calm-when-calm (design review with มุน): healthy = quiet, no colored background to compete for
// attention. Only warn/bad tint the strip so the eye is pulled exactly where it should go.
const COPY: Record<HealthStatus, { label: string; tint: string }> = {
  ok: { label: 'ระบบทำงานปกติทั้งหมด', tint: 'bg-ops_surface' },
  warn: { label: 'มีจุดที่ควรเฝ้าระวัง — ดูรายละเอียดด้านล่าง', tint: 'bg-status_warn/10' },
  bad: { label: 'มีจุดผิดปกติ ต้องตรวจสอบ — ดูรายละเอียดด้านล่าง', tint: 'bg-status_bad/10' },
  unknown: { label: 'บางส่วนไม่สามารถตรวจสอบสถานะได้', tint: 'bg-ops_surface' },
}

export function HeroStrip({ overall }: { overall: HealthStatus }) {
  const copy = COPY[overall]
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-ops_border p-4 ${copy.tint}`}
      data-testid="ops-hero-strip"
    >
      <StatusDot status={overall} label={copy.label} />
    </div>
  )
}
