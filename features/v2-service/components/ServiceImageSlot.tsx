// features/v2-service/components/ServiceImageSlot.tsx — the 4:3 image box on each service card.
//
// done-condition #4 (ฟีม's most-important): this is a SLOT that accepts `src`, NOT a dead gray div.
// The team will drop real art in later; when they do, NO card is rewritten — a src flows straight
// through to a painted <img>. Geometry (122×90 = 4:3, rounded-8) is fixed per Figma either way, so the
// layout never shifts between the placeholder and the real image (CLS budget = 0 at swap time).
//
//   <ServiceImageSlot />              → gray #9CA3AF placeholder (today, all 12)
//   <ServiceImageSlot src="/x.png" /> → the image, object-cover inside the same box (image-time)

type ServiceImageSlotProps = {
  /** image source; when absent the box paints the gray placeholder. */
  src?: string
  /** alt text — the service name, so a real image is still labelled. */
  alt?: string
}

export function ServiceImageSlot({ src, alt = '' }: ServiceImageSlotProps) {
  return (
    <div
      data-testid="service-image-slot"
      className="h-[90px] w-[122px] shrink-0 overflow-hidden rounded-lg bg-v3-placeholder"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- generic slot: src arrives from S3/BE at
        // image-time with no known host, so next/image's domain allow-list can't cover it; a plain <img>
        // constrained to the fixed box is the correct primitive here.
        <img data-testid="service-image" src={src} alt={alt} className="h-full w-full object-cover" />
      ) : null}
    </div>
  )
}
