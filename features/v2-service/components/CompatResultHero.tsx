// features/v2-service/components/CompatResultHero.tsx — ดวงสมพงศ์ 3C · the top BLUE HERO (Figma 636:18819).
// Scope A (ฟีม 2026-08-02): the whole top is ONE navy frame — ScoreRing + tagline + a derived highlights
// summary + the two people as big MASCOT cards (mascot art · real photo overlaid · name · birthdate). This
// REPLACES the shipped 2E-1 header chips + the separate gradient score card (an INTENTIONAL spine rebuild —
// documented in the evidence; golden-rule-6 covers only the parts that must NOT move).
//
// Rule 4 (ไม่มีข้อมูล = ไม่แสดง) throughout:
//   · mascot image (goo 3B `imageUrlV2`, not shipped yet) absent → no illustration
//   · person photo (imageProfile, carried from the form; absent when opened from history) → no photo circle
//   · birthdate absent (history) → line hidden · name is the only always-present label
// FLAGGED (in evidence, for ฟีม/goo at PR): the Figma's lead summary sentence has no contract source → omitted;
//   hearts/emoji (2E-1) have no place in the Figma hero → omitted here; corner element sprites → pending assets.
import Image from 'next/image'
import { ScoreRing } from '@/features/v2-calendar/components/day-detail/ScoreRing'
import type { CompatOverall, CompatResultPerson, CompatMascot, CompatDimension } from '../compatibility-result'
import { deriveHeroHighlights } from '../compat-result-parts'
import { formatCompatBirth } from './compat-format'

// one person: the mascot illustration (if any), the real photo circle overlaid (if any), name, birthdate.
function HeroPerson({ person, mascot, roleLabel, testId }: {
  person?: CompatResultPerson
  mascot?: CompatMascot | null
  roleLabel: string
  testId: string
}) {
  const img = (mascot?.imageUrl ?? '').trim()
  const photo = (person?.imageProfile ?? '').trim()
  const name = (person?.displayName ?? '').trim()
  const birth = formatCompatBirth(person?.birthDate ?? '', person?.time ?? '')
  return (
    <div data-testid={testId} className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
      {/* mascot illustration card (scenic) — hidden until goo's image arrives */}
      {img ? (
        <span data-testid={`${testId}-mascot`} className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-white/10">
          <Image src={img} alt={name || roleLabel} fill sizes="180px" style={{ objectFit: 'cover' }} />
        </span>
      ) : null}
      {/* real photo circle — overlaps the mascot card's bottom when both exist; standalone otherwise */}
      {photo ? (
        <span data-testid={`${testId}-photo`} className={`relative grid size-14 place-items-center overflow-hidden rounded-full ring-2 ring-v3-lime ${img ? '-mt-7' : 'mt-1'}`}>
          <Image src={photo} alt="" fill sizes="56px" style={{ objectFit: 'cover' }} />
        </span>
      ) : null}
      <span data-testid={`${testId}-name`} className="mt-1 truncate text-[16px] font-bold text-white">{name || roleLabel}</span>
      {birth ? <span data-testid={`${testId}-birth`} className="text-[12px] font-normal text-white/80">{birth}</span> : null}
    </div>
  )
}

export function CompatResultHero({ overall, persons, dimensions, mascotA, mascotB }: {
  overall?: CompatOverall
  persons: { a?: CompatResultPerson; b?: CompatResultPerson }
  dimensions?: CompatDimension[]
  mascotA?: CompatMascot | null
  mascotB?: CompatMascot | null
}) {
  const hasScore = overall?.grade != null && overall?.percent != null
  const tagline = (overall?.gradeLabel ?? '').trim()
  const { best, worst } = deriveHeroHighlights(dimensions)

  return (
    <section data-testid="compat-result-hero" className="flex flex-col items-center gap-4 rounded-[24px] bg-v3-navy px-5 py-6 text-center">
      {hasScore ? <ScoreRing grade={overall!.grade!} percent={overall!.percent!} /> : null}
      {tagline ? <p data-testid="compat-hero-tagline" className="text-[22px] font-bold leading-8 text-white">{tagline}</p> : null}
      {/* derived highlights — strongest + weakest dimension (rule 4: hidden when no dimensions) */}
      {best ? (
        <div data-testid="compat-hero-highlights" className="flex flex-col gap-1 text-[14px] leading-6 text-white/85">
          <span>จุดแข็งอยู่ที่ <b className="font-bold text-white">{best.label}</b> ({best.percent}%)</span>
          {worst ? <span>จุดที่ต้องดูแลคือ <b className="font-bold text-white">{worst.label}</b> ({worst.percent}%)</span> : null}
        </div>
      ) : null}
      {/* the two people as mascot cards */}
      <div className="mt-1 flex w-full items-start gap-3">
        <HeroPerson person={persons?.a} mascot={mascotA} roleLabel="คุณ" testId="compat-result-person-a" />
        <HeroPerson person={persons?.b} mascot={mascotB} roleLabel="เขา" testId="compat-result-person-b" />
      </div>
    </section>
  )
}

export default CompatResultHero
