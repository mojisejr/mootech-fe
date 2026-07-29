// features/v2-service/components/ServiceCard.tsx — one row in the service catalog. Figma habit-card
// (node 626:4762…): ghost-white surface, rounded-24, p-24; left column = navy-bold title + 1–2 body
// lines + a cyan "ดูดวงเลย →" affordance; right = the 4:3 image slot. The WHOLE card is the link (the
// arrow row is the visual affordance, not the only hit target) so every card is reachable by tap.
import Link from 'next/link'
import type { ServiceCardData } from '../services'
import { ServiceImageSlot } from './ServiceImageSlot'

// Inline arrow (ooui:arrow-next-ltr) — matches the project's "icons live local, no icon-lib" convention
// (see Menubar). 13px to match Figma.
function ArrowNext() {
  return (
    <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

export function ServiceCard({ data }: { data: ServiceCardData }) {
  return (
    <Link
      href={data.href}
      data-testid={`service-card-${data.id}`}
      className="flex w-full items-start justify-end gap-4 rounded-3xl bg-v3-ghost-white p-6 font-ibm transition-colors hover:bg-v3-endeavour-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v3-focus-border"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
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
      <ServiceImageSlot src={data.image} alt={data.title} />
    </Link>
  )
}
