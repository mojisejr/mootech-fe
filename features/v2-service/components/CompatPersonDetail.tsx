// features/v2-service/components/CompatPersonDetail.tsx — ดวงสมพงศ์ 2E-2 · D21 "รายคน" (one person).
// Figma 636:18819: roleLabel (ตัวเรา/เขา) · "<day-stem> <stageTh> · ธาตุประจำวัน" · a bullet list of nisai
// (นิสัย/traits). Contract CompatResultPerson { dayGanzhi, elementTh, stageTh, nisai[] }. Rule 4: no stage/
// element AND no nisai → render null; an absent line hides.
import type { CompatResultPerson } from '../compatibility-result'
import { SIDE_TINT, type SideKey } from '../compat-result-parts'

export function CompatPersonDetail({ person, roleLabel, side = 'self' }: { person?: CompatResultPerson; roleLabel: string; side?: SideKey }) {
  const stage = (person?.stageTh ?? '').trim()
  const element = (person?.elementTh ?? '').trim()
  const dayStem = (person?.dayGanzhi ?? '').trim().charAt(0)
  const traits = (person?.nisai ?? []).map((t) => (t ?? '').trim()).filter(Boolean)
  const subtitle = [dayStem, stage].filter(Boolean).join(' ')
  if (!subtitle && !element && traits.length === 0) return null

  return (
    <section
      data-testid="compat-person-detail"
      data-side={side}
      className="flex flex-col gap-3 rounded-2xl p-4"
      style={{ backgroundColor: SIDE_TINT[side] }}
    >
      <p className="text-[15px] font-bold text-v3-navy">{roleLabel}</p>
      {subtitle || element ? (
        <p className="text-[13px] text-v3-text-body">
          {subtitle}{element ? `${subtitle ? ' · ' : ''}ธาตุประจำวัน` : ''}
        </p>
      ) : null}
      {traits.length ? (
        <ul data-testid="compat-person-nisai" className="flex flex-col gap-2">
          {traits.map((t, i) => (
            <li key={i} className="flex gap-2 text-[14px] leading-[22px] text-v3-text-body">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-v3-sapphire" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

export default CompatPersonDetail
