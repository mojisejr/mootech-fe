// A11y: status is never color-only — icon + label always ride along with the color
// (#mumate-ops-dashboard-phase1 Step 5, design review with มุน).
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react'
import type { HealthStatus } from '@/lib/ops/health'

const STATUS_CONFIG: Record<HealthStatus, { icon: typeof CheckCircle2; label: string; color: string }> = {
  ok: { icon: CheckCircle2, label: 'ปกติ', color: 'text-status_ok' },
  warn: { icon: AlertTriangle, label: 'เฝ้าระวัง', color: 'text-status_warn' },
  bad: { icon: XCircle, label: 'ผิดปกติ', color: 'text-status_bad' },
  unknown: { icon: HelpCircle, label: 'ไม่ทราบสถานะ', color: 'text-ops_text_muted' },
}

export function StatusDot({ status, label }: { status: HealthStatus; label?: string }) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-medium ${cfg.color}`}
      data-testid={`ops-status-${status}`}
    >
      <Icon size={16} aria-hidden="true" />
      <span>{label ?? cfg.label}</span>
    </span>
  )
}
