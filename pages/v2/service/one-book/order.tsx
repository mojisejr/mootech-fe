// /v2/service/one-book/order — ฟอร์มสั่งซื้อหนังสือ Your Life Code (#3). v2 gate เดียวกับ hub.
import type { GetServerSideProps } from "next"

import { v2RedirectIfUnauthed } from "@/lib/v2/gate"
import { OrderBookScreen } from "@/features/v2-service/components/OrderBookScreen"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2OrderBookPage() {
  return <OrderBookScreen />
}
