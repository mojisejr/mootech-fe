import React from 'react'
import Link from 'next/link'

// Shared big-blue habit-card. Figma 333:6889 (Zone 4 โหมดเซียน) === 375:14151 (Zone 6 เรียนปาจื่อ) — the card
// is pixel-identical between the two; only the title lines + CTA variant differ (props). The gradient, both
// mascots, and the CSS book-frame are shared.
//
// ARTWORK (มุน 2026-08-06, ฟีม's ทาง ค): the frame slot now holds a real illustration instead of the CSS
// rectangle, and the two zones stop being twins on purpose:
//   โหมดเซียน   keeps the card's own mascots — the 水 inside the book art is clearly smaller than the card's,
//               so the two still read as foreground and background rather than as a duplicate.
//   เรียนปาจื่อ  drops them (`showMascots={false}`) — its 水 is full-body, centre-frame and almost the same
//               size as the card's, which reads as the same picture pasted twice rather than as a design.
// The tilt is gone with the rectangle. −9.154° gave a blank box a personality; both illustrations arrive
// with their own angle, shadow and edge, so tilting them again reads as dropped-in rather than placed. The
// float (translateY) stays — that is what keeps the card feeling alive.
//
// MOTION (opt-in `animate`, default on): a 3-element idle cohort — loop 2000ms · ease cubic-bezier(.45,0,.55,1):
//   big mascot   scale 1→1.04→1 · y 0→−8→0        (animation wrapper is OUTSIDE the static flip/rotate)
//   small mascot rotate −151.216° ±5° · y 0→−5→0→−3→0   (base flip/rotate baked into the keyframe + class)
//   book-frame   rotate −9.154 → −12.154 → −7.154 → −9.154 (oscillates AROUND −9.154, not 0) · y 0→−4→0
// transform-ONLY (no margin/top → no CLS · ตู๋). Under prefers-reduced-motion every element is at its static
// rest (pixel-identical to the pre-motion card) — the base transforms live on the classes, not only the keyframes.

/** `href` is REQUIRED, and that is the point: this card is rendered by Zone 4 (หนังสือเล่มเดียวในโลก) and
 *  Zone 6 (เรียนปาจื่อ) alike. A destination baked into the card would send both zones to the same place
 *  and nothing would report it — the two CTAs look right either way. Making it a prop means the card
 *  cannot have an opinion about where its owner is going. */
export type HabitCardCta = { variant: 'primary' | 'tertiary'; label: string; href: string }

/** the illustration in the frame slot. `w`/`h` are the painted size — measured per card, not shared. */
export type HabitCardArt = { src: string; w: number; h: number; alt?: string }

