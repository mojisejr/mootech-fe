// การ์ด "ดวงประจำปี / เดือน" (奇門 คี้มึ้ง) — เอกสารซินแสนุ้ย (2026-09-13, ปรับ 2026-09-14)
// โชว์ เสาเต็มปี/เดือน (ราศีบน+ล่าง) · ทิศโชคลาภ/ทิศร้าย/เทพ + ตาราง 8 ประตูระดับปีและเดือน เสริมดวงรายวัน
// ข้อมูลมาจาก almanac.yearInfo/monthInfo → mapDayDetail → detail.yearFortune/monthFortune (แอดวานซ์)
//
// ซินแสนุ้ย 2026-09-14: (A) ทาสีตัวอักษร ประตู(八門)/เทพ(十神) ตามธาตุ · (C) โชว์เสาเต็ม 丙午/丁酉 (ราศีบน+ล่าง)
// ไม่ใช่แค่คี้มึ้ง(ก้าน). ตัวหนังสือไทย(ทิศ) คงสีปกติตามรูปวาดมือ ("ภาษาไทย ปกติ").
import { SectionCard } from './SectionCard'
import { directionLabelTH, GATE_ELEMENT, DEITY_ELEMENT, ELEMENT_TINT, type ElementTh } from './gate-compass'
import type { DayDetailQimen } from '@/features/v2-calendar/types'

// ก้านสวรรค์ (天干) → ธาตุ — ทาสีเสาเต็ม/คี้มึ้งตามธาตุของก้าน
const STEM_ELEMENT: Record<string, ElementTh> = {
  甲: 'ไม้', 乙: 'ไม้', 丙: 'ไฟ', 丁: 'ไฟ', 戊: 'ดิน', 己: 'ดิน',
  庚: 'ทอง', 辛: 'ทอง', 壬: 'น้ำ', 癸: 'น้ำ',
}
const inkOf = (el?: ElementTh): string | undefined => (el ? ELEMENT_TINT[el].ink : undefined)

function FortuneBlock({ label, q }: { label: string; q: DayDetailQimen }) {
  const pillar = q.pillar || q.kimeng // เสาเต็ม (丙午) — fallback คี้มึ้ง(ก้าน) ถ้า engine เก่ายังไม่ส่ง pillar
  const stemEl = pillar ? STEM_ELEMENT[pillar.charAt(0)] : undefined
  return (
    <div className="flex flex-col gap-2.5" data-testid={`ymf-block-${label}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-v3-sapphire px-3 py-1 text-[13px] font-bold text-white">{label}</span>
        {pillar ? (
          <span className="rounded-full bg-v3-sapphire-tint px-3 py-1 text-[16px] font-bold leading-none" style={{ color: inkOf(stemEl) }}>
            {pillar}
          </span>
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
                {/* A: ตัวประตู 八門 สีตามธาตุประตู */}
                <span className="text-[15px] font-bold leading-none" style={{ color: inkOf(GATE_ELEMENT[g.name.trim()]) ?? '#1B2A4A' }}>{g.name}</span>
                {/* ทิศ = ตัวหนังสือไทย สีปกติ (ตามรูปวาดมือ "ภาษาไทย ปกติ") */}
                <span className="text-v3-text-body">{directionLabelTH(g.direction)}</span>
                {/* A: ชื่อเทพ 十神 สีตามธาตุเทพ */}
                {g.deity ? (
                  <span className="ml-auto text-[15px] font-bold leading-none" style={{ color: inkOf(DEITY_ELEMENT[g.deity.trim()]) ?? '#1B62B3' }}>{g.deity}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        // เสาที่ยังไม่มีตารางประตูระดับปี/เดือน (นอกช่วงที่กรอกข้อมูล) — โชว์หมายเหตุจาง ๆ ไม่ให้การ์ดดูค้าง
        <p className="text-[12px] text-v3-text-muted">ตารางประตู (奇門) ของเสานี้ยังไม่พร้อมให้บริการ</p>
      )}
    </div>
  )
}

export function YearMonthFortune({ year, month }: { year: DayDetailQimen | null; month: DayDetailQimen | null }) {
  if (!year && !month) return null
  return (
    <SectionCard
      title="ประตู · เทพ · ทิศ · ปี/เดือน"
      testId="year-month-fortune"
      info={<p>เสาปี/เดือน (ราศีบน-ล่าง) · ทิศโชคลาภ · ทิศร้าย · เทพ และตาราง 8 ประตู (奇門) ระดับปีและเดือน ตามเอกสารซินแส — ใช้เสริมกับ &ldquo;ประตู · เทพ · ทิศ · ประจำวัน&rdquo;</p>}
    >
      <div className="flex flex-col gap-5">
        {year ? <FortuneBlock label="ประจำปี" q={year} /> : null}
        {month ? <FortuneBlock label="ประจำเดือน" q={month} /> : null}
      </div>
    </SectionCard>
  )
}
