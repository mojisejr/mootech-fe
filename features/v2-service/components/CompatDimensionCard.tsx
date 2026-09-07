// features/v2-service/components/CompatDimensionCard.tsx — 1 มิติใน "ความเข้ากัน N ด้าน" (Figma 636:18819 §Grade color)
// สเปก design context (MCP 2026-09-07):
//   แถว: ไอคอน 56 #EAF0FA r10 (asset "ดวงสมพงค์" 26.8) · label 16 semibold #464646 · Tag 14 (⭐ จุดแข็ง #2E7D32 / ⚠️ ต้องดูแล #B71C1C, px7 py3 r100)
//   Bar Row: bar h10 #EAECEF fill สีเกรด · % 14 bold สีเกรด · badge เกรด w48 px14 py4 r100 (16, ตัวขาว / C+ #374151)
//   กล่องเหตุผล: พื้นตามเกรด (TIER_SOFT) · px12 py10 · r16 · 14 #464646
import Image from 'next/image'
import type { CompatDimension } from '../compatibility-result'
import { gradeTier, TIER_COLOR, TIER_SOFT, TIER_INK, deriveTone, TONE_TEXT, pctWidth, type DimTone } from '../compat-result-parts'

const INK_BODY = '#464646'
const TONE_INK: Record<'strong' | 'watch', string> = { strong: '#2E7D32', watch: '#B71C1C' }

export function CompatDimensionCard({ dimension, tone: toneProp }: { dimension: CompatDimension; tone?: DimTone }) {
  const label = (dimension.label ?? dimension.pairingLabel ?? '').trim()
  const hasPercent = dimension.percent != null
  const rating = (dimension.ratingText ?? '').trim()
  if (!label && !hasPercent && !rating) return null
  const tier = gradeTier(dimension.grade)
  const color = TIER_COLOR[tier]
  const tone: DimTone = toneProp !== undefined ? toneProp : deriveTone(dimension.grade)
  const sising = dimension.sising

  return (
    <section data-testid="compat-dim-card" data-main={dimension.isMain ? 'true' : undefined} className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-[10px] bg-v3-sapphire-tint">
          <Image src="/images/v2/compat/work/reading-1.svg" alt="" width={27} height={27} className="size-[27px]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {label ? <p className="text-[16px] font-semibold leading-6 text-v3-text-body">{label}</p> : null}
            {tone ? (
              <span data-testid="compat-dim-tone" className="shrink-0 rounded-[100px] px-[7px] py-[3px] text-[14px] font-semibold leading-4" style={{ color: TONE_INK[tone] }}>
                {TONE_TEXT[tone]}
              </span>
            ) : null}
          </div>
          {hasPercent ? (
            <div className="flex items-center gap-2">
              <span className="h-[10px] min-w-0 flex-1 overflow-hidden rounded-[100px] bg-[#EAECEF]">
                <span data-testid="compat-dim-bar" className="block h-full rounded-[100px]" style={{ width: `${pctWidth(dimension.percent)}%`, backgroundColor: color }} />
              </span>
              <span className="shrink-0 text-[14px] font-bold leading-5" style={{ color }}>{dimension.percent}%</span>
              {dimension.grade ? (
                <span data-testid="compat-dim-grade" className="grid w-12 shrink-0 place-items-center rounded-[100px] px-3.5 py-1 text-[16px] font-bold leading-5" style={{ backgroundColor: color, color: TIER_INK[tier] }}>
                  {dimension.grade}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {rating ? (
        <p data-testid="compat-dim-rating" className="whitespace-pre-line rounded-2xl px-3 py-2.5 text-[14px] leading-[22px]" style={{ backgroundColor: TIER_SOFT[tier], color: INK_BODY }}>{rating}</p>
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
