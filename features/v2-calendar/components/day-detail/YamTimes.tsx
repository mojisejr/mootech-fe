// §11 "เวลามงคล" — the 5 ยาม windows from goo's DayDetail (real data), each row on #F9F4F0: window (bold
// navy) + label + a "เพิ่มปฏิทิน" button. The button is a real client add (goo's useReminders.add, de-duped);
// once the day has a reminder the floating menu flips to state 3 (saved). No network. The full save SHEET
// (screen 5 · node 375:13316) is a separate future screen — this is the per-ยาม quick-add.
import type { YamSlot } from '../../types'
import { SectionCard } from './SectionCard'

export function YamTimes({ yams, onAdd }: { yams: YamSlot[]; onAdd: (yam: YamSlot) => void }) {
  return (
    <SectionCard title="เวลามงคล" info>
      <div className="flex flex-col gap-2.5">
        {yams.map((yam) => (
          <div key={yam.id} className="flex items-center gap-3 rounded-2xl bg-v3-lemon-chiffon px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-v3-navy">{yam.window}</p>
              <p className="mt-0.5 truncate text-xs font-medium text-v3-text-body">{yam.label}</p>
            </div>
            <button
              type="button"
              onClick={() => onAdd(yam)}
              className="shrink-0 rounded-full bg-v3-sapphire px-4 py-2 text-xs font-bold text-white"
            >
              เพิ่มปฏิทิน
            </button>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
