import { Card } from './Card'
import type { ServiceHealth } from '@/lib/ops/health'
import { formatBangkokDateTime } from '@/lib/ops/format'

export function HealthCard({ service }: { service: ServiceHealth }) {
  return (
    <Card status={service.status} title={service.name}>
      <p className="text-sm text-ops_text">{service.detail}</p>
      {service.deployedAt && (
        <p className="mt-1 text-xs text-ops_text_muted tabular-nums">
          deploy ล่าสุด: {formatBangkokDateTime(service.deployedAt)}
        </p>
      )}
      {service.inspectUrl && (
        <a
          href={service.inspectUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs text-moumate_blue hover:underline"
        >
          ดูรายละเอียด →
        </a>
      )}
    </Card>
  )
}
