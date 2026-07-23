// MuMate v2 entry (Slice 1). TWO gates stack here:
//   1. TEAM preview gate (v2_access) — SSR (getServerSideProps): no cookie → render the passkey
//      form; the whole /v2 surface is team-only.
//   2. APP identity — CLIENT via useV2AuthGate (mount-safe, cookie-truth, login-loop invariant):
//      anon → onboarding carousel, loading/pre-mount → wait (splash), authed → home.
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { isV2Authenticated } from '@/lib/v2/gate'
import { useV2AuthGate } from '@/features/auth/hooks/useV2AuthGate'
import { useV2Home } from '@/features/auth/hooks/useV2Home'
import { useMascotFromCompute } from '@/lib/personalization/use-mascot'
import { AuthLoadingGate } from '@/features/v2-shell/components/AuthLoadingGate'
import { AppScreen } from '@/features/v2-shell/components/AppScreen'
import { V2GateForm } from '@/features/v2-shell/components/V2GateForm'
import { OnboardingCarousel } from '@/features/onboarding/components/OnboardingCarousel'

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
  return <V2HomeRoute />
}

// Authed home: useV2Home does the gap-C routing (has-chart→home / no-chart→/v2/register, loop-safe) and
// yields the greeting + mascot compute-source. This inline render is the LOGIC placeholder (routing +
// per-user mascot + fallback) — Lamun's <V2HomeScreen/> replaces the body on merge, consuming the same
// hook. Both hooks are called unconditionally (rules-of-hooks) before the loading branch.
function V2HomeRoute() {
  const { showLoading, greeting, computeSource } = useV2Home()
  const mascot = useMascotFromCompute(computeSource)

  if (showLoading) return <AuthLoadingGate />

  const HERO_FALLBACK = '/images/v2/mascot/01.png'
  const heroSrc = mascot?.character ?? HERO_FALLBACK
  return (
    <AppScreen title="หน้าหลัก">
      <section className="flex flex-col items-center gap-3 rounded-2xl bg-white p-6 shadow-sm">
        {/* Fallback fires on BOTH null-mascot AND a missing character file (the 60 character assets are
            not yet in the repo) — onError degrades to the static hero, never a broken image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroSrc}
          alt="mascot"
          width={120}
          height={120}
          className="h-30 w-30 object-contain"
          onError={(e) => {
            if (e.currentTarget.src.endsWith(HERO_FALLBACK)) return // guard: don't loop on the fallback itself
            e.currentTarget.src = HERO_FALLBACK
          }}
        />
        <h1 className="font-poppins-v3 text-xl font-bold text-v3-sapphire">
          สวัสดี {greeting.name || 'คุณ'}
        </h1>
        <p className="text-sm text-neutral-500">โครงหน้าหลัก (Lamun compose layout จริง)</p>
      </section>
    </AppScreen>
  )
}

export default function V2HomePage(props: Props) {
  if (!props.teamAuthed) {
    return <V2GateForm gateError={props.gateError} />
  }
  return <V2Entry />
}
