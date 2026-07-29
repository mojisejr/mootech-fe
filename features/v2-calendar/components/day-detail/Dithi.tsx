// §9 [advanced] "ดิถีวันนี้ · สะสม" — colored-dot bullets. Dot colour reuses DAY_CELL_COLORS tier text
// (good = teal · bad = red) — no new hex.
import type { DithiBullet } from './content'
import { SectionCard } from './SectionCard'
import { DAY_CELL_COLORS } from '../grade-colors'

export function Dithi({ items }: { items: DithiBullet[] }) {
  return (
    <SectionCard title="ดิถีวันนี้ · สะสม">
      <ul className="flex flex-col gap-2">
        {items.map((b, i) => (
          <li key={i} className="flex items-center gap-2.5 text-sm text-v3-text-body">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: b.tone === 'bad' ? DAY_CELL_COLORS.bad.text : DAY_CELL_COLORS.good.text }} />
            {b.text}
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
