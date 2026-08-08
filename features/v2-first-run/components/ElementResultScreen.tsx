import type { ComponentType, SVGProps } from 'react'
import Image from 'next/image'
import { Activity, Check, Leaf } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FirstRunScreen } from './FirstRunScreen'
import {
  ElementEarthIcon,
  ElementFireIcon,
  ElementMetalIcon,
  ElementWaterIcon,
  ElementWoodIcon,
  InfoIcon,
} from './icons'

// ElementResultScreen — "ธาตุของคุณคือ ไม้" (Figma node 300:2356; the frame is still NAMED "04-pdpa"
// in the file — a duplicate that was never renamed. Content confirms it is screen 05.)
//
// The long one: 1853px at 375 wide, so this screen SCROLLS. FullBleedScreen's min-h-screen (not a
// fixed height) is what lets it grow instead of clipping.
//
// Everything below is fixture copy straight from the Figma frame. Issue #215 is UI only — nothing
// here is wired to a fortune, and the props exist so ใบ 3 can feed the real one without a rewrite.

export type ElementKey = 'WOOD' | 'METAL' | 'FIRE' | 'EARTH' | 'WATER'

// Colours come from the DESIGN.md v3 §2 element ICON palette (tailwind `v3-el-*`), NOT the hexes
// baked into this Figma node. The node draws #2EA214/#E7B101/#D70909/#D57018 where the contract says
// #55B43F/#EBBF30/#DC2727/#DC8B43 (WATER agrees at #14ADFF). Following the contract keeps one green
// for ธาตุไม้ across the app instead of two; the delta is reported on issue #215 and flipping it is
// a one-line change here.
const ELEMENT: Record<
  ElementKey,
  { th: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; tone: string }
> = {
  WOOD: { th: 'ธาตุไม้', Icon: ElementWoodIcon, tone: 'text-v3-el-wood' },
  METAL: { th: 'ธาตุทอง', Icon: ElementMetalIcon, tone: 'text-v3-el-metal' },
  FIRE: { th: 'ธาตุไฟ', Icon: ElementFireIcon, tone: 'text-v3-el-fire' },
  EARTH: { th: 'ธาตุดิน', Icon: ElementEarthIcon, tone: 'text-v3-el-earth' },
  WATER: { th: 'ธาตุน้ำ', Icon: ElementWaterIcon, tone: 'text-v3-el-water' },
}

export type FacetRow = { label: string; element: ElementKey }

export type ElementResult = {
  /** Heading tail — "ธาตุของคุณคือ {elementTh}". */
  elementTh: string
  intro: string
  artSrc: string
  polarityTitle: string
  polaritySubtitle: string
  facets: FacetRow[]
  traits: string[]
  advice: string[]
}

export const WOOD_FIXTURE: ElementResult = {
  elementTh: 'ไม้',
  intro:
    'สัญลักษณ์แห่งความเจริญรุ่งเรือง และการเริ่มต้นใหม่ คุณคือผู้สร้าง แรงบันดาลใจและมีพลังชีวิตที่เข้มแข็ง',
  // Byte-identical to the image behind Figma 300:2416 (md5 checked against the raw fill, not matched
  // by filename). It is the CARD art (1087×1506 scene), not the transparent character sprite in
  // public/images/v2/characters/ — those are a different crop and would render with no background.
  artSrc: '/images/v2/cards/01_ชวด-ไม้.jpg',
  polarityTitle: 'ธาตุไม้หยิน',
  polaritySubtitle: 'ธาตุที่ส่งผลในเเต่ละด้านของคุณ วิเคราะห์ธาตุในเเต่ละด้าน',
  facets: [
    { label: 'เพื่อน/พี่น้อง/หุ้นส่วน', element: 'WOOD' },
    { label: 'เรียน/ทำงาน/ลงทุน', element: 'METAL' },
    { label: 'หน้าที่การงาน', element: 'FIRE' },
    { label: 'โชคลาภ', element: 'EARTH' },
    { label: 'คู่ครอง', element: 'EARTH' },
    { label: 'ผู้สนับสนุน/ส่งเสริม', element: 'WATER' },
  ],
  traits: [
    'มีความคิดริเริ่มสร้างสรรค์และจินตนาการกว้างไกล',
    'เห็นอกเห็นใจผู้อื่นและมีความโอบอ้อมอารี',
    'มีความเป็นผู้นำและพร้อมจะเติบโตอยู่เสมอ',
  ],
  advice: [
    'รักษาสมดุลพลังงานด้วยการใช้เวลาท่ามกลางธรรมชาติบ่อยๆ',
    'ออกกำลังกายเบาๆ อย่างสม่ำเสมอเพื่อช่วยให้ลมปราณไหลเวียน',
  ],
}

