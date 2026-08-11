// MuMate v2 entry (Slice 1). TWO gates stack here:
//   1. TEAM preview gate (v2_access) — SSR (getServerSideProps): no cookie → render the passkey
//      form; the whole /v2 surface is team-only.
//   2. APP identity — CLIENT via useV2AuthGate (mount-safe, cookie-truth, login-loop invariant):
//      anon → onboarding carousel, loading/pre-mount → wait (splash), authed → home.
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { isV2Authenticated } from '@/lib/v2/gate'
import { useV2AuthGate } from '@/features/auth/hooks/useV2AuthGate'
import type { AuthStatus } from '@/lib/auth/resolve-auth'
import { useV2Home } from '@/features/auth/hooks/useV2Home'
import { useV2Logout } from '@/features/auth/hooks/useV2Logout'
import { useHomeFortune } from '@/features/home/hooks/useHomeFortune'
import { useMascotFromCompute } from '@/lib/personalization/use-mascot'
import { resolveGreetingElementTh } from '@/lib/personalization/compute-source'
import { AuthLoadingGate } from '@/features/v2-shell/components/AuthLoadingGate'
import { HomeSkeleton } from '@/features/v2-home/components/HomeSkeleton'
import { V2GateForm } from '@/features/v2-shell/components/V2GateForm'
import { OnboardingCarousel } from '@/features/onboarding/components/OnboardingCarousel'
import { V2HomeScreen } from '@/features/v2-home/components/V2HomeScreen'
// 🔴 TEMPORARY (#249) — #248 removes this import and its one <TeamPreviewResetBadge /> below.
import { TeamPreviewResetBadge } from '@/features/v2-team-preview/TeamPreviewResetBadge'

type Props =
  | { teamAuthed: false; gateError: string | null }
  | { teamAuthed: true }

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  if (!isV2Authenticated(ctx.req)) {
    const gateError = typeof ctx.query.gate_error === 'string' ? ctx.query.gate_error : null
    return { props: { teamAuthed: false, gateError } }
  }
  return { props: { teamAuthed: true } }
}

function V2Entry() {
  const router = useRouter()
  const { status, showLoading } = useV2AuthGate()

  // Pre-mount hydration fence (useHasMounted → useEffect → setState after paint, so this frame ALWAYS
  // reaches the user at least once — μุน measured it). Gate LOGIC unchanged (บอง 🔒 — do not touch
  // useHasMounted / no useLayoutEffect); only WHAT it renders changes: HomeSkeleton (menu+header+grey
  // zones) instead of the white AuthLoadingGate → that last frame is no longer blank (P1: 0 white frames).
  if (showLoading) return <HomeSkeleton />

  if (status === 'anon') {
    return <OnboardingCarousel onComplete={() => router.push('/v2/login')} />
  }

  // status === 'authed' → hand off to the home router (returning→home / no-chart→register, gap C).
  // Pass status down: useV2AuthGate is imported directly HERE (in pages/v2) per the discovery ban;
  // useV2Home takes status, it must not wrap useV2AuthGate itself.
  return <V2HomeRoute status={status} />
}

