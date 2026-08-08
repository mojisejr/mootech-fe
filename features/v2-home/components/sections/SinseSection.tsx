import React from 'react'
import Link from 'next/link'
import { comingSoonHrefById } from '@/features/v2-service/services'

// ── Zone 5 — ทักซินแส / section-mascot (Figma 333:6989) ───────────────────────────────────────────────
// A FULL-BLEED sapphire banner (393-wide in Figma, so it breaks out of the page's px-4 with -mx-4): a left text
// block (title · 2-line desc · lime Secondary CTA), the big water-owl mascot overflowing bottom/right (STATIC —
// reuses zone4/mascot-sian.png, image-verified as the same source as Zone 4's mascot), a small fire sprite that
// is the ONLY animated element (loop 2000ms · same cadence as the rest of the home motion), and a cream
// white-mound wave at the bottom that transitions the sapphire into the cream page. Replaces the text-only
// SinseCard placeholder.
export function SinseSection() {
  return (
    <section className="relative -mx-4 mb-6 w-[calc(100%+2rem)] overflow-hidden rounded-[24px] bg-v3-sapphire">
      <div className="relative h-[196px]">
        {/* text block — Figma frame at (24,40), 217 wide */}
        <div className="absolute left-6 top-10 z-10 flex w-[217px] flex-col gap-2">
          <p className="text-base font-bold leading-6 text-white">ดูดวงส่วนตัว กับซินแส</p>
          <p className="text-sm font-medium leading-5 text-white/90">
            วิเคราะห์ดวงชะตาเชิงลึก
            <br />
            รวบรวมเป็นหนังสือส่วนตัว
          </p>
          {/* A10/A12: <button> → <Link> (inline-block keeps the 148px box an <a> would otherwise drop), and
              the spelling follows ฟีม's 2026-07-29 ruling — ซินแส (สระแอ), which is what the catalog and the
              ~30 other places in the repo already say. This button is about to hand the user to a service
              whose card is spelled the other way; two spellings across one tap is the reason it matters. */}
          <Link
            href={comingSoonHrefById('sinsae')}
            className="mt-1 inline-block w-[148px] rounded-full bg-v3-lime px-6 py-2 text-center text-sm font-semibold uppercase leading-5 text-v3-sapphire"
          >
            ทักซินแสเพื่อจอง
          </Link>
        </div>

        {/* big mascot (water-owl) — Figma 239×278 at (208.9,−23.2): overflows top + right, clipped by the card.
            reuse zone4/mascot-sian.png; the 239×278 box is object-cover (native is taller), so a fixed-width img
            in an overflow-clip wrapper reproduces the crop. STATIC (pointer-events-none, aria-hidden). */}
        <div className="pointer-events-none absolute left-[208.9px] top-[-23.2px] z-[1] h-[278px] w-[239px] overflow-hidden">
          <img src="/images/v2/zone4/mascot-sian.png" alt="" aria-hidden className="absolute left-1/2 top-1/2 w-[239px] max-w-none -translate-x-1/2 -translate-y-1/2" />
        </div>

        {/* fire sprite — Figma 49×58 at (181,19.9): the ONLY animated element (flicker loop 2000ms) */}
        <img
          src="/images/v2/zone5/sprite-fire.png"
          alt=""
          aria-hidden
          className="z5-fire pointer-events-none absolute left-[181px] top-[19.9px] z-[2] h-[58px] w-[49px] max-w-none"
        />

        {/* white-mound wave — Figma "Frame 7" at the card bottom, full-bleed cream, transitions sapphire → page */}
        <div aria-hidden className="absolute inset-x-0 bottom-[-1px] z-[1] h-7 text-v3-bg-cream">
          <svg viewBox="0 0 451 27" preserveAspectRatio="none" className="h-full w-full" fill="currentColor">
            <path d="M0 27 V10 Q112 -6 225 8 T451 10 V27 Z" />
          </svg>
        </div>
      </div>

      {/* fire-sprite flicker — transform-only (scale/rotate/y), CLS-safe. base on the class so reduced-motion
          rests at the static pose (Figma orientation), animation:none under reduce (the #128 lesson). */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
    @keyframes z5-fire{0%,100%{transform:rotate(0deg) scale(1) translateY(0)}25%{transform:rotate(-4deg) scale(1.06,.96) translateY(-2px)}50%{transform:rotate(0deg) scale(.97,1.05) translateY(1px)}75%{transform:rotate(4deg) scale(1.04,.98) translateY(-1px)}}
    .z5-fire{animation:z5-fire 2s cubic-bezier(.45,0,.55,1) infinite;transform-origin:bottom center;will-change:transform}
    @media(prefers-reduced-motion:reduce){.z5-fire{animation:none!important}}
  `,
        }}
      />
    </section>
  )
}
