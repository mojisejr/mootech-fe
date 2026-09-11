// §วันมงคล/วันพิเศษ — ดาววันจากปฏิทินซินแส (almanac.dayStars):
// วันมงคล (ผ่าน 3 ชั้น A∧B∧C) + วันความรัก/ลาภสวรรค์/หมอเทพ/ฟ้าอภัย.
// ส่งดิบจาก engine — ชื่อ + polarity(ดี/ร้าย) + กิจกรรมที่เหมาะ (แสดงเป็น chip; แตะ/hover เห็นกิจกรรม).
import type { DayDetailStar } from '../../types'
import { SectionCard } from './SectionCard'

export function SpecialDays({ specialDays }: { specialDays: DayDetailStar[] }) {
  if (!specialDays || specialDays.length === 0) return null
  return (
    <SectionCard
      title="วันมงคล / วันพิเศษ"
      testId="special-days"
      info={
        <p>วันพิเศษตามปฏิทินซินแส — วันมงคล (ฤกษ์ดีสำหรับตั้งศาล/ขึ้นบ้าน/เปลี่ยนชื่อ ฯลฯ) และวันเสริมเฉพาะด้าน (ความรัก/ลาภสวรรค์/หมอเทพ/ฟ้าอภัย)</p>
      }
    >
      <div className="flex flex-col gap-2">
        {specialDays.map((s, i) => (
          <div key={`${s.name}-${i}`} data-testid="special-day-row" className="flex items-start justify-between gap-3">
            <span
              className={`flex-none rounded-full px-2.5 py-[3px] text-[13px] font-bold ${
                s.polarity === 'bad' ? 'bg-v3-danger-bg text-v3-danger-text' : 'bg-v3-qi-earn-bg text-v3-qi-earn-icon'
              }`}
            >
              {s.polarity === 'bad' ? '⛔' : '✅'} {s.name}
            </span>
            {s.activity ? <span className="text-right text-[13px] leading-5 text-v3-text-detail">{s.activity}</span> : null}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
