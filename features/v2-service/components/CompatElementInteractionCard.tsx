// features/v2-service/components/CompatElementInteractionCard.tsx — ดวงสมพงศ์ 2E-2 · D45 "ปฏิกิริยาธาตุ".
// Figma 636:18819: element chip (ตัวเรา) — a directional relation — element chip (เขา), then the summaryTh
// prose. Contract CompatElementInteraction { aElementTh, bElementTh, summaryTh, aToB, bToA }. The engine's
// summaryTh is the source of truth for the dynamic; the aToB/bToA labelTh are shown as secondary chips when
// present (I do NOT guess which direction is the "headline" — see the flag in the 2E-2 handoff). Rule 4: no
// element data and no summary → render null.
import type { CompatElementInteraction } from '../compatibility-result'
import { wuxing } from '../compat-result-parts'

function ElementChip({ elementTh, roleLabel }: { elementTh?: string | null; roleLabel: string }) {
  const wx = wuxing(elementTh)
  const th = (elementTh ?? '').trim()
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="grid size-16 place-items-center rounded-2xl text-[26px] font-bold" style={{ backgroundColor: wx.bg, color: wx.fg }}>
        {wx.hanzi || th.charAt(0) || '—'}
      </span>
      <span className="text-[13px] font-bold text-v3-navy">{roleLabel}</span>
      {th ? <span className="text-[12px] text-v3-text-body">ธาตุ{th}</span> : null}
    </div>
  )
}

export function CompatElementInteractionCard({ interaction }: { interaction?: CompatElementInteraction }) {
  const i = interaction
  const summary = (i?.summaryTh ?? '').trim()
  const relLabel = (i?.aToB?.labelTh ?? i?.bToA?.labelTh ?? '').trim()
  const relKind = (i?.aToB?.relation ?? i?.bToA?.relation ?? '').trim()
  const hasElements = !!(i?.aElementTh || i?.bElementTh)
  if (!hasElements && !summary) return null

  return (
    <section data-testid="compat-element-interaction" className="flex flex-col gap-4">
      <p className="text-[16px] font-bold text-v3-navy">ปฏิกิริยาธาตุ</p>
      {hasElements ? (
        <div className="flex items-center justify-between gap-2">
          <ElementChip elementTh={i?.aElementTh} roleLabel="ตัวเรา" />
          <div className="flex flex-1 flex-col items-center gap-0.5 px-1">
            {relLabel ? <span data-testid="compat-element-rel" className="text-center text-[13px] font-semibold text-v3-cyan">{relLabel}</span> : null}
            <svg viewBox="0 0 48 12" className="h-3 w-12 text-v3-sapphire" fill="none" aria-hidden><path d="M0 6h44m0 0-5-4m5 4-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {relKind ? <span className="text-[12px] text-v3-text-muted">{relKind}</span> : null}
          </div>
          <ElementChip elementTh={i?.bElementTh} roleLabel="เขา" />
        </div>
      ) : null}
      {summary ? <p data-testid="compat-element-summary" className="whitespace-pre-line text-[14px] leading-[22px] text-v3-text-body">{summary}</p> : null}
    </section>
  )
}

export default CompatElementInteractionCard
