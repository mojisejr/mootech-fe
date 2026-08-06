// §13 [advanced] "8 เทพ 八神 · คีย์เวิร์ด" — the 8 deity rows: chip + name + "·"-joined keywords.
//
// M-D (มุน 2026-08-06): the frozen version carried a 神 glyph (天·符·蛇…) in a square chip alongside the
// Thai name. The pipe sends `{name, keywords}` and NO glyph. Typing the glyphs back in from the old fixture
// would re-freeze content the source does not provide, so the chip is gone rather than faked.
//
// The first attempt kept the chip and filled it with `name.slice(0, 1)`. Looking at the render killed it:
// Thai leading vowels cannot stand alone, so เทียน · เสอ · เหอ · เฉิน · เชวี่ย all rendered as a bare "เ"
// — five identical chips that read as a font bug. A character count is not a character.
import type { DayDetailSpirit } from '../../types'
import { SectionCard } from './SectionCard'

export function EightDeities({ deities }: { deities: DayDetailSpirit[] }) {
  return (
    <SectionCard title="8 เทพ 八神 · คีย์เวิร์ด" testId="eight-deities">
      <ul className="flex flex-col gap-3.5">
        {deities.length === 0 && <li className="text-sm text-v3-text-muted">วันนี้ไม่มีข้อมูล 8 เทพ</li>}
        {deities.map((d, i) => (
          <li key={`${d.name}-${i}`} data-testid="deity-row" className="flex items-start gap-3">
            <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-v3-sapphire/40" />
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
