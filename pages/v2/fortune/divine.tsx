// pages/v2/fortune/divine.tsx — เสี่ยงไพ่จิตวิญญาณแดนสวรรค์ (divine-cards) เฟรม 55449:2170
import type { GetServerSideProps } from "next"

import { v2RedirectIfUnauthed } from "@/lib/v2/gate"
import { CardReadingScreen } from "@/features/v2-fortune/components/CardReadingScreen"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function DivineCardsPage() {
  return (
    <CardReadingScreen
      mode="divine"
      title="เสี่ยงไพ่จิตวิญญาณแดนสวรรค์"
      resultTitle="ผลไพ่จิตวิญญาณ"
      introArt="/images/v2/features/05_เสี่ยงไพ่จิตวิญญาณแดนสวรรค์.png"
      endpoint="/api/fortune/divine"
      deckCount={80}
    />
  )
}
