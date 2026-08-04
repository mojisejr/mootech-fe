// features/v2-shell/hooks/useClientTier.ts — thin re-export of useV2Tier.
//
// This wrapper originally added the SSR mount-gate (μุน, #171): server-rendered pages have no cookie jar,
// so useV2Tier's userId was '' and computeTier answered KNOWN-FREE for everybody, shipping paid members an
// upsell in their SSR markup + a hydration mismatch. The mount-gate now lives INSIDE useV2Tier itself
// (SSR-safe by default — see its header), so goo's seam cannot be re-stepped by a future SSR consumer and
// this wrapper is redundant. Kept as a re-export so existing calendar-page imports keep working; new code
// should import useV2Tier directly.
export { useV2Tier as useClientTier } from '@/features/auth/hooks/useV2Tier'
