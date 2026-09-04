// MuMate v2 — /v2/orders/[id] ใบเสร็จ (เฟรม order-receipt). Behind the v2 gate. Glue only.
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { OrderReceiptScreen } from '@/features/v2-account/components/OrderReceiptScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2OrderReceiptPage() {
  const router = useRouter()
  const id = typeof router.query.id === 'string' ? router.query.id : ''
  return <OrderReceiptScreen id={id} />
}
