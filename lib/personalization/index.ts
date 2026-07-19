// Personalization layer — element+zodiac mascot resolver (DESIGN.md §7, decision C).
// Import from '@/lib/personalization' across screens.
export {
  ZODIAC_TABLE,
  ZODIAC_ORDER,
  toNakkasat,
  zodiacOrder,
  normalizeElement,
  type ZodiacOrder,
  type ZodiacEntry,
  type NormalizedElement,
} from '@/lib/personalization/zodiac'

export {
  buildMascotPaths,
  resolveMascot,
  resolveMascotFromCompute,
  animalFromCompute,
  elementFromCompute,
  type MascotPaths,
  type MascotResult,
  type ComputeMascotSource,
} from '@/lib/personalization/mascot'

export { useMascot, useMascotFromCompute } from '@/lib/personalization/use-mascot'
