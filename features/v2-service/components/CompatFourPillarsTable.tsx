// features/v2-service/components/CompatFourPillarsTable.tsx — ดวงสมพงศ์ 2E-2 · D44 "สี่เสา" for one person.
// Figma 636:18819: a 4-column grid ปี · เดือน · วัน · ยาม; each column = stem (ก้าน) over branch (กิ่ง) with the
// element (ธาตุ) label beneath. D23/D44: timeKnown === false → the ยาม (hour) column shows "—" for all three
// (never invented). Rule 4: no fourPillars → render null.
import type { CompatResultPerson, CompatPillar } from '../compatibility-result'
import { SIDE_TINT, type SideKey } from '../compat-result-parts'

const UNKNOWN = '—'

function Column({ head, pillar, unknown }: { head: string; pillar?: CompatPillar; unknown?: boolean }) {
  const stem = unknown ? UNKNOWN : (pillar?.stem ?? UNKNOWN)
  const branch = unknown ? UNKNOWN : (pillar?.branch ?? UNKNOWN)
  const element = unknown ? UNKNOWN : (pillar?.element ?? '')
  return (
    <div data-testid={`compat-pillar-${head}`} className="flex flex-1 flex-col items-center gap-1 rounded-xl bg-white px-1 py-3">
      <span className="text-[11px] font-medium text-v3-text-muted">{head}</span>
      <span className="text-[22px] font-bold leading-7 text-v3-navy">{stem}</span>
      <span className="text-[22px] font-bold leading-7 text-v3-navy">{branch}</span>
      <span className="text-[11px] text-v3-text-body">{element || (unknown ? UNKNOWN : '')}</span>
    </div>
  )
}

export function CompatFourPillarsTable({ person, roleLabel, side = 'self' }: { person?: CompatResultPerson; roleLabel: string; side?: SideKey }) {
  const fp = person?.fourPillars
  if (!fp) return null
  const hourUnknown = person?.timeKnown === false
  const dayGanzhi = (person?.dayGanzhi ?? '').trim()
  return (
    <section
      data-testid="compat-fourpillars"
      data-side={side}
      className="flex flex-col gap-3 rounded-2xl p-4"
      style={{ backgroundColor: SIDE_TINT[side] }}
    >
      <p className="text-[14px] font-bold text-v3-navy">
        {roleLabel}{dayGanzhi ? <span className="font-normal text-v3-text-body"> · หลักวัน {dayGanzhi}</span> : null}
      </p>
      <div className="flex items-stretch gap-2">
        <Column head="ปี" pillar={fp.year} />
        <Column head="เดือน" pillar={fp.month} />
        <Column head="วัน" pillar={fp.day} />
        <Column head="ยาม" pillar={fp.hour} unknown={hourUnknown} />
      </div>
      {hourUnknown ? <p data-testid="compat-pillar-hour-unknown" className="text-[12px] text-v3-text-muted">* ไม่ทราบเวลาเกิด — เสายามจึงไม่แสดง</p> : null}
    </section>
  )
}

export default CompatFourPillarsTable
