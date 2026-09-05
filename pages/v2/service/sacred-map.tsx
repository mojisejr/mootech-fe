// /v2/service/sacred-map — แผนที่ศักดิ์สิทธิ์ (ทิศ & สีมงคลเฉพาะบุคคล). v2 gate เดียวกับ hub.
import type { GetServerSideProps } from "next"

import { v2RedirectIfUnauthed } from "@/lib/v2/gate"
import { SacredMapScreen } from "@/features/v2-service/components/SacredMapScreen"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2SacredMapPage() {
  return <SacredMapScreen />
}
