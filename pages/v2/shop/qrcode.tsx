// MuMate v2 — จอ QR พร้อมเพย์ (mootech-fe#363). Behind the v2 gate. Glue only; the rules live in QrScreen.
import Head from 'next/head'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { QrScreen } from '@/features/v2-shop/components/QrScreen'
import { formatSatang } from '@/features/v2-shop/usePackagePrice'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2QrPage() {
  const router = useRouter()
  const q = router.query
  const charge = typeof q.charge === 'string' ? q.charge : ''
  const qr = typeof q.qr === 'string' ? q.qr : ''
  const amount = typeof q.amount === 'string' ? Number(q.amount) : 0

  if (!charge || !qr) {
    // Landing here without a charge means a stale link or a refresh after the flow ended. Sending them to a
    // blank QR would look broken; the shop is the only honest place to be.
    return null
  }

  return (
    <div className="min-h-screen w-full bg-v3-bg-cream px-4 py-10">
      <Head><title>สแกนเพื่อชำระเงิน · MuMate</title></Head>
      <QrScreen
        chargeId={charge}
        qrUrl={qr}
        amountText={formatSatang(amount)}
        onApproved={() => router.replace(`/v2/shop/result?state=APPROVED&charge=${encodeURIComponent(charge)}`)}
        onNewQr={() => router.replace('/v2/shop/checkout')}
        // 🔴 back NAVIGATES AND NOTHING ELSE — the charge stays payable, and its code hold releases itself
        //    within the quote TTL (lib/discount/repo.ts:104-122). Cancelling here would destroy money the
        //    user may still be about to send.
        onBack={() => router.push('/v2/shop')}
      />
    </div>
  )
}
