// §9 [advanced] "วันนี้มีความหมาย" — the day's officer (建除) meaning, as plain Thai bullets.
//
// ซินแส 2026-09-12: หัวข้อ = "วันนี้มีความหมาย" · แสดง "แค่ความหมาย" เป็น bullet · ไม่มีตัวจีน.
// เดิมเป็น 3 แถว label (ดิถี/ความหมาย/建除) ซึ่งโชว์ตัวจีน (建除 + glyph ในค่า jianchu เช่น "除 · …").
// ตอนนี้ดึงข้อความจาก {officer, officerDesc, jianchu} เหมือนเดิม แต่ strip ตัวจีน (CJK) ออกทุกบรรทัด
// แล้วแสดงเป็นหัวข้อ + bullet — ข้อมูลจาก pipe เท่าเดิม ไม่ได้เพิ่ม/ตีความ (คงหลัก M-D: ไม่มีสี/เกรด).
import type { DayDetailDithi } from '../../types'
import { SectionCard } from './SectionCard'

// ตัดอักษรจีน (CJK ideographs รวม compatibility) + ตัว "·"/ช่องว่างที่ค้างหัว-ท้ายออก เหลือเฉพาะไทย
function stripCJK(s: string | undefined): string {
  return (s ?? '')
    .replace(/[㐀-鿿豈-﫿]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s·]+|[\s·]+$/g, '')
    .trim()
}

export function Dithi({ dithi }: { dithi: DayDetailDithi }) {
  // #226 — officerDesc/jianchu are OPTIONAL (free viewer gets only `officer`). แต่ละบรรทัดคือความหมายหนึ่งช่วง;
  // strip ตัวจีนก่อน แล้ว filter บรรทัดที่ว่าง (เช่น jianchu ที่เหลือแต่ glyph จีน → ว่าง → ตัดทิ้ง).
  const items = [dithi.officer, dithi.officerDesc, dithi.jianchu]
    .map((v) => stripCJK(v))
    .filter((v) => v.length > 0)

  return (
    <SectionCard title="วันนี้มีความหมาย" testId="dithi">
      {items.length === 0 ? (
        <p className="text-sm text-v3-text-muted">วันนี้ไม่มีข้อมูลความหมาย</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((t, i) => (
            <li key={i} data-testid="dithi-row" className="flex items-baseline gap-2 text-base leading-6 text-v3-text-body">
              <span aria-hidden className="flex-none text-v3-sapphire">•</span>
              <span className="min-w-0 flex-1">{t}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
