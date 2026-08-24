// MuMate v2 — จอผลการชำระเงิน (mootech-fe#363). Behind the v2 gate. Glue only.
//
// The state arrives in the URL, but a URL is a thing anyone can type — so a claimed APPROVED is VERIFIED
// against /payment/status for that chargeId before this screen will say the money moved. Trusting the query
// string would mean /v2/shop/result?state=APPROVED is a page that tells anyone their payment succeeded.
import Head from 'next/head'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { ResultScreen } from '@/features/v2-shop/components/ResultScreen'
import { RESULT_COPY, type ResultState } from '@/features/v2-shop/result-state'
import { useChargeStatus } from '@/features/v2-shop/useChargeStatus'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

const isState = (v: unknown): v is ResultState => typeof v === 'string' && v in RESULT_COPY

export default function V2ResultPage() {
  const router = useRouter()
  const charge = typeof router.query.charge === 'string' ? router.query.charge : ''
  const claimed: ResultState = isState(router.query.state) ? router.query.state : 'PAYING'
  const { status, phase, check } = useChargeStatus(charge || null)

  // 🔴 THE SERVER DECIDES WHETHER MONEY MOVED. A claim of APPROVED (or PAYING) is only allowed to become a
  // success once /payment/status agrees about THIS charge. Claims that do not assert payment (a declined
  // card, our own offline) are shown as-is — they cost the user nothing if wrong, and the alternative is a
  // blank screen after a failure.
  const settled = status === 'APPROVED'
  const state: ResultState =
    settled ? (claimed === 'PAYING' ? 'APPROVED' : claimed === 'APPROVED' ? 'APPROVED' : 'ALREADY_PAID')
      // 🔴 THREE ANSWERS, NOT TWO (#423). An unverified claim of success is 'PAYING' while we poll fast,
      // 'RECONCILING' while the repair cron may still settle it, and only then 'QR_MAYBE_EXPIRED'. The middle
      // one exists so the screen never suggests paying again during the window that fixes it for free.
      : RESULT_COPY[claimed].paid
        ? phase === 'waiting' ? 'PAYING' : phase === 'reconciling' ? 'RECONCILING' : 'QR_MAYBE_EXPIRED'
        : claimed

  return (
    // Centred for the same reason as the QR screen: top-aligned, the outcome sat above half a phone of
    // empty cream and read as an unfinished page. On the screen that tells someone whether their money moved,
    // "unfinished" is the worst possible impression to leave.
    <div className="flex min-h-screen w-full flex-col justify-center bg-v3-bg-cream">
      <Head><title>ผลการชำระเงิน · MuMate</title></Head>
      <ResultScreen
        state={state}
        onRetrySame={check}
        onTryAnother={() => router.push('/v2/shop/checkout')}
        onDone={() => router.push(RESULT_COPY[state].paid ? '/v2' : '/v2/shop')}
      />
    </div>
  )
}
