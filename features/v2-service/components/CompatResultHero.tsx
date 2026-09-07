// features/v2-service/components/CompatResultHero.tsx — hero ผลดวงสมพงศ์คู่รัก (Figma 636:18819 §promo-personal-calendar)
// สเปกจาก design context (MCP 2026-09-07):
//   การ์ด #1455A4 r22 · px16 pt34 pb24 · gap28
//   donut 90px (track / progress, ตัว lime) · headline (gradeLabel) ขาว 20 bold/28 · สรุป (ratingText) ขาว 14/22 · gap12
//   แถวคน (parity 2026-09-07): มาสคอต 2 ใบเต็มกว้าง (flex-1, aspect 1087/1506, r16, gap16, ยื่นทับแถวล่าง -23px)
//   · profile-row ×2 = Avatar 64 border-2 #E1FF00 + ชื่อ 16 bold + วันเกิด 12/18 + element-pill 12 bold (สีธาตุ/พื้นหลัง+ตัวอักษร)
//   · คั่นด้วย HeartConnector (bg rgba(225,255,0,.14) p12 r100, หัวใจ = asset heart.svg 20)
//   sprite ธาตุลอย (คงของเดิม 636:19061)
// rule 4: ไม่มีข้อมูล = ไม่วาด (ไม่เดารูป/ชื่อ/วันเกิด) — วันเกิดอ่านจาก chart ที่ engine แนบ (ผลใหม่) หรือค่าที่ carried มาจากฟอร์ม
import { useState } from 'react'
import Image from 'next/image'
import { ScoreRing } from '@/features/v2-calendar/components/day-detail/ScoreRing'
import type { CompatOverall, CompatResultPerson, CompatMascot } from '../compatibility-result'
import { readChartTable, CHART_ELEMENT_SOFT, CHART_PILL_INK } from '../chart-table'
import { formatCompatBirth } from './compat-format'

/** element-pill (Figma 636:18819 §PillWrapper): px8 py2 r100 · 12 bold · สีจาก variables "สีธาตุ/<ธาตุ>" — ไม่มีธาตุ = ไม่วาด */
export function ElementPill({ elementTh, testId }: { elementTh?: string | null; testId?: string }) {
  const th = (elementTh ?? '').trim()
  if (!th) return null
  return (
    <span data-testid={testId} className="inline-flex rounded-[100px] px-2 py-[2px] text-[12px] font-bold leading-4" style={{ backgroundColor: CHART_ELEMENT_SOFT[th] ?? '#EEF1F4', color: CHART_PILL_INK[th] ?? '#464646' }}>
      ธาตุ{th}
    </span>
  )
}

const HERO_SPRITES = [
  { src: 'sprite-fire.png', left: '6.8%', top: 12, w: 58, r: 10.24, delay: 0 },
  { src: 'sprite-earth.png', left: '-4%', top: 63, w: 36, r: 5.09, delay: -700 },
  { src: 'sprite-water.png', left: '9.4%', top: 85, w: 19, r: -13.79, delay: -300 },
  { src: 'sprite-metal.png', left: '3.6%', top: 103, w: 24, r: -13.79, delay: -1100 },
  { src: 'sprite-wood.png', left: '1.3%', top: 141, w: 25, r: 10.24, delay: -500 },
  { src: 'sprite-wood-lg.png', left: '87%', top: 105, w: 63, r: -10.65, delay: -900 },
] as const

/** วันเกิดของคน — chart จาก engine ก่อน (ผลใหม่ 2026-09-07), ไม่มี → ค่าที่ carried จากฟอร์ม, ไม่มี → '' */
export function personBirthLine(person?: CompatResultPerson): string {
  const chart = readChartTable(person?.chart)
  if (chart) return formatCompatBirth(chart.birthDate, person?.timeKnown === false ? '' : chart.birthTime ?? '')
  return formatCompatBirth(person?.birthDate ?? '', person?.time ?? '')
}

