// features/v2-service/components/CompatMascotCard.tsx — ดวงสมพงศ์ 2E-2 · D46 มาสคอต (one person's mascot).
// The hook (useCompatibilityResult) resolves mascotA/mascotB by day-ganzhi. Contract CompatMascot
// { ganzhi, nameTh, nameEn, imageUrl }. Rule 4: null/undefined mascot (no ganzhi, or a 404) → render NULL
// (the card is hidden, not an empty box); a missing imageUrl → initial-letter fallback, never a fake image.
import Image from 'next/image'
import type { CompatMascot } from '../compatibility-result'

export function CompatMascotCard({ mascot, roleLabel }: { mascot?: CompatMascot | null; roleLabel: string }) {
  if (!mascot) return null // hide the card entirely — no fabricated mascot
  const nameTh = (mascot.nameTh ?? '').trim()
  const nameEn = (mascot.nameEn ?? '').trim()
  const img = (mascot.imageUrl ?? '').trim()
  return (
    <section data-testid="compat-mascot-card" className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4 text-center">
      <span className="relative grid size-20 place-items-center overflow-hidden rounded-full bg-v3-ghost-white">
        {img ? <Image src={img} alt={nameTh || roleLabel} fill sizes="80px" style={{ objectFit: 'cover' }} /> : <span className="text-2xl font-bold text-v3-sapphire">{(nameTh || roleLabel).charAt(0) || '?'}</span>}
      </span>
      <span className="text-[12px] font-medium text-v3-text-muted">{roleLabel}</span>
      {nameTh ? <span className="text-[15px] font-bold text-v3-navy">{nameTh}</span> : null}
      {nameEn ? <span className="text-[12px] text-v3-text-body">{nameEn}</span> : null}
    </section>
  )
}

export default CompatMascotCard
