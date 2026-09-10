// /v2/service/sacred-map/[id] — หน้ารายละเอียดสถานที่ศักดิ์สิทธิ์ (แยกหน้า) · v2 gate เดียวกับ hub
import type { GetServerSideProps } from "next"

import { v2RedirectIfUnauthed } from "@/lib/v2/gate"
import { SacredPlaceDetailScreen } from "@/features/v2-service/components/SacredPlaceDetailScreen"
import type { SacredLocation } from "@/features/v2-service/sacred-map-shared"

export const getServerSideProps: GetServerSideProps<{ loc: SacredLocation }> = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  const id = String(ctx.params?.id ?? "").trim()
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    const r = await fetch(`${base}/api/sacred-map/${encodeURIComponent(id)}`)
    if (!r.ok) return { notFound: true }
    const j = (await r.json()) as { ok?: boolean; location?: SacredLocation }
    if (!j.ok || !j.location) return { notFound: true }
    return { props: { loc: j.location } }
  } catch {
    return { notFound: true }
  }
}

export default function V2SacredPlacePage({ loc }: { loc: SacredLocation }) {
  return <SacredPlaceDetailScreen loc={loc} />
}
