import React from 'react'

// Shared big-blue habit-card. Figma 333:6889 (Zone 4 โหมดเซียน) === 375:14151 (Zone 6 เรียนปาจื่อ) — the card
// is pixel-identical between the two; only the title lines + CTA variant differ (props). The gradient, both
// mascots, and the CSS book-frame are shared.
//
// MOTION (opt-in `animate`, default on): a 3-element idle cohort — loop 2000ms · ease cubic-bezier(.45,0,.55,1):
//   big mascot   scale 1→1.04→1 · y 0→−8→0        (animation wrapper is OUTSIDE the static flip/rotate)
//   small mascot rotate −151.216° ±5° · y 0→−5→0→−3→0   (base flip/rotate baked into the keyframe + class)
//   book-frame   rotate −9.154 → −12.154 → −7.154 → −9.154 (oscillates AROUND −9.154, not 0) · y 0→−4→0
// transform-ONLY (no margin/top → no CLS · ตู๋). Under prefers-reduced-motion every element is at its static
// rest (pixel-identical to the pre-motion card) — the base transforms live on the classes, not only the keyframes.

export type HabitCardCta = { variant: 'primary' | 'tertiary'; label: string }

export function HabitCard({ title, desc, cta, animate = true }: {
  title: React.ReactNode
  desc: React.ReactNode
  cta: HabitCardCta
  animate?: boolean
}) {
  return (
    <div
      className="relative flex w-full items-center gap-6 overflow-hidden rounded-[24px] py-6 pl-10 pr-6"
      style={{ backgroundImage: 'linear-gradient(130.11deg, #B0CFFD 16.95%, #C6EEF2 81.1%)' }}
    >
      {/* big mascot (water-rooster hero) — bottom-left, clipped. left is %-of-card (−55/361), exact @393.
          the hc-big animation wrapper does ONLY scale+y so it composes cleanly with the inner static flip/rotate. */}
      <div className="pointer-events-none absolute bottom-[-42.56px] left-[-15.24%] flex h-[173.79px] w-[149.41px] items-center justify-center">
        <div className={animate ? 'hc-big' : ''}>
          <div className="-scale-y-100 rotate-[171.79deg]">
            <div className="relative h-[157.08px] w-[128.29px] overflow-hidden">
              <img src="/images/v2/zone4/mascot-sian.png" alt="" aria-hidden className="absolute left-[-1.3%] top-[-3.89%] h-[113.07%] w-[100.05%] max-w-none" />
            </div>
          </div>
        </div>
      </div>
      {/* small mascot (wood/leaf sprite) — top, over the book. base flip/rotate + oscillation both on hc-small. */}
      <div className="pointer-events-none absolute bottom-[136.58px] left-[34.07%] z-[2] flex h-[57.65px] w-[54.04px] items-center justify-center">
        <img
          src="/images/v2/zone4/mascot-leaf.png"
          alt=""
          aria-hidden
          className={`h-[45.69px] w-[36.55px] max-w-none object-cover ${animate ? 'hc-small' : '-scale-y-100 rotate-[-151.22deg]'}`}
        />
      </div>
      {/* Group 5 — white book cover (CSS shape, not an image), tilt + shadow. rotate oscillates around −9.154. */}
      <div className={`z-[1] shrink-0 ${animate ? 'hc-frame' : 'rotate-[-9.15deg]'}`}>
        <div className="h-[142.46px] w-[97.94px] rounded-md bg-v3-lemon-chiffon shadow-[0_6px_16px_rgba(11,48,91,0.12)]" />
      </div>
      {/* text column */}
      <div className="z-[1] flex min-w-px flex-1 flex-col items-start gap-2">
        <div className="text-base font-bold leading-6 text-v3-navy">{title}</div>
        <div className="text-sm font-medium leading-5 text-v3-text-body">{desc}</div>
        {cta.variant === 'primary' ? (
          <button type="button" className="rounded-full bg-v3-sapphire px-6 py-2 text-sm font-semibold uppercase leading-5 text-v3-lime">{cta.label}</button>
        ) : (
          <button type="button" className="rounded-full border border-v3-sapphire px-6 py-2 text-sm font-semibold uppercase leading-5 text-v3-sapphire">{cta.label}</button>
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
    @keyframes hc-frame{0%,100%{transform:rotate(-9.154deg) translateY(0)}33%{transform:rotate(-12.154deg) translateY(-4px)}66%{transform:rotate(-7.154deg) translateY(0)}}
    .hc-big{animation:hc-big 2s cubic-bezier(.45,0,.55,1) infinite;will-change:transform}
    .hc-small{transform:rotate(-151.216deg) scaleY(-1);animation:hc-small 2s cubic-bezier(.45,0,.55,1) infinite;transform-origin:center;will-change:transform}
    .hc-frame{transform:rotate(-9.154deg);animation:hc-frame 2s cubic-bezier(.45,0,.55,1) infinite;transform-origin:center;will-change:transform}
    @media(prefers-reduced-motion:reduce){.hc-big,.hc-small,.hc-frame{animation:none!important}}
  `,
      }}
    />
  )
}
