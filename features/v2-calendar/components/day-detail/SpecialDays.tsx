// §วันมงคล/วันพิเศษ — ดาววันจากปฏิทินซินแส (almanac.dayStars):
// วันมงคล (ผ่าน 3 ชั้น A∧B∧C) + วันความรัก/ลาภสวรรค์/หมอเทพ/ฟ้าอภัย.
// ส่งดิบจาก engine — ชื่อ + polarity(ดี/ร้าย) + กิจกรรมที่เหมาะ (แสดงเป็น chip).
// ซินแสนุ้ย 2026-09-23: วันความรัก/วันลาภสวรรค์ "กดได้" → เด้งคำอธิษฐาน + สถานที่สักการะ (+ ทิศ, ลาภสวรรค์).
import { useState } from 'react'
import type { DayDetailStar } from '../../types'
import { SectionCard } from './SectionCard'
import { blessingForStar, type SpecialDayBlessing } from './special-day-blessings'
import { SpecialDayBlessingPopup } from './SpecialDayBlessingPopup'

export function SpecialDays({ specialDays, luckyDirection }: { specialDays: DayDetailStar[]; luckyDirection?: string }) {
  const [open, setOpen] = useState<SpecialDayBlessing | null>(null)
  if (!specialDays || specialDays.length === 0) return null
  return (
    <SectionCard
      title="วันมงคล / วันพิเศษ"
      testId="special-days"
      info={
        <p>วันพิเศษตามปฏิทินซินแส — วันมงคล (ฤกษ์ดีสำหรับตั้งศาล/ขึ้นบ้าน/เปลี่ยนชื่อ ฯลฯ) และวันเสริมเฉพาะด้าน (ความรัก/ลาภสวรรค์/หมอเทพ/ฟ้าอภัย) · แตะวันความรัก/ลาภสวรรค์เพื่อดูคำอธิษฐานและสถานที่สักการะ</p>
      }
    >
      <div className="flex flex-col gap-2">
        {specialDays.map((s, i) => {
          const blessing = s.polarity !== 'bad' ? blessingForStar(s.name) : null
          const pill = (
            <span
              className={`flex-none rounded-full px-2.5 py-[3px] text-[13px] font-bold ${
                s.polarity === 'bad' ? 'bg-v3-danger-bg text-v3-danger-text' : 'bg-v3-qi-earn-bg text-v3-qi-earn-icon'
              } ${blessing ? 'underline decoration-dotted underline-offset-2' : ''}`}
            >
              {s.polarity === 'bad' ? '⛔' : '✅'} {s.name}{blessing ? ' 🙏' : ''}
            </span>
          )
          return (
            <div key={`${s.name}-${i}`} data-testid="special-day-row" className="flex items-start justify-between gap-3">
              {blessing ? (
                <button type="button" data-testid="special-day-open" onClick={() => setOpen(blessing)} className="flex-none text-left">
                  {pill}
                </button>
              ) : (
                pill
              )}
              {s.activity ? <span className="text-right text-[13px] leading-5 text-v3-text-detail">{s.activity}</span> : null}
            </div>
          )
        })}
      </div>
      {open ? <SpecialDayBlessingPopup blessing={open} luckyDirection={luckyDirection} onClose={() => setOpen(null)} /> : null}
    </SectionCard>
  )
}