/** 20px ghost-white chip + 12px cyan glyph — the bullet used by both list cards. */
function BulletRow({
  Icon,
  children,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  children: string
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-v3-ghost-white">
        {/* size 12 at strokeWidth 4: lucide draws on a 24 viewBox, so rendering it at half size
            halves the stroke too — 4 lands back on the 2px the Figma 12×12 export has. */}
        <Icon className="size-3 text-v3-cyan" strokeWidth={4} aria-hidden="true" />
      </span>
      <span className="min-w-0 font-ibm text-sm leading-[22px] text-v3-text-muted">{children}</span>
    </li>
  )
}

export function ElementResultScreen({
  result = WOOD_FIXTURE,
  onBack,
  onReadFull,
  onGoHome,
}: {
  result?: ElementResult
  onBack?: () => void
  onReadFull?: () => void
  onGoHome?: () => void
}) {
  return (
    <FirstRunScreen
      step={2}
      onBack={onBack}
      contentClassName="gap-8 px-6 py-8"
      footer={
        <div className="flex flex-col gap-2">
          <Button onClick={onReadFull}>อ่านดวงของฉันทั้งหมด</Button>
          <Button variant="tertiary" onClick={onGoHome}>
            เข้าสู่หน้าหลัก
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 text-center">
        <h1 className="font-ibm text-2xl font-bold leading-8 text-v3-text-title">
          ธาตุของคุณคือ {result.elementTh}
        </h1>
        <p className="font-ibm text-base leading-6 text-v3-text-body">{result.intro}</p>
      </div>

      {/* Hero art. width/height are the artwork's real pixels so next/image keeps the intrinsic
          aspect; the box is fluid, which is what carries it from 320 to 430. */}
      <Image
        src={result.artSrc}
        alt=""
        aria-hidden="true"
        width={1087}
        height={1506}
        sizes="(max-width: 448px) 100vw, 448px"
        priority
        className="h-auto w-full rounded-3xl"
      />

      {/* The three cards are 8px apart from each other, while the blocks above them are 32 apart —
          so they get their own stack instead of riding the page's gap-8. */}
      <div className="flex flex-col gap-2">
        {/* facet card. Not glass: the white/65 + backdrop-blur reading came from the same polluted
          export as the cream background, and against ghost-white it renders visibly blue. */}
        <section className="rounded-2xl bg-white px-4 py-6">
          <h2 className="font-ibm text-base font-bold leading-6 text-v3-text-title">
            {result.polarityTitle}
          </h2>
          <p className="mt-3 font-ibm text-sm leading-[22px] text-v3-text-body">
            {result.polaritySubtitle}
          </p>
          <dl className="mt-3">
            {result.facets.map(({ label, element }) => {
              const el = ELEMENT[element]
              return (
                <div
                  key={label}
                  // every row carries its top rule, including the first — Figma draws one right under
                  // the subtitle (588:10528) before the first row starts
                  className="flex items-center gap-2 border-t border-v3-border-card py-3"
                >
                  <dt className="min-w-0 flex-1 font-ibm text-sm leading-[22px] text-v3-text-body">
                    {label}
                  </dt>
                  <dd className="flex shrink-0 items-center gap-2">
                    <el.Icon className={`size-6 ${el.tone}`} />
                    {/* the element NAME stays neutral — colour lives only in the glyph (DESIGN.md §2) */}
                    <span className="font-ibm text-sm leading-[22px] text-v3-text-body">
                      {el.th}
                    </span>
                  </dd>
                  <InfoIcon className="size-[19px] shrink-0 text-v3-cyan" />
                </div>
              )
            })}
          </dl>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl bg-white p-4">
          <h2 className="font-ibm text-base font-bold leading-6 text-v3-text-title">
            ลักษณะเด่นของคุณ
          </h2>
          <ul className="flex flex-col gap-3">
            {result.traits.map((t) => (
              <BulletRow key={t} Icon={Check}>
                {t}
              </BulletRow>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl bg-white p-4">
          <h2 className="font-ibm text-base font-bold leading-6 text-v3-text-title">
            คำแนะนำเบื้องต้น
          </h2>
          <ul className="flex flex-col gap-3">
            {result.advice.map((a, i) => (
              <BulletRow key={a} Icon={i === 0 ? Leaf : Activity}>
                {a}
              </BulletRow>
            ))}
          </ul>
        </section>
      </div>
    </FirstRunScreen>
  )
}

export default ElementResultScreen
