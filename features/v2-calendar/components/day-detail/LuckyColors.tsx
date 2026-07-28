// §10 "ทิศ สีมงคล" — the 5 lucky-colour swatches (hex SAMPLED from Figma pixels; content, not a UI token,
// so not in DESIGN.md) + เทพประจำวัน. Two label rows inside a section card.
import { SectionCard } from './SectionCard'

export function LuckyColors({ colors, deity }: { colors: string[]; deity: string }) {
  return (
    <SectionCard title="ทิศ สีมงคล" info>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-v3-text-body">สีมงคลเฉพาะคุณ</span>
          <span className="flex items-center gap-2">
            {colors.map((hex, i) => (
              <span key={i} className="size-6 rounded-full ring-1 ring-black/5" style={{ backgroundColor: hex }} title={hex} />
            ))}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-v3-text-body">เทพประจำวัน</span>
          <span className="text-base font-bold text-v3-sapphire">{deity}</span>
        </div>
      </div>
    </SectionCard>
  )
}
