// §13 [advanced] "8 เทพ 八神 · คีย์เวิร์ด" — the 8 deity rows: glyph chip + Thai name + "·"-joined keywords.
import type { EightDeity } from './content'
import { SectionCard } from './SectionCard'

export function EightDeities({ deities }: { deities: EightDeity[] }) {
  return (
    <SectionCard title="8 เทพ 八神 · คีย์เวิร์ด">
      <ul className="flex flex-col gap-3.5">
        {deities.map((d) => (
          <li key={d.char} className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-v3-pastel-blue/30 text-lg font-bold text-v3-sapphire">
              {d.char}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-v3-navy">{d.name}</p>
              <p className="mt-0.5 text-xs leading-5 text-v3-text-body">{d.keywords.join(' · ')}</p>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
