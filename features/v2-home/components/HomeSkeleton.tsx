// features/v2-home/components/HomeSkeleton.tsx — what /v2 paints on the frame BEFORE it knows anything.
//
// WHY THIS EXISTS (measured, not argued). `pages/v2/index.tsx` holds a hydration fence: `!hasMounted`,
// and `useHasMounted` flips in a `useEffect`, which React runs AFTER the browser paints. So the gate's
// render is not a theoretical intermediate state — it is a frame that reaches the user's eye, every single
// time /v2 mounts, including the soft nav that a tab press actually is. It used to paint
// <AuthLoadingGate/> → <ScreenLoading/> = `fixed inset-0 bg-white` + a spinner, over the whole screen,
// menubar included.
//
// harness/first-frame-v2.ts recorded it off the compositor at ce31e57 (soft nav from /v2/service, 393×852).
// The finding was DIRECTIONAL and it is the only part worth quoting here:
//
//   as shipped                         white frames with no menubar:  > 0
//   with the data gate (line 98) cut   white frames with no menubar:  > 0, fewer
//   with this component at the fence   white frames with no menubar:  0
//
// The raw frame COUNTS that used to sit on these lines are gone on purpose. μุน measured 16 and ตู๋
// measured 9 for the same row, same code, same "backend down" — and the cause is not either machine.
// This gate lasts exactly as long as /api/user takes to resolve-or-fail, /api/user talks to postgres,
// and with postgres down that call is wildly non-deterministic: five consecutive calls on ONE machine
// took 0.43s / 0.01s / 0.41s / 1.57s / 5.49s, and a later run measured 11.9s. A count sampled from that
// is a measurement of a driver's failure timing, not of this component.
//
// So: compare 0 vs >0, WITHIN one run, on one machine. Never quote a frame count across machines or days.
// (This applies to timing-shaped numbers only. The 18px/64px layout-shift figures elsewhere in this PR
// series are a different kind of number — line-count × line-height — and they reproduced exactly on two
// machines. Do not "correct" those the way this one needed correcting.)
//
// The card originally called that residual frame "ไม่ใช่ของที่ผู้ใช้เจอ" and said not to test it. The
// screencast disagreed with the reading, so the fix is the one that keeps BOTH true: the fence stays
// exactly as it is — same condition, same timing, same one frame — and only the PIXELS it paints change.
//
// THE SHAPE IS THE POINT. This is not a bespoke loading screen; it is <V2HomeScreen/> itself with every
// data flag on. That is what makes the transition free: the frame before mount and the frame after mount
// are the SAME React tree, so nothing remounts, no layout is measured twice, and the reveal is data
// filling into boxes that were already the right size in the right place. A hand-drawn skeleton would be a
// second layout to keep in sync, and it would drift the first time someone edits home and not this file.
//
// It must render with NO client-only input (no cookie, no fetch): it is also what the SERVER renders, and
// the first client render has to match it or React throws a hydration mismatch — the very error the fence
// was built to prevent. Hence the empty name (V2HomeScreen draws a grey bar for it) and the fixed props.
import { V2HomeScreen } from './V2HomeScreen'

export function HomeSkeleton() {
  return (
    <V2HomeScreen
      // no cookie read: the server cannot see MEMBER_NAME, so an empty name is the only value that is the
      // same on both sides of hydration. V2HomeScreen renders a grey bar in its place, at the h1's height.
      greeting={{ name: '' }}
      // never painted (loading.mascot hides both mascot slots) — the path only has to be a valid string.
      mascotCharacter="/images/v2/mascot/01.webp"
      onLogout={() => {}}
      fortune={null}
      fortuneLoading
      element={{ elementTh: null, strengthLabel: null }}
      loading={{ profile: true, mascot: true }}
    />
  )
}

export default HomeSkeleton
