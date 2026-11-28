// ปีชง 2570 (revision 0.15): who is reading, so the page offers only what fits them.
// Pure rules, tested without a server; the route is pages/api/taisui/me.ts.
import type { BirthChartInput } from '@/lib/chart/save-birth-chart'
import type { EngineBirth } from './server'

export type TaisuiLevel = 'free' | 'plus' | 'pro'
/** member false = a visitor. level null = a member whose level could not be read: the page then offers nothing. */
export type TaisuiMe =
  | { member: false }
  | { member: true; level: TaisuiLevel | null; provider: 'line' | 'google' | null; lineLinked: boolean | null }

/** The page's level from the app's one membership verdict (lib/v2/subscription resolveSubscription). */
export function levelFrom(m: { isPaid: boolean | null; tier: string | null } | null): TaisuiLevel | null {
  if (!m || m.isPaid === null) return null
  if (m.isPaid === false) return 'free'
  if (m.tier === 'PRO') return 'pro'
  if (m.tier === 'PLUS') return 'plus'
  return null
}

export function providerFrom(raw: unknown): 'line' | 'google' | null {
  const p = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return p === 'line' || p === 'google' ? p : null
}

/** The page's birth as the register form's write (POST /api/v2/birth-chart takes the same fields).
 *  Only birth fields: name and the rest of the profile are left as they are. */
export function chartInputFrom(b: EngineBirth): BirthChartInput {
  return { dob: b.birthDate, time: b.birthTime ?? '', gender: b.gender === 'female' ? 'FEMALE' : 'MALE' }
}
