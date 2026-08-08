import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { FirstRunScreen } from './FirstRunScreen'
import { GoalBoardIcon, GoalBuildingIcon, GoalHomeIcon } from './icons'

// IntentCheckScreen — "วันนี้คุณอยากดูแลด้านไหน?" (Figma 02-intent-check, node 300:1548).
// Presentational only: the choice is held by the caller and goes nowhere yet (issue #215 ships UI;
// the API + PDPA record are ใบ 3).

export type GoalId = 'finance' | 'health' | 'family' | 'growth' | 'love' | 'work'

// ⚠️ Figma ships 6 goals but only THREE distinct glyphs — การเงิน/สุขภาพ are the same path (proven:
// identical d-strings, only the fill differs), ครอบครัว/ความรัก are one exported asset, and
// พัฒนาตนเอง/การงาน are another. Reported on issue #215; shipping the design as drawn rather than
// inventing three icons that no designer has approved. Swapping in real art later touches this table
// only — the layout does not care.
export const GOALS: { id: GoalId; label: string; Icon: typeof GoalHomeIcon }[] = [
  { id: 'finance', label: 'การเงิน', Icon: GoalHomeIcon },
  { id: 'health', label: 'สุขภาพ', Icon: GoalHomeIcon },
  { id: 'family', label: 'ครอบครัว', Icon: GoalBuildingIcon },
  { id: 'growth', label: 'พัฒนาตนเอง', Icon: GoalBoardIcon },
  { id: 'love', label: 'ความรัก', Icon: GoalBuildingIcon },
  { id: 'work', label: 'การงาน', Icon: GoalBoardIcon },
]

export function IntentCheckScreen({
  selected,
  onSelect,
  onBack,
  onNext,
}: {
  selected: GoalId | null
  onSelect: (id: GoalId) => void
  onBack?: () => void
  onNext?: () => void
}) {
  // "ถัดไป" is always enabled. Figma has no empty-selection frame for this screen and the issue
  // gates only the PDPA button, so a "pick one first" rule here would be a behaviour nobody
  // specified — raised on issue #215 instead of being decided quietly in the code.
  return (
    <FirstRunScreen step={0} onBack={onBack} footer={<Button onClick={onNext}>ถัดไป</Button>}>
      {/* heading */}
      <div className="flex flex-col items-center gap-3 px-8 py-5 text-center">
        <h1 className="font-ibm text-2xl font-bold leading-8 text-v3-text-title">
          <span className="block">วันนี้คุณอยาก</span>
          <span className="block">
            ดูแล<span className="text-v3-cyan">ด้านไหน?</span>
          </span>
        </h1>
        <p className="max-w-[260px] font-ibm text-base leading-6 text-v3-text-body">
          เลือกเป้าหมายที่สำคัญกับคุณที่สุด เพื่อผลลัพธ์ที่ดียิ่งขึ้น
        </p>
      </div>

      {/* 6 goals · 2 per row. A grid (not 3 hand-built rows like the Figma layer tree) so the two
          columns stay equal at every width — the Figma frame pins one tile to 166px, which would
          make the pair uneven at 320 and 430. */}
      <div
        role="radiogroup"
        aria-label="เลือกเป้าหมายที่สำคัญกับคุณที่สุด"
        className="grid grid-cols-2 gap-2 px-6"
      >
        {GOALS.map(({ id, label, Icon }) => {
          const on = selected === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelect(id)}
              className={cn(
                'flex items-start justify-center rounded-2xl px-4 py-6 transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v3-sapphire focus-visible:ring-offset-2',
                on ? 'bg-v3-cyan text-white' : 'bg-white text-v3-sapphire',
              )}
            >
              <span className="flex flex-col items-center gap-2">
                {/* colour rides on the tile's text colour, so the glyph flips with the selection
                    without shipping a second copy of the artwork */}
                <Icon className="size-8" />
                <span className="font-ibm text-sm font-semibold uppercase leading-5">{label}</span>
              </span>
            </button>
          )
        })}
      </div>
    </FirstRunScreen>
  )
}

export default IntentCheckScreen
