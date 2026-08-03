// features/v2-shell/components/MateAIButton.tsx — the Mate AI button in the bottom menu (Figma 461:3224).
//
// EXTRACTED 2026-08-03 (ฟีม: "Mate AI ทุกหน้า") from CalendarMenu so BOTH bottom navs render the SAME button
// instead of one having it and the other not — and so its colours live in exactly one place. Extracting rather
// than copying is deliberate: the root problem here is two divergent navs, and pasting a second copy of this
// button would deepen it.
//
// COLOURS — sampled from the node, and they were INVERTED in the shipped version (ฟีม spotted it):
//   Figma : button fill = LIME #E1FF00 · "Mate AI" label = a blue→magenta GRADIENT (#294DA7 → #D036A9)
//   was   : button fill = a teal→purple gradient · label = sapphire text on a lime chip
// Border #EDCCD7 (pink). The label sits ON TOP of the mascot head (z-2) and pokes above the button, so the
// button keeps overflow-visible while the MASCOT ONLY is clipped to the rounded bounds (its bottom 31px is cut,
// matching Figma's 75×92 mascot at y=9 inside a 70-tall frame).
import Image from 'next/image'
import Link from 'next/link'

export function MateAIButton() {
  return (
    <Link
      href="/v2/service"
      aria-label="Mate AI"
      data-testid="nav-mate-ai"
      className="relative flex h-[70px] w-[74px] shrink-0 items-center justify-center overflow-visible rounded-2xl border-4 border-[#EDCCD7] bg-v3-lime backdrop-blur"
    >
      {/* label: gradient text (bg-clip-text) — 1 line, allowed to overflow the 74px button like Figma's 102px frame */}
      <span className="absolute -top-1 left-1/2 z-[2] -translate-x-1/2 whitespace-nowrap rounded-t-[18px] bg-v3-lime px-4 text-sm font-black leading-5">
        <span className="bg-gradient-to-r from-[#294DA7] to-[#D036A9] bg-clip-text text-transparent">Mate AI</span>
      </span>
      {/* clip container = the button's own rounded bounds; mascot is head-aligned so the bottom clips */}
      <span className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[10px]">
        <span className="absolute left-1/2 top-[9px] h-[92px] w-[75px] -translate-x-1/2">
          <Image src="/images/v2/mascot/01-nav.png" alt="" fill sizes="75px" style={{ objectFit: 'contain', objectPosition: 'top' }} />
        </span>
      </span>
    </Link>
  )
}

export default MateAIButton
