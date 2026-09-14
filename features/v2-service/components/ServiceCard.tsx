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

// Inline arrow — the EXACT Figma export of ooui:arrow-next-ltr (626:5840): 13px box, 11.05×8.54 leaf centred,
// painted with currentColor (Figma fill #1B9AAF = the cyan the label already carries). Local, no icon-lib.
function ArrowNext() {
  return (
    <svg aria-hidden="true" width="13" height="13" viewBox="0 0 13 13" fill="currentColor" className="shrink-0">
      <path transform="translate(0.975 2.23)" d="M11.05 3.81095V4.71575L7.3528 8.5397L6.4194 7.6362L9.0545 4.91335H0V3.61335H9.04995L6.4194 0.9061L7.3515 0L11.05 3.81095Z" />
    </svg>
  )
}

export function ServiceCard({ data, eagerArt = false }: { data: ServiceCardData; eagerArt?: boolean }) {
  // min-h, not h: Thai copy that needs another line grows the card instead of being clipped (ฟีม
  // 2026-08-05). No shadow: Figma 626:4763 draws the card flat on the WHITE hub ground.
  const className = "relative flex min-h-[148px] w-full overflow-hidden rounded-3xl bg-v3-art-canvas p-6 font-ibm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v3-focus-border"
  const inner = (
    <>
      <ServiceCardArt src={data.image} eager={eagerArt} />
      {/* copy column: กว้าง 68% — อาร์ตมาสคอตชิดขวา เว้นซ้ายให้ desc 2 บรรทัดพอดี */}
      <div className="relative z-10 flex w-[68%] flex-col gap-2 pr-1">
        <h3 className="text-[16px] font-bold leading-6 text-v3-navy [word-break:break-word]">{data.title}</h3>
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
    </>
  )
  // #3 (ซินแสนุ้ย 2026-09-14): การ์ด "ร้านค้าของเรา" ลิงก์ออก LINE shop → เปิดแท็บใหม่ (<a> ไม่ใช่ <Link>)
  return data.external ? (
    <a href={data.href} target="_blank" rel="noopener noreferrer" data-testid={`service-card-${data.id}`} className={className}>
      {inner}
    </a>
  ) : (
    <Link href={data.href} data-testid={`service-card-${data.id}`} className={className}>
      {inner}
    </Link>
  )
}
