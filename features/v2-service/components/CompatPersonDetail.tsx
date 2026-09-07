// features/v2-service/components/CompatPersonDetail.tsx — การ์ดคน 1 คนใน "คำทำนายพื้นฐาน" (Figma 636:18819 §people/pc)
// สเปก design context (MCP 2026-09-07):
//   การ์ด: ตัวเรา #ECF0FD / เขา #F9F4F0 · px16 py18 · r20 · gap14
//   header: Avatar 40 (ring #E1FF00 ตัวเรา · ตัวย่อ #DAE2FF/#3758F9 เขา) · ชื่อ 15 bold #0B305B · ชิปธาตุ 12 · วันเกิด 14 #464646 · มาสคอต 51×70 r16
//   เส้นคั่น · เนื้อ (นิสัยจาก engine `nisai[]`) 14 / 13 #464646 · "อ่านเพิ่ม" #1B9AAF 14 + ลูกศร 13 (ยุบเหลือย่อหน้าแรกก่อน)
import { useState } from 'react'
import Image from 'next/image'
import type { CompatResultPerson, CompatMascot } from '../compatibility-result'
import { SIDE_TINT, type SideKey } from '../compat-result-parts'
import { CHART_ELEMENT_SOFT, CHART_PILL_INK, readChartTable } from '../chart-table'
import { personBirthLine } from './CompatResultHero'

const INK_BODY = '#464646'

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
          <span className={`relative block size-10 shrink-0 overflow-hidden rounded-full ${side === 'self' ? 'ring-[2px] ring-[#E1FF00]' : ''}`}>
            <Image src={photo} alt="" fill sizes="40px" style={{ objectFit: 'cover' }} />
          </span>
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#DAE2FF] text-[16px] font-bold text-[#3758F9]">{Array.from(name)[0] ?? '—'}</span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="flex flex-wrap items-center gap-1">
            <span className="truncate text-[15px] font-bold leading-5 text-[#0B305B]">{name}</span>
            {element ? (
              <span data-testid="compat-person-element" className="rounded-[100px] px-2 py-[2px] text-[12px] font-bold leading-4" style={{ backgroundColor: CHART_ELEMENT_SOFT[element] ?? '#EEF1F4', color: CHART_PILL_INK[element] ?? INK_BODY }}>ธาตุ{element}</span>
            ) : null}
          </p>
          {birth ? <p className="text-[14px] leading-[22px]" style={{ color: INK_BODY }}>{birth}</p> : null}
        </div>
        {mascotUrl ? (
          <span className="relative h-[70px] w-[51px] shrink-0 overflow-hidden rounded-2xl">
            <Image src={mascotUrl} alt="" fill sizes="51px" style={{ objectFit: 'cover' }} />
          </span>
        ) : null}
      </div>
      {traits.length ? (
        <>
          <div className="border-b border-dashed border-[#EBD9C8]" />
          <div data-testid="compat-person-nisai" className="flex flex-col gap-2">
            {shown.map((t, i) => (
              <p key={i} className="whitespace-pre-line text-[14px] leading-[22px]" style={{ color: INK_BODY }}>{t}</p>
            ))}
          </div>
          {traits.length > 1 ? (
            <button type="button" data-testid="compat-person-more" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 self-start text-[14px] font-medium leading-5 text-[#1B9AAF]">
              {open ? 'ย่อ' : 'อ่านเพิ่ม'}
              <svg viewBox="0 0 16 16" className={`size-[13px] ${open ? '-rotate-90' : 'rotate-90'}`} fill="none" aria-hidden><path d="M4 8h8m0 0-3-3m3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

export default CompatPersonDetail