// Authed home: goo's useV2Home does the gap-C routing (has-chart→home / no-chart→/v2/register,
// loop-safe) + yields greeting + compute-source; useV2Logout gives the logout action Lamun's confirm
// modal calls; useMascotFromCompute → character path (null → 01.webp fallback). Lamun's V2HomeScreen is
// presentational (props only). All hooks are called unconditionally before the loading branch.
function V2HomeRoute({ status }: { status: AuthStatus }) {
  // useV2Home is the SINGLE owner of the /api/user fetch (#165): it yields the routing/greeting/compute
  // AND the header `profile` + the fetched `user` row, so useHomeFortune reuses that row instead of firing
  // a second UserGetById.
  const { redirecting, greeting, computeSource, profile, user, loading } = useV2Home(status)
  const { logout } = useV2Logout()
  const mascot = useMascotFromCompute(computeSource)
  const mascotCharacter = mascot?.character ?? '/images/v2/mascot/01.webp'
  // Zone 1 — daily-fortune + persona data seam. Called unconditionally (before the loading branch) so
  // hook order is stable; graceful by design (no user / bazi error → fortune/persona=null → cards show
  // fallback). Consumes the shared `user` (no second fetch). ONE BFF call returns both fortune and persona.
  // Pass the user-loading signal (loading.profile = user row in flight) so the fortune card holds its
  // skeleton while the row is still coming instead of flashing "no fortune today" (μุน's catch). This is
  // the SOURCE fix — the hook now reports loading honestly on its own, so the screen no longer has to
  // compose `fortuneLoading || loading.profile` as a belt.
  const { fortune, persona, loading: fortuneLoading } = useHomeFortune(user, loading.profile)

  // Split-brain guard (too's wire review): the ธาตุ TEXT binds the MASCOT's element (compute, for
  // visual consistency with the character), while the strength band comes from bazi's persona — two
  // different compute engines. If bazi's persona.elementTh disagrees with the mascot's, the band would
  // describe a DIFFERENT element than the text/character shows. We keep the UI consistent with the
  // mascot (never mislabel the character), but surface the divergence in dev so a compute mismatch is
  // caught rather than silently shipped. persona.elementTh is forwarded precisely to enable this check.
  if (
    process.env.NODE_ENV !== 'production' &&
    mascot?.elementTh &&
    persona?.elementTh &&
    mascot.elementTh !== persona.elementTh
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      `[home ธาตุ] element split-brain: mascot=${mascot.elementTh} (mootech-be) vs persona=${persona.elementTh} (bazi) — the "${persona.strengthLabel}" band was computed for the persona element, not the one shown`,
    )
  }

  // Gate ONLY on an active redirect (no-chart user → /v2/register): render nothing home-shaped while that
  // route change is in flight so home does not flash. The data-loading wait is GONE — a settled-authed
  // user renders the home shell immediately (menubar/header present from frame 1), and `loading` tells
  // Lamun's screen which zones are still grey. This is the P1 fix: no full-screen white gate on data load.
  if (redirecting) return <AuthLoadingGate />

  return (
    <V2HomeScreen
      greeting={greeting}
      mascotCharacter={mascotCharacter}
      onLogout={logout}
      fortune={fortune}
      fortuneLoading={fortuneLoading}
      // Per-zone loading (goo → Lamun seam): true = data not in → grey block for that zone (❌ not the
      // 01.webp fallback). profile un-greys when the user row lands; mascot waits for the chart.
      loading={loading}
      // Header seam (กติกา ค): avatar + upgrade-badge inputs from the single user fetch. μุน's
      // V2HomeScreenProps declares `profile?` (optional, safe default) — this pass compiles once #180 lands.
      profile={profile}
      // ธาตุ line: element ← the compute/mascot source FIRST (so text ธาตุ matches the character),
      // then FALL BACK to bazi's persona.elementTh — defense-in-depth after the compute path proved
      // fragile in prod (the toComputeSource envelope bug hid the element). persona.elementTh is the
      // same day-master element from a verified-live path, so the row still renders even if the compute
      // chain is momentarily null. strength band ← persona; null band → Lamun's ElementLine drops the
      // "·". No loading prop: element is settled by the time home renders (behind AuthLoadingGate).
      element={{
        elementTh: resolveGreetingElementTh(computeSource, persona?.elementTh),
        strengthLabel: persona?.strengthLabel ?? null,
      }}
    />
  )
}

export default function V2HomePage(props: Props) {
  if (!props.teamAuthed) {
    return <V2GateForm gateError={props.gateError} />
  }
  // 🔴 TEMPORARY (#249): the team's reset control is mounted HERE, inside the `teamAuthed` branch,
  // so it exists only for a request the SERVER already verified against V2_PREVIEW_KEY — it is not
  // conditional on anything the client could flip. /v2 is also the one screen the team always comes
  // back to, so the control is findable without anyone being told a URL. #248 deletes these lines.
  return (
    <>
      <V2Entry />
      <TeamPreviewResetBadge />
    </>
  )
}
