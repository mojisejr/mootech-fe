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
import { RESULT_COPY, resolveResultState, tryAnotherHref, type ResultState } from '@/features/v2-shop/result-state'
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
  // #438 — carried through from checkout so "เลือกวิธีชำระเงินอื่น" can land on the SAME package's checkout
  // instead of a bare /v2/shop/checkout, which resolves package_code to '' and makes /payment/preview 400.
  const packageCode = typeof router.query.package_code === 'string' ? router.query.package_code : ''
  const { status, method, phase, check } = useChargeStatus(charge || null)

  // Glue only — the rule lives in result-state.ts next to the words it chooses between, so it can be tested
  // without a router. That is not tidiness: the branch this ticket adds was missing precisely because the
  // only way to exercise the old nested ternary was to render this page.
  const state: ResultState = resolveResultState({ status, method, claimed, phase })

  return (
    // Centred for the same reason as the QR screen: top-aligned, the outcome sat above half a phone of
    // empty cream and read as an unfinished page. On the screen that tells someone whether their money moved,
    // "unfinished" is the worst possible impression to leave.
    <div className="flex min-h-screen w-full flex-col justify-center bg-v3-bg-cream">
      <Head><title>ผลการชำระเงิน · MuMate</title></Head>
      <ResultScreen
        state={state}
        onRetrySame={check}
        // 🔴 #438 — WITH the package, or not at all. Pushing a bare /v2/shop/checkout sends the user to a
        // screen that cannot price anything (checkout.tsx:34 → '' → /payment/preview 400), which turns
        // "try another method" into a second dead end. No package in the URL (an old link, a hand-typed
        // one) ⇒ send them somewhere that works: the package list.
        onTryAnother={() => router.push(tryAnotherHref(packageCode))}
        onDone={() => router.push(RESULT_COPY[state].paid ? '/v2' : '/v2/shop')}
      />
    </div>
  )
}
