// features/v2-shell/components/MateAIButton.tsx — the Mate AI button in the bottom menu (Figma 461:3303 → Navbar 461:3020).
//
// Rebuilt 2026-08-03 from `get_design_context` + `get_motion_context` ON THE NODE, not from a screenshot —
// ฟีม: "ที่เราต้องมานั่งปรับกันอยู่นี่ บางส่วนเกิดจากคุณ implement ไม่ตรงกับ design". Everything below is a
// value the node returned; nothing here is eyeballed.
//
// ฟีม's report was "คำว่า Mate AI ทำให้ BG ทะลุกรอบออกมา", and the node says exactly why:
//   Figma Navbar : w 74.028 · h 70 · r16 · border 5px rgba(216,143,169,.4) · backdrop-blur 6.8px · OVERFLOW-CLIP
//                  (`bg-clip-padding` matters: the stroke is 40% pink and CSS paints the background under the
//                   border by default, so lime-under-pink composites to OLIVE. Figma's stroke sits outside the
//                   fill and reads pale pink — clipping the background to the padding box reproduces that.)
//   was (ours)   : border 4px #EDCCD7 (opaque, wrong) · OVERFLOW-VISIBLE · label at -top-1 carrying its own lime slab
// The tile is a CLIP in the design and was a passthrough here — the structure itself permitted the escape. It is
// `overflow-hidden` now, which retires the whole bug-class (label, mascot, and the float) instead of nudging this
// one instance until it looks right.
//
// The label's lime slab is deliberately GONE. Figma does have one (bg #E1FF00, rounded-t-18, px-24) but its frame
// is 102 wide starting at x=-14 inside a 74-wide tile that clips — so it is lime-on-lime, clipped, and renders as
// literally nothing. Re-creating it would only re-create the escape hatch.
//
// COLOURS — the gradient was wrong in the shipped build, and the right tokens already existed:
//   Figma : #1455A4 → #E913C5  = v3-sapphire → v3-mate-magenta
//   was   : #294DA7 → #D036A9  (hand-typed, matched no token)
//
// MASCOT — Figma is 75.139×92 at (1, 9) in the 70-tall tile ⇒ 31px is cut off. ฟีม asked for smaller, so it is
// 56 wide (the asset is 202×240, so `contain` renders it 56×66.5 with no letterbox worth speaking of) at top 12
// of the 60px content box ⇒ 19px still cut. The float lifts it 7px and scale 1.03 grows it ~1px, so ~9px of
// overhang always remains — the bottom edge cannot appear mid-animation. Measured, not eyeballed: the anchor
// re-reads the overhang at four phases of the cycle.
//   NOTE the old 75px box was WIDER than the 66px content box it lived in, so ~9px of the character was cropped
//   off each side. 56 is a smaller DRAWING that is no longer cropped — expect it to read as "more mascot, drawn
//   smaller", which is the intent (ฟีม: เล็กลงหน่อย · เห็นแค่ส่วนนึงก็พอ).
// `overflow-hidden` is the second line of defence here, not the first.
//
// MOTION — not invented. `get_motion_context` on this node returns y[0,-7,0] · scale[1,1.03,1] · rotate[0,-2,2,0]
// · 2s · cubic-bezier(.45,0,.55,1) · infinite — the SAME track as the ดวงสมพงศ์ sprites (#160), so it is the one
// shared `.v3-float` in globals.css, which also honours prefers-reduced-motion.
import Image from 'next/image'
import Link from 'next/link'

export function MateAIButton() {
  return (
    <Link
      href="/v2/chat"
      aria-label="Mate AI"
      data-testid="nav-mate-ai"
      className="relative flex h-[70px] w-[74px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border-[5px] border-[rgba(216,143,169,0.4)] bg-v3-lime bg-clip-padding backdrop-blur-[6.8px]"
    >
      {/* mascot — head-aligned; the bottom overhangs the tile and is clipped by it (Figma's own behaviour) */}
      <span aria-hidden data-testid="nav-mate-ai-mascot" className="pointer-events-none absolute left-1/2 top-[12px] h-[67px] w-[56px] -translate-x-1/2">
        <span className="v3-float absolute inset-0 block">
          <Image src="/images/v2/mascot/01-nav.png" alt="" fill sizes="64px" style={{ objectFit: 'contain', objectPosition: 'top' }} />
        </span>
      </span>
      {/* label — INSIDE the tile (Figma y=3), above the mascot head. No slab: see the note above. */}
      <span data-testid="nav-mate-ai-label" className="absolute left-1/2 top-0 z-[1] -translate-x-1/2 whitespace-nowrap text-sm font-black leading-5">
        <span className="bg-gradient-to-r from-v3-sapphire to-v3-mate-magenta bg-clip-text text-transparent">Mate AI</span>
      </span>
    </Link>
  )
}

export default MateAIButton
