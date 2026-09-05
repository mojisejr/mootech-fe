// pages/v2/fortune/oracle.tsx — เสี่ยงไพ่ออราเคิลเคี้ยงคุง (oracle-cards) เฟรม 55449:2172
import type { GetServerSideProps } from "next"

import { v2RedirectIfUnauthed } from "@/lib/v2/gate"
import { CardReadingScreen } from "@/features/v2-fortune/components/CardReadingScreen"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function OracleCardsPage() {
  return (
    <CardReadingScreen
      mode="oracle"
      title="เสี่ยงไพ่ออราเคิลเคี้ยงคุง"
      resultTitle="ผลไพ่ออราเคิล"
      introArt="/images/v2/features/04_เสี่ยงไพ่ออราเคิลเคี้ยงคุง.png"
      endpoint="/api/fortune/oracle"
      deckCount={120}
    />
  )
}
