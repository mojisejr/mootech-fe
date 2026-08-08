// DEV-ONLY tier override for the useV2Tier seam (issue #213). Lets the team view any v2 page as free/paid
// from a URL (`?tier=free` / `?tier=paid`) without touching a real account. This module is JUST the param
// parser — PURE and React-free (sibling of tier.ts, which it must NOT touch: the paid rule lives there and
// stays frozen). The prod-death guard is NOT here on purpose: it lives at the single call site in
// useV2Tier (`if (process.env.NODE_ENV !== 'production')`) so a prod build inlines NODE_ENV, folds the
// condition to false, and dead-code-eliminates this whole call — mirroring pages/v2/home-preview.tsx:35.
// See useV2Tier for the closing-criterion mutant (remove that guard → the production test goes RED).

/**
 * Parse the `tier` URL query value into an override, or null when there is nothing to override.
 * @param rawTier the raw `tier` query value (string | string[] | undefined — Next's router.query shape)
 * @returns true (paid) · false (free) · null (missing, an array, or any junk value — a no-op, never throws)
 */
export function resolveTierOverride(rawTier: string | string[] | undefined): boolean | null {
  if (rawTier === 'paid') return true
  if (rawTier === 'free') return false
  return null // no param, an array, or any junk value → no-op
}
