// features/v2-service/components/CompatDimensionCard.tsx — ดวงสมพงศ์ 2E-2 · D22 "รายมิติ" (one dimension).
// Figma 636:18819 (ความเข้ากัน N ด้าน): heart icon · label · optional tone badge · a grade-coloured percent
// bar · a grade pill · the ratingText in a tone-tinted box. Rule 4: every field optional; an absent field
// hides its element, and a dimension with nothing to show renders null.
//
// NOT wired yet (2E-2 builds leaf parts as new files; wiring into CompatibilityResultScreen is deferred until
// 2F+2G merge). `tone` is optional: pass the engine's tone when the contract gains one; otherwise it derives
// from grade (a UI encoding — see compat-result-parts.ts). sising (เสือขาว) rides on the dimension per contract.
import type { CompatDimension } from '../compatibility-result'
import { gradeTier, TIER_COLOR, deriveTone, TONE_TEXT, pctWidth, type DimTone } from '../compat-result-parts'

function HeartIcon() {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-v3-ghost-white">
      <svg viewBox="0 0 24 24" className="size-6" fill="#FF6B4A" aria-hidden>
        <path d="M12 21s-7-4.4-9.3-8.7C1.1 9.1 2.7 6 5.9 6c1.9 0 3.2 1.1 4.1 2.3C10.9 7.1 12.2 6 14.1 6c3.2 0 4.8 3.1 3.2 6.3C19 16.6 12 21 12 21Z" />
      </svg>
    </span>
  )
}

export function CompatDimensionCard({ dimension, tone: toneProp }: { dimension: CompatDimension; tone?: DimTone }) {
  const label = (dimension.label ?? dimension.pairingLabel ?? '').trim()
  const hasPercent = dimension.percent != null
  const rating = (dimension.ratingText ?? '').trim()
  // nothing to show → render nothing (rule 4)
  if (!label && !hasPercent && !rating) return null

  const tier = gradeTier(dimension.grade)
  const color = TIER_COLOR[tier]
  const tone: DimTone = toneProp !== undefined ? toneProp : deriveTone(dimension.grade)
  const sising = dimension.sising

  return (
    <section
      data-testid="compat-dim-card"
      data-main={dimension.isMain ? 'true' : undefined}
      className={`flex flex-col gap-3 rounded-2xl bg-white p-4 ${dimension.isMain ? 'ring-2 ring-v3-sapphire/40' : ''}`}
    >
      <div className="flex items-start gap-3">
        <HeartIcon />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            {label ? <p className="text-[15px] font-bold leading-5 text-v3-navy">{label}</p> : <span />}
            {tone ? (
              <span
                data-testid="compat-dim-tone"
                className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold"
                style={{ backgroundColor: tone === 'strong' ? '#E9F7EF' : '#FDECEA', color: tone === 'strong' ? '#1E8E4E' : '#C0392B' }}
              >
                {TONE_TEXT[tone]}
              </span>
            ) : null}
          </div>
          {hasPercent ? (
            <div className="flex items-center gap-2">
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-v3-ghost-white">
                <span className="block h-full rounded-full" style={{ width: `${pctWidth(dimension.percent)}%`, backgroundColor: color }} />
              </span>
              <span className="shrink-0 text-[13px] font-bold text-v3-text-body" style={{ color }}>{dimension.percent}%</span>
              {dimension.grade ? (
                <span data-testid="compat-dim-grade" className="grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-white" style={{ backgroundColor: color }}>{dimension.grade}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {rating ? (
        <p data-testid="compat-dim-rating" className="whitespace-pre-line rounded-xl px-4 py-3 text-[14px] leading-[22px] text-v3-text-body" style={{ backgroundColor: tone === 'watch' ? '#FDECEA' : '#F4F6F8' }}>{rating}</p>
      ) : null}
      {sising && (sising.nameTh || sising.summary) ? (
        <div data-testid="compat-dim-sising" className="flex items-start gap-2 rounded-xl bg-v3-ghost-white px-3 py-2.5">
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