export function HabitCard({ title, desc, cta, animate = true, art, showMascots = true, smallMascotAt = { xPct: 62, yPct: -6 } }: {
  title: React.ReactNode
  desc: React.ReactNode
  cta: HabitCardCta
  animate?: boolean
  art?: HabitCardArt
  /** the card's own two mascots. false when the artwork already carries one at the same weight. */
  showMascots?: boolean
  /** where the small mascot sits ON the artwork, as a fraction of the ARTWORK box (0,0 = its top-left).
   *  Anchored to the art rather than to the card — see the note above the slot. */
  smallMascotAt?: { xPct: number; yPct: number }
}) {
  // With no mascots there is nothing overhanging the left edge, so the 40px inset that existed to make room
  // for the big one is just a dent — and that card needs the width for its landscape artwork.
  const pad = showMascots ? 'pl-10 pr-6' : 'px-6'
  return (
    <div
      className={`relative flex w-full items-center gap-6 overflow-hidden rounded-[24px] py-6 ${pad}`}
      style={{ backgroundImage: 'linear-gradient(130.11deg, #B0CFFD 16.95%, #C6EEF2 81.1%)' }}
    >
      {/* big mascot (water-rooster hero) — bottom-left, clipped. left is %-of-card (−55/361), exact @393.
          the hc-big animation wrapper does ONLY scale+y so it composes cleanly with the inner static flip/rotate. */}
      {showMascots && (
      <div className="pointer-events-none absolute bottom-[-42.56px] left-[-15.24%] flex h-[173.79px] w-[149.41px] items-center justify-center">
        <div className={animate ? 'hc-big' : ''}>
          <div className="-scale-y-100 rotate-[171.79deg]">
            <div className="relative h-[157.08px] w-[128.29px] overflow-hidden">
              <img src="/images/v2/zone4/mascot-sian.png" alt="" aria-hidden className="absolute left-[-1.3%] top-[-3.89%] h-[113.07%] w-[100.05%] max-w-none" />
            </div>
          </div>
        </div>
      </div>
      )}
      {/* THE SLOT. The small mascot lives IN HERE, positioned against the artwork's own box.
          It used to be `absolute bottom-[136.58px]` on the CARD — a distance from the card's bottom edge,
          tuned against the 142.46px CSS rectangle that was setting the card's height. Swap the rectangle for
          a shorter illustration and the card shrinks, so 136.58 from the bottom lands somewhere else on the
          picture, or off it entirely (which is exactly what the real route showed: floating clear of the
          card and clipped by it). ตู๋'s warning is the reason this is a structural change and not a new
          number: card-anchored, it drifts again on every future height change, silently. Anchored to the
          artwork, the mascot sits where it was placed no matter what the card does.
          The float is on the art alone so the two keep their independent phases, as they did before. */}
      {/* The slot may SHRINK (no `shrink-0` when there is artwork) and the image keeps its ratio via
          aspect-ratio, so the height follows the width instead of being a second number to keep in sync.
          Measured, not assumed. At a fixed width the ปาจื่อ title broke at 320 (needed 94px, had 82) while
          the BEFORE shots overflow at no width — so that was mine to fix, not a pre-existing crack. The cap
          is a share of the CARD rather than another breakpoint: the artwork gives width back to the copy
          exactly when the screen is narrow, which is when the copy needs it. */}
      <div className={`relative z-[1] min-w-0 ${art ? 'shrink' : 'shrink-0'}`} style={art ? { flexBasis: art.w, width: art.w, maxWidth: '38%' } : undefined}>
        <div className={art ? (animate ? 'hc-float' : '') : (animate ? 'hc-frame' : 'rotate-[-9.15deg]')}>
          {art ? (
            <img
              src={art.src}
              alt={art.alt ?? ''}
              aria-hidden={art.alt ? undefined : true}
              width={art.w}
              height={art.h}
              style={{ width: '100%', aspectRatio: `${art.w} / ${art.h}` }}
              className="h-auto max-w-none"
            />
          ) : (
            <div className="h-[142.46px] w-[97.94px] rounded-md bg-v3-lemon-chiffon shadow-[0_6px_16px_rgba(11,48,91,0.12)]" />
          )}
        </div>
        {showMascots && (
          <div
            className="pointer-events-none absolute z-[2] flex items-center justify-center"
            // SIZED as a share of the artwork too, not in px. ตู๋ measured the old build drifting 20.8
            // percentage points across 393→320 (101.1% → 80.3% of the book's width — at 393 its centre had
            // already left the book). Anchoring alone cut that to 7.6, and the remainder was this: a fixed
            // 54px sprite on artwork that shrinks grows relative to it every step down. Both axes are now
            // shares of the same box, so the mascot sits where it was placed at every width.
            style={{
              left: `${smallMascotAt.xPct}%`,
              top: `${smallMascotAt.yPct}%`,
              width: '48.25%',
              height: '47.72%',
            }}
          >
            <img
              src="/images/v2/zone4/mascot-leaf.png"
              alt=""
              aria-hidden
              className={`h-full w-[79.3%] max-w-none object-contain ${animate ? 'hc-small' : '-scale-y-100 rotate-[-151.22deg]'}`}
            />
          </div>
        )}
      </div>
      {/* text column */}
      <div className="z-[1] flex min-w-px flex-1 flex-col items-start gap-2">
        <div className="text-base font-bold leading-6 text-v3-navy">{title}</div>
        <div className="text-sm font-medium leading-5 text-v3-text-body">{desc}</div>
        {/* was <button>: same classes + inline-block, because an <a> is inline and would lose the button's
            padded box. The pixel diff of both zones is what signs this off, not the class list. */}
        {cta.variant === 'primary' ? (
          <Link href={cta.href} className="inline-block rounded-full bg-v3-sapphire px-6 py-2 text-sm font-semibold uppercase leading-5 text-v3-lime">{cta.label}</Link>
        ) : (
          <Link href={cta.href} className="inline-block rounded-full border border-v3-sapphire px-6 py-2 text-sm font-semibold uppercase leading-5 text-v3-sapphire">{cta.label}</Link>
        )}
      </div>
      {animate && <HabitCardMotion />}
    </div>
  )
}

// The cohort keyframes. Base (static-rest) transforms live on the classes so prefers-reduced-motion → the
// exact static card. Every animated property is a transform (CLS-safe).
function HabitCardMotion() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
    @keyframes hc-big{0%,100%{transform:scale(1) translateY(0)}50%{transform:scale(1.04) translateY(-8px)}}
    /* hc-small: compose order is rotate() THEN scaleY(-1) — matching the merged Tailwind (-scale-y-100
       rotate-[-151.22]) which emits rotate-then-scale. scaleY(-1) rotate() would be the MIRROR image
       (scaleY(-1)·R(θ) = R(-θ)·scaleY(-1)) → wrong orientation. translateY is outermost so the bob is in
       screen space, not the flipped frame. */
    @keyframes hc-small{0%,100%{transform:translateY(0) rotate(-151.216deg) scaleY(-1)}25%{transform:translateY(-5px) rotate(-156.216deg) scaleY(-1)}50%{transform:translateY(0) rotate(-151.216deg) scaleY(-1)}75%{transform:translateY(-3px) rotate(-146.216deg) scaleY(-1)}}
    @keyframes hc-float{0%,100%{transform:translateY(0)}33%{transform:translateY(-4px)}66%{transform:translateY(0)}}
    @keyframes hc-frame{0%,100%{transform:rotate(-9.154deg) translateY(0)}33%{transform:rotate(-12.154deg) translateY(-4px)}66%{transform:rotate(-7.154deg) translateY(0)}}
    .hc-big{animation:hc-big 2s cubic-bezier(.45,0,.55,1) infinite;will-change:transform}
    .hc-small{transform:rotate(-151.216deg) scaleY(-1);animation:hc-small 2s cubic-bezier(.45,0,.55,1) infinite;transform-origin:center;will-change:transform}
    .hc-float{animation:hc-float 2s cubic-bezier(.45,0,.55,1) infinite;will-change:transform}
    .hc-frame{transform:rotate(-9.154deg);animation:hc-frame 2s cubic-bezier(.45,0,.55,1) infinite;transform-origin:center;will-change:transform}
    @media(prefers-reduced-motion:reduce){.hc-big,.hc-small,.hc-frame,.hc-float{animation:none!important}}
  `,
      }}
    />
  )
}
