import { GitMerge, GitPullRequest, GitPullRequestClosed } from 'lucide-react'
import { Card } from './Card'
import type { PrActivityItem, TeamActivity } from '@/lib/ops/activity'
import { formatBangkokDateTime } from '@/lib/ops/format'

const STATE_CONFIG: Record<PrActivityItem['state'], { icon: typeof GitMerge; label: string; color: string }> = {
  merged: { icon: GitMerge, label: 'merged', color: 'text-moumate_blue' },
  open: { icon: GitPullRequest, label: 'open', color: 'text-status_ok' },
  closed: { icon: GitPullRequestClosed, label: 'closed', color: 'text-ops_text_muted' },
}

function PrStateBadge({ state }: { state: PrActivityItem['state'] }) {
  const cfg = STATE_CONFIG[state]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 text-xs ${cfg.color}`}>
      <Icon size={14} aria-hidden="true" />
      {cfg.label}
    </span>
  )
}

export function ActivityList({ activity }: { activity: TeamActivity }) {
  return (
    <Card status={activity.status} title="Team Activity — PR ล่าสุด">
      {activity.items.length === 0 ? (
        <p className="text-sm text-ops_text_muted">{activity.detail}</p>
      ) : (
        <ul className="divide-y divide-ops_border">
          {activity.items.map((item) => (
            <li key={`${item.repo}-${item.number}`} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm text-ops_text hover:underline"
                >
                  {item.repo}#{item.number} {item.title}
                </a>
                <p className="text-xs text-ops_text_muted">
                  {item.author} · {formatBangkokDateTime(item.updatedAt)}
                </p>
              </div>
              <PrStateBadge state={item.state} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
