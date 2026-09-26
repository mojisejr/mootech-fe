// features/v2-calendar/components/day-detail/RecommendedActivities.tsx — กิจกรรมพิเศษแนะนำของวัน (Calendar#3 ซินแสนุ้ย)
//   ***ไม่ใช่ฤกษ์ยาม*** — ใช้ร่วมกับ % วันดีกับดวง (ยิ่ง %สูงยิ่งเสริมโอกาสสำเร็จ). โหมด Advance เท่านั้น.
//   ว่าง → คืน null (การ์ดซ่อนตัวเอง).
import type { DayDetailActivity } from '../../types'

export function RecommendedActivities({ activities }: { activities?: DayDetailActivity[] }) {
  if (!activities || activities.length === 0) return null
  return (
    <section data-testid="day-recommended-activities" className="rounded-[20px] bg-white p-4 v3-shadow-line">
      <div className="flex items-center gap-2">
        <span aria-hidden className="grid size-7 flex-none place-items-center rounded-full bg-[#EAF3FF] text-[15px]">🗓️</span>
        <h3 className="text-[15px] font-bold text-v3-navy">กิจกรรมพิเศษแนะนำวันนี้</h3>
      </div>
      {/* หมายเหตุสำคัญ (ซินแส): ไม่ใช่ฤกษ์ยาม + ยิ่ง %วันดีสูงยิ่งเสริม */}
      <p className="mt-1 rounded-lg bg-[#FFF7E6] px-2.5 py-1.5 text-[11px] leading-4 text-[#8A5A00]">
        ⚠️ ไม่ใช่ฤกษ์ยาม — เป็นกิจกรรมเสริม ใช้ร่วมกับ “% วันดีกับดวง” (ยิ่ง %สูง ยิ่งเพิ่มโอกาสสำเร็จ)
      </p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {activities.map((a, i) => (
          <li key={`${a.key}-${i}`} className="rounded-[14px] bg-v3-ghost-white px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-v3-sapphire px-2 py-0.5 text-[11px] font-bold leading-none text-white">{a.dayLabel}</span>
              <span className="text-[14px] font-bold text-v3-navy">{a.title}</span>
            </div>
            {a.desc ? <p className="mt-1 text-[12px] leading-[18px] text-v3-text-body">{a.desc}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default RecommendedActivities