function HeroPerson({ person, roleLabel, testId }: { person?: CompatResultPerson; roleLabel: string; testId: string }) {
  const photo = (person?.imageProfile ?? '').trim()
  const [broken, setBroken] = useState(false)
  const showPhoto = !!photo && !broken
  const name = (person?.displayName ?? '').trim()
  const birth = personBirthLine(person)
  const element = (readChartTable(person?.chart)?.dayElement ?? person?.elementTh ?? '').trim()
  return (
    <div data-testid={testId} className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      {/* Avatar 64 · border-2 #E1FF00 — รูปจริง (ฟอร์ม/บัญชี) ไม่มี → โลโก้ Mumate (ฟีม 2026-08-31: "ใครไม่มีรูป ก็ fallback") */}
      <span
        data-testid={showPhoto ? `${testId}-photo` : `${testId}-avatar-fallback`}
        className="relative grid size-16 place-items-center overflow-hidden rounded-full border-2 border-[#E1FF00]"
      >
        {showPhoto ? (
          <Image src={photo} alt="" fill sizes="64px" style={{ objectFit: 'cover' }} onError={() => setBroken(true)} />
        ) : (
          <img src="/images/mumate/ic_logo_app.svg" alt="" className="size-full object-cover" />
        )}
      </span>
      <div className="flex w-full flex-col items-center gap-1">
        <span data-testid={`${testId}-name`} className="max-w-full truncate text-[16px] font-bold leading-6 text-white">{name || roleLabel}</span>
        {birth ? <span data-testid={`${testId}-birth`} className="text-[12px] font-normal leading-[18px] text-white">{birth}</span> : null}
        <ElementPill elementTh={element} testId={`${testId}-element`} />
      </div>
    </div>
  )
}

// Figma 636:18819 "11_จอ-น้ำ 1"/"11_จอ-ไฟ 1": two full-width tiles, flex-1 each, aspect 1087/1506, r16, gap16
function MascotTile({ mascot, testId }: { mascot?: CompatMascot | null; testId: string }) {
  const img = (mascot?.imageUrl ?? '').trim()
  if (!img) return null
  return (
    <span data-testid={testId} className="relative block min-w-0 flex-1 overflow-hidden rounded-2xl bg-white/10" style={{ aspectRatio: '1087 / 1506' }}>
      <Image src={img} alt="" fill sizes="(max-width: 448px) 45vw, 200px" style={{ objectFit: 'cover' }} />
    </span>
  )
}

function HeartConnector() {
  // Figma HeartConnector: bg rgba(225,255,0,0.14) · p12 · r100 · heart asset 20 (exported, not redrawn)
  return (
    <span data-testid="compat-hero-heart" className="grid shrink-0 place-items-center rounded-[100px] bg-[rgba(225,255,0,0.14)] p-3">
      <img src="/images/v2/compat/heart.svg" alt="" width={20} height={20} className="size-5" aria-hidden />
    </span>
  )
}

export function CompatResultHero({ overall, persons, mascotA, mascotB }: {
  overall?: CompatOverall
  persons: { a?: CompatResultPerson; b?: CompatResultPerson }
  mascotA?: CompatMascot | null
  mascotB?: CompatMascot | null
}) {
  const hasScore = overall?.grade != null && overall?.percent != null
  const headline = (overall?.gradeLabel ?? '').trim()
  const summary = (overall?.ratingText ?? '').trim()
  return (
    <section data-testid="compat-result-hero" className="relative overflow-hidden rounded-[22px] bg-[#1455A4] px-4 pb-6 pt-[34px] text-center">
      {/* decorative floating element sprites (Figma 636:19061) — behind the content, no interaction */}
      <div data-testid="compat-hero-sprites" aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {HERO_SPRITES.map((s) => (
          <img
            key={s.src}
            data-testid="compat-hero-sprite"
            src={`/images/v2/compat/${s.src}`}
            alt=""
            className="compat-sprite absolute"
            style={{ left: s.left, top: s.top, width: s.w, ['--sprite-rot' as string]: `${s.r}deg`, animationDelay: `${s.delay}ms` }}
          />
        ))}
      </div>
      <div className="relative z-10 flex flex-col items-center gap-7">
        <div className="flex w-full flex-col items-center gap-3">
          {hasScore ? <ScoreRing grade={overall!.grade!} percent={overall!.percent!} onDark size={90} /> : null}
          {headline ? <p data-testid="compat-hero-tagline" className="text-[20px] font-bold leading-7 text-white">{headline}</p> : null}
          {summary ? <p data-testid="compat-hero-summary" className="whitespace-pre-line text-[14px] leading-[22px] text-white">{summary}</p> : null}
        </div>
        <div className="flex w-full flex-col items-start">
          {/* มาสคอต 2 ใบ ยื่นทับแถวคน 23px (Figma mb-[-23px]) — ไม่มีมาสคอตทั้งคู่ = ไม่วาด (rule 4) */}
          {mascotA?.imageUrl || mascotB?.imageUrl ? (
            <div className="-mb-[23px] flex w-full items-start gap-4">
              <MascotTile mascot={mascotA} testId="compat-result-person-a-mascot" />
              <MascotTile mascot={mascotB} testId="compat-result-person-b-mascot" />
            </div>
          ) : null}
          <div className="flex w-full items-center gap-4">
            <HeroPerson person={persons?.a} roleLabel="คุณ" testId="compat-result-person-a" />
            <HeartConnector />
            <HeroPerson person={persons?.b} roleLabel="เขา" testId="compat-result-person-b" />
          </div>
        </div>
      </div>
    </section>
  )
}

export default CompatResultHero
