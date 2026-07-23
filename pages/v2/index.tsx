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
import { useMascotFromCompute } from '@/lib/personalization/use-mascot'
import { AuthLoadingGate } from '@/features/v2-shell/components/AuthLoadingGate'
import { V2GateForm } from '@/features/v2-shell/components/V2GateForm'
import { OnboardingCarousel } from '@/features/onboarding/components/OnboardingCarousel'
import { V2HomeScreen } from '@/features/v2-home/components/V2HomeScreen'

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

  if (showLoading) return <AuthLoadingGate />

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
// modal calls; useMascotFromCompute → character path (null → 01.png fallback). Lamun's V2HomeScreen is
// presentational (props only). All hooks are called unconditionally before the loading branch.
function V2HomeRoute({ status }: { status: AuthStatus }) {
  const { showLoading, greeting, computeSource } = useV2Home(status)
  const { logout } = useV2Logout()
  const mascotCharacter = useMascotFromCompute(computeSource)?.character ?? '/images/v2/mascot/01.png'

  if (showLoading) return <AuthLoadingGate />

  return <V2HomeScreen greeting={greeting} mascotCharacter={mascotCharacter} onLogout={logout} />
}

export default function V2HomePage(props: Props) {
  if (!props.teamAuthed) {
    return <V2GateForm gateError={props.gateError} />
  }
  return <V2Entry />
}
