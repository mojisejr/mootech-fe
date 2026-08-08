// Pure (React-free) home per-zone loading derivation so the "grey block until this zone's own data lands"
// rule is unit-testable and anchorable — same reason deriveHomeProfile lives in a pure module. useV2Home
// derives this from its resolve phase + whether the user row has arrived, and hands `loading` to Lamun's
// screen so each zone draws a GREY BLOCK (❌ NOT the 01.webp mascot fallback) until its own data is in —
// ฟีม chose one clean reveal, not a fallback-then-swap flicker.
export type HomePhase = 'resolving' | 'home' | 'redirecting'
export type HomeLoading = { profile: boolean; mascot: boolean }

// Two zones, two sources, resolved at DIFFERENT times (progressive reveal):
//   profile (avatar + upgrade badge) ← UserGetById. Un-greys the moment that row lands, even while the
//     mascot chart is still in flight — that is the whole reason the two flags are split, not one.
//   mascot (+ ธาตุ) ← ChineseHoroscopeGet, which only resolves as the phase settles to 'home'.
// On an API error the hook settles to 'home' with no user / no compute → BOTH flags false → the safe
// fallbacks show (letter avatar / 01.webp), never an infinite grey block. During 'redirecting' the screen
// is not rendered at all (the caller holds the frame), so the flags there are moot.
export function deriveHomeLoading(phase: HomePhase, hasUser: boolean): HomeLoading {
  return {
    profile: phase === 'resolving' && !hasUser,
    mascot: phase === 'resolving',
  }
}
