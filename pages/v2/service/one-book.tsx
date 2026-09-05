// /v2/service/one-book — Your Life Code (คู่มือดวงจีนเฉพาะบุคคล). v2 gate เดียวกับ hub.
import type { GetServerSideProps } from "next"

import { v2RedirectIfUnauthed } from "@/lib/v2/gate"
import { OneBookScreen } from "@/features/v2-service/components/OneBookScreen"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2OneBookPage() {
  return <OneBookScreen />
}
