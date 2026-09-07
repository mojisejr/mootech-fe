// features/v2-service/components/CompatDimensionCard.tsx — 1 มิติใน "ความเข้ากัน N ด้าน" (Figma 636:18819 §Grade color)
// สเปก design context (MCP 2026-09-07):
//   แถว: ไอคอน 56 #EAF0FA r10 (asset "ดวงสมพงค์" 26.8 = dim-icon-1..3.svg, วนตามลำดับมิติ) · label 16 semibold #464646
//   · Tag 14 semibold/20 (⭐ จุดแข็ง #2E7D32 บน rgba(46,125,50,.14) / ⚠️ ต้องดูแล #B71C1C บน rgba(183,28,28,.14), px7 py3 r100)
//   Bar Row: bar h10 #EAECEF fill สีเกรด · % 14 REGULAR/22 สีเกรด · badge เกรด w48 px14 py4 r100 (16 bold, ตัวขาว / C+ #374151)
//   กล่องเหตุผล (gap4 จากแถว): พื้นตามเกรด (TIER_SOFT) · px12 py10 · r16 · bullet list 14/22 #464646 (ratingText แยกบรรทัด = 1 bullet)
import Image from 'next/image'
import type { CompatDimension } from '../compatibility-result'
import { gradeTier, TIER_COLOR, TIER_SOFT, TIER_INK, deriveTone, TONE_TEXT, pctWidth, type DimTone } from '../compat-result-parts'

const INK_BODY = '#464646'
const TONE_INK: Record<'strong' | 'watch', string> = { strong: '#2E7D32', watch: '#B71C1C' }
// Figma Tag bg = the ink at 14% (sampled: rgba(46,125,50,0.14) / rgba(183,28,28,0.14))
const TONE_BG: Record<'strong' | 'watch', string> = { strong: 'rgba(46,125,50,0.14)', watch: 'rgba(183,28,28,0.14)' }
// Figma 636:18819 draws three distinct "ดวงสมพงค์" glyphs across the five rows (img · img1 · img2); the file
// binds none of them to a dimension key, so the icon is picked by ROW INDEX (0,1,2,0,1…) — decoration, not data.
const DIM_ICONS = ['dim-icon-1.svg', 'dim-icon-2.svg', 'dim-icon-3.svg'] as const

/** ratingText → bullet lines. The engine's text is the source of truth; a newline is the only split. */
export function ratingLines(text?: string | null): string[] {
  return (text ?? '').split(/\r?\n/).map((l) => l.replace(/^[•\-\u2022]\s*/, '').trim()).filter(Boolean)
}

export function CompatDimensionCard({ dimension, tone: toneProp, index = 0 }: { dimension: CompatDimension; tone?: DimTone; /** row position → which of the three Figma glyphs */ index?: number }) {
  const label = (dimension.label ?? dimension.pairingLabel ?? '').trim()
  const hasPercent = dimension.percent != null
  const rating = (dimension.ratingText ?? '').trim()
  if (!label && !hasPercent && !rating) return null
  const tier = gradeTier(dimension.grade)
  const color = TIER_COLOR[tier]
  const tone: DimTone = toneProp !== undefined ? toneProp : deriveTone(dimension.grade)
  const sising = dimension.sising
  const lines = ratingLines(rating)
  const icon = DIM_ICONS[((index % DIM_ICONS.length) + DIM_ICONS.length) % DIM_ICONS.length]

  return (
    <section data-testid="compat-dim-card" data-main={dimension.isMain ? 'true' : undefined} className="flex flex-col gap-1">
      <div className="flex items-start gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-[10px] bg-[#EAF0FA]">
          <Image src={`/images/v2/compat/${icon}`} alt="" width={27} height={27} className="size-[27px]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1 self-stretch">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {label ? <p className="min-w-0 flex-1 text-[16px] font-semibold text-v3-text-body">{label}</p> : null}
            {tone ? (
              <span data-testid="compat-dim-tone" className="shrink-0 rounded-[100px] px-[7px] py-[3px] text-[14px] font-semibold leading-5" style={{ color: TONE_INK[tone], backgroundColor: TONE_BG[tone] }}>
                {TONE_TEXT[tone]}
              </span>
            ) : null}
          </div>
          {hasPercent ? (
            <div className="flex items-center gap-2">
              <span className="h-[10px] min-w-0 flex-1 overflow-hidden rounded-[100px] bg-[#EAECEF]">
                <span data-testid="compat-dim-bar" className="block h-full rounded-[100px]" style={{ width: `${pctWidth(dimension.percent)}%`, backgroundColor: color }} />
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="text-[14px] font-normal leading-[22px]" style={{ color }}>{dimension.percent}%</span>
                {dimension.grade ? (
                  <span data-testid="compat-dim-grade" className="grid w-12 shrink-0 place-items-center rounded-[100px] px-3.5 py-1 text-[16px] font-bold" style={{ backgroundColor: color, color: TIER_INK[tier] }}>
                    {dimension.grade}
                  </span>
                ) : null}
              </span>
            </div>
          ) : null}
        </div>
      </div>
      {lines.length ? (
        <ul data-testid="compat-dim-rating" className="flex list-disc flex-col gap-[5px] rounded-2xl px-3 py-2.5 text-[14px] leading-[22px]" style={{ backgroundColor: TIER_SOFT[tier], color: INK_BODY }}>
          {lines.map((l, i) => <li key={i} className="ms-[21px]">{l}</li>)}
        </ul>
      ) : null}
      {sising && (sising.nameTh || sising.summary) ? (
        <div data-testid="compat-dim-sising" className="flex items-start gap-2 rounded-2xl bg-v3-ghost-white px-3 py-2.5">
          <span aria-hidden className="text-[18px]">🐯</span>
          <p className="text-[13px] leading-5 text-v3-text-body">
            {sising.nameTh ? <span className="font-bold text-v3-navy">สิ่งชี้นำสัญลักษณ์: {sising.nameTh}</span> : null}
            {sising.summary ? <span className="block">{sising.summary}</span> : null}
          </p>
        </div>
      ) : null}
    </section>
  )
}

export default CompatDimensionCard
