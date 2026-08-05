// features/v2-service/components/ServiceCardArt.tsx — the artwork layer of a service card.
//
// SUPERSEDES ServiceImageSlot (renamed, git history kept). That component promised "when real art
// arrives, no card is rewritten", and it did keep the build unblocked — but it encoded the wrong
// contract: it assumed Figma's gray 122×90 box WAS the art brief. The art that actually arrived is the
// WHOLE CARD, measured off all 11 delivered files:
//
//   1128×463 = exactly 3.125× the 361×148 card (ratio 2.436 vs 2.439). Figma's box is 1.355 — unrelated.
//   Flat #FBF6FA ground, identical on every file, deviation 0 across the entire copy zone.
//   The mascot bleeds off the top, bottom and right edges and INTO the rounded corners, by design.
//
// The lesson worth keeping: a placeholder's geometry is a guess about the art, never a contract with it.
//
// WHY object-contain AND NOT object-cover. The card is not a fixed 148px — long Thai copy already pushes
// it to 208–292px on main today, before this change. Measured what cover would do at those heights:
//
//   @320 card 288×248 → cover blows the image up to 604px wide → the mascot alone renders 298px, wider
//                       than the whole card, i.e. the art climbs over the copy. Same at 360/393/430.
//
// contain keeps the art's own aspect and pins it to the BOTTOM (where the mascot's feet bleed off); the
// leftover strip above is painted bg-v3-art-canvas — the SAME #FBF6FA sampled out of these files, so
// there is no seam to see. At the design width it is exact: 361 / 2.436 = 148.2.
type ServiceCardArtProps = {
  /** full-card artwork; absent → the card is just its flat ground (never a broken-image icon). */
  src?: string
  /** decorative: the service title is real text right beside it, so the art carries no new meaning and
   *  stays out of the a11y tree. Pass a string only if the art ever becomes the sole label. */
  alt?: string
  /** the first cards paint immediately, the rest defer — 11 full-card PNGs are ~2.9 MB together. */
  eager?: boolean
}

export function ServiceCardArt({ src, alt = '', eager = false }: ServiceCardArtProps) {
  if (!src) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element -- next/image is a no-op here: the project sets
    // images.unoptimized (next.config.mjs), so there is no resize/webp to gain, and flipping that flag is
    // a site-wide + Vercel-quota decision, not this card's. Verified rather than assumed: /_next/image
    // 404s for an existing ASCII asset too, so it is the config, not these Thai filenames.
    <img
      data-testid="service-card-art"
      src={src}
      alt={alt}
      aria-hidden={alt === '' ? true : undefined}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain object-bottom"
    />
  )
}

export default ServiceCardArt
