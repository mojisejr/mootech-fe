import { useMemo } from 'react'
import {
  resolveMascotFromCompute,
  resolveMascot,
  type ComputeMascotSource,
  type MascotResult,
} from '@/lib/personalization/mascot'

// Thin memoized wrappers over the PURE resolver so screens (result / home / profile) get a stable
// MascotResult reference. All the logic lives in mascot.ts; these hooks add only React memoization.
// Returns null when either axis is missing (e.g. best-effort enrichment came back null) — the
// caller decides the fallback (static hero mascot, skeleton, etc.).

// Given the /api/calculator/compute `data` payload, resolve the mascot paths + labels.
export function useMascotFromCompute(data: ComputeMascotSource | null | undefined): MascotResult | null {
  return useMemo(() => resolveMascotFromCompute(data), [data])
}

// Given the two raw axes directly (any accepted shape — see resolveMascot), resolve the mascot.
export function useMascot(
  yearAnimal: string | number | null | undefined,
  dayMasterElement: string | null | undefined,
): MascotResult | null {
  return useMemo(() => resolveMascot(yearAnimal, dayMasterElement), [yearAnimal, dayMasterElement])
}
