// /v2/service/honeycomb — เบอร์รังผึ้ง (พีระมิดเลข). v2 gate เดียวกับ hub.
import type { GetServerSideProps } from "next"

import { v2RedirectIfUnauthed } from "@/lib/v2/gate"
import { HoneycombScreen } from "@/features/v2-service/components/HoneycombScreen"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2HoneycombPage() {
  return <HoneycombScreen />
}
