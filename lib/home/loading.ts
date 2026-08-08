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
//
// 🔴 MONEY-BUG BOUNDARY (P3): `mascotReady` lets the mascot un-grey INSTANTLY from the in-memory chart cache
// (DoD#1) even while the user row is still in flight — but `profile` (avatar + the upgrade badge) MUST NEVER
// depend on it. avatar/upgrade come from the LIVE user row only; showing a cached "not paid" badge to a user
// who just paid is the money bug (P3 DoD#3). So `profile` is a pure function of (phase, hasUser), full stop —
// scripts/home-loading.test.ts pins that independence (a mutant that leaks `mascotReady` into `profile` → RED).
// `mascotReady` is now LIVE: useV2Home peeks the in-memory chart cache on remount and passes true when a
// cached chart is available, so a tab-switch return un-greys the mascot instantly. It still defaults false,
// so any remaining 2-arg caller behaves exactly as before (mascot = phase==='resolving').
export function deriveHomeLoading(phase: HomePhase, hasUser: boolean, mascotReady = false): HomeLoading {
  return {
    profile: phase === 'resolving' && !hasUser, // ⊥ mascotReady — avatar/upgrade are live-row-only (money bug)
    mascot: phase === 'resolving' && !mascotReady, // cached chart → show instantly, don't wait the fetch (DoD#1)
  }
}
