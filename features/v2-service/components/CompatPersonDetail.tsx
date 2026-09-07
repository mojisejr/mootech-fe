// features/v2-service/components/CompatPersonDetail.tsx — การ์ดคน 1 คนใน "คำทำนายพื้นฐาน" (Figma 636:18819 §people/pc)
// สเปก design context (MCP 2026-09-07):
//   การ์ด: ตัวเรา #ECF0FD / เขา #F9F4F0 · px16 py18 · r20 · gap14
//   header: Avatar 40 border-2 #E1FF00 (ทั้งสองคนในเฟรม 636:18819 §pc; ไม่มีรูป → ตัวย่อ #DAE2FF/#3758F9) · ชื่อ 15 bold #0B305B
//   · element-pill 12 bold (ElementPill ตัวเดียวกับ hero) · วันเกิด 14/22 #464646 · มาสคอต 51×70 r16
//   เส้นคั่น · เนื้อ (นิสัยจาก engine `nisai[]`) = bullet list 14/22 #464646 (ms-21) · "อ่านเพิ่ม" #1B9AAF 14 medium + ลูกศร asset 13 (ยุบเหลือย่อหน้าแรกก่อน)
import { useState } from 'react'
import Image from 'next/image'
import type { CompatResultPerson, CompatMascot } from '../compatibility-result'
import { SIDE_TINT, type SideKey } from '../compat-result-parts'
import { readChartTable } from '../chart-table'
import { personBirthLine, ElementPill } from './CompatResultHero'

export function CompatPersonDetail({ person, roleLabel, side = 'self', mascot }: { person?: CompatResultPerson; roleLabel: string; side?: SideKey; mascot?: CompatMascot | null }) {
  const [open, setOpen] = useState(false)
  const traits = (person?.nisai ?? []).map((t) => (t ?? '').trim()).filter(Boolean)
  const chart = readChartTable(person?.chart)
  const element = (chart?.dayElement ?? person?.elementTh ?? '').trim()
  const name = (person?.displayName ?? '').trim() || roleLabel
  const birth = personBirthLine(person)
  const photo = (person?.imageProfile ?? '').trim()
  const mascotUrl = (mascot?.imageUrl ?? '').trim()
  if (traits.length === 0 && !element && !birth) return null
  const shown = open ? traits : traits.slice(0, 1)

  return (
    <section data-testid="compat-person-detail" data-side={side} className="flex flex-col gap-3.5 rounded-[20px] px-4 py-[18px]" style={{ backgroundColor: SIDE_TINT[side] }}>
      <div className="flex items-center gap-3.5">
        {photo ? (
          <span className="relative block size-10 shrink-0 overflow-hidden rounded-full border-2 border-v3-lime">
            <Image src={photo} alt="" fill sizes="40px" style={{ objectFit: 'cover' }} />
          </span>
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#DAE2FF] text-[16px] font-bold text-[#3758F9]">{Array.from(name)[0] ?? '—'}</span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="flex flex-wrap items-start gap-1">
            <span className="truncate text-[15px] font-bold leading-5 text-v3-navy">{name}</span>
            <ElementPill elementTh={element} testId="compat-person-element" />
          </p>
          {birth ? <p className="text-[14px] leading-[22px] text-v3-text-body">{birth}</p> : null}
        </div>
        {mascotUrl ? (
          <span className="relative h-[70px] w-[51px] shrink-0 overflow-hidden rounded-2xl">
            <Image src={mascotUrl} alt="" fill sizes="51px" style={{ objectFit: 'cover' }} />
          </span>
        ) : null}
      </div>
      {traits.length ? (
        <>
          <div className="border-b border-dashed border-v3-divider-dashed" />
          <ul data-testid="compat-person-nisai" className="flex list-disc flex-col gap-2 text-[14px] leading-[22px] text-v3-text-body">
            {shown.map((t, i) => (
              <li key={i} className="ms-[21px] whitespace-pre-line">{t}</li>
            ))}
          </ul>
          {traits.length > 1 ? (
            <button type="button" data-testid="compat-person-more" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 self-start text-[14px] font-medium leading-5 text-v3-cyan">
              {open ? 'ย่อ' : 'อ่านเพิ่ม'}
              {/* Figma "ooui:arrow-next-ltr" 13px asset — points right when collapsed, up when expanded */}
              <img src="/images/v2/compat/arrow-next.svg" alt="" width={13} height={13} className={`size-[13px] ${open ? '-rotate-90' : ''}`} aria-hidden />
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

export default CompatPersonDetail
