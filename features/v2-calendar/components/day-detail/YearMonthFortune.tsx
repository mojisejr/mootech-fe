// การ์ด "ดวงประจำปี / เดือน" (奇門 คี้มึ้ง) — เอกสารซินแสนุ้ย (2026-09-13)
// โชว์ ทิศโชคลาภ/ทิศร้าย/เทพ/คี้มึ้ง (ค่าสั้น) + ตาราง 8 ประตูระดับปีและเดือน เสริมดวงรายวัน
// ข้อมูลมาจาก almanac.yearInfo/monthInfo → mapDayDetail → detail.yearFortune/monthFortune (แอดวานซ์)
import { SectionCard } from './SectionCard'
import { directionLabelTH } from './gate-compass'
import type { DayDetailQimen } from '@/features/v2-calendar/types'

function FortuneBlock({ label, q }: { label: string; q: DayDetailQimen }) {
  return (
    <div className="flex flex-col gap-2.5" data-testid={`ymf-block-${label}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-v3-sapphire px-3 py-1 text-[13px] font-bold text-white">{label}</span>
        {q.kimeng ? (
          <span className="rounded-full bg-v3-sapphire-tint px-2.5 py-1 text-[12px] font-bold text-v3-sapphire">คี้มึ้ง · {q.kimeng}</span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 text-[13px]">
        {q.caishenDir ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 font-bold text-emerald-700">ทิศโชคลาภ · {directionLabelTH(q.caishenDir)}</span>
        ) : null}
        {q.badDir ? (
          <span className="rounded-full bg-rose-50 px-3 py-1 font-bold text-rose-600">ทิศร้าย (เลี่ยง) · {directionLabelTH(q.badDir)}</span>
        ) : null}
        {q.deity ? (
          <span className="rounded-full bg-amber-50 px-3 py-1 font-bold text-amber-700">เทพ · {q.deity}</span>
        ) : null}
      </div>
      {q.gates.length > 0 ? (
        <div>
          <p className="mb-1 text-[12px] font-medium text-v3-text-muted">ตาราง 8 ประตู 八門 · ทิศ · เทพ</p>
          <ul className="grid grid-cols-2 gap-1.5">
            {q.gates.map((g) => (
              <li key={g.name} className="flex items-center gap-2 rounded-lg bg-v3-ghost-white px-2.5 py-1.5 text-[12px]">
                <span className="text-[15px] font-bold leading-none text-v3-navy">{g.name}</span>
                <span className="text-v3-text-body">{directionLabelTH(g.direction)}</span>
                {g.deity ? <span className="ml-auto font-bold text-v3-sapphire">{g.deity}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export function YearMonthFortune({ year, month }: { year: DayDetailQimen | null; month: DayDetailQimen | null }) {
  if (!year && !month) return null
  return (
    <SectionCard
      title="ดวงประจำปี / เดือน"
      testId="year-month-fortune"
      info={<p>ทิศโชคลาภ · ทิศร้าย · เทพ · คี้มึ้ง (奇門) และตาราง 8 ประตูระดับปีและเดือน ตามเอกสารซินแส — ใช้เสริมกับดวงรายวัน</p>}
    >
      <div className="flex flex-col gap-5">
        {year ? <FortuneBlock label="ประจำปี" q={year} /> : null}
        {month ? <FortuneBlock label="ประจำเดือน" q={month} /> : null}
      </div>
    </SectionCard>
  )
}
