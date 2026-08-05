// features/v2-service/components/ServiceCard.tsx — one row in the service catalog. The delivered art is
// the WHOLE card (see ServiceCardArt), so the card is now: flat art-canvas ground → artwork layer →
// copy on top. The WHOLE card is the link (the arrow row is the visual affordance, not the only hit
// target) so every card is reachable by tap.
//
// THE GUTTER IS A PERCENTAGE, NOT A PIXEL COUNT. Measured where the art's leftmost pixel lands on each
// of the 11 files: 50.7% – 56.6% of card width. The tightest is 05_เสี่ยงไพ่จิตวิญญาณแดนสวรรค์ at
// 50.7% — which is also the longest title, so the worst copy and the worst art meet on the same card.
//
// Writing that floor down as "183px" is the exact bug that broke the Mate AI button (#166) and the
// upsell mascots (#174): a Figma coordinate treated as a layout rule holds at 393 and shears at 320. As
// a percentage it is correct at every width by construction — w-[47%] of the padded box leaves a real
// 9–14px gap to the art at 320/360/393/430, where a flat 50% would leave about 2px.
import Link from 'next/link'
import type { ServiceCardData } from '../services'
import { ServiceCardArt } from './ServiceCardArt'

// Inline arrow (ooui:arrow-next-ltr) — matches the project's "icons live local, no icon-lib" convention
// (see Menubar). 13px to match Figma.
function ArrowNext() {
  return (
    <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

export function ServiceCard({ data, eagerArt = false }: { data: ServiceCardData; eagerArt?: boolean }) {
  return (
    <Link
      href={data.href}
      data-testid={`service-card-${data.id}`}
      // min-h, not h: Thai copy that needs another line grows the card instead of being clipped (ฟีม
      // 2026-08-05). shadow-card-soft is the sanctioned card elevation, and it is load-bearing here —
      // the art ground #FBF6FA sits only 6/255 from the page cream #FAF7F4, so without a shadow the card
      // has no edge left to see (the old #ECF0FD surface was 14/255 away and could stand on its own).
      className="relative flex min-h-[148px] w-full overflow-hidden rounded-3xl bg-v3-art-canvas p-6 font-ibm shadow-card-soft transition-shadow hover:shadow-custom focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v3-focus-border"
    >
      <ServiceCardArt src={data.image} eager={eagerArt} />

      <div className="relative z-10 flex w-[47%] flex-col gap-2">
        <h3 className="text-[18px] font-bold leading-6 text-v3-navy [word-break:break-word]">{data.title}</h3>
        <div className="text-[14px] font-medium leading-5 text-v3-text-body [word-break:break-word]">
          {data.desc.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        <span className="flex items-center gap-1 text-[14px] font-medium leading-5 text-v3-cyan">
          ดูดวงเลย
          <ArrowNext />
        </span>
      </div>
    </Link>
  )
}
