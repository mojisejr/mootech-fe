// /v2/newyear — แผนชีวิตปีใหม่ 2570 (team meeting 2026-11-24, item 13). Public: anyone can type a birth and
// see part of the plan; the full one-page plan is the bonus of a yearly plan. One URL for the December
// campaign, told apart by utm_*. Closed on production until NEWYEAR_LIVE (lib/newyear/live.ts).
import Head from "next/head"
import type { GetServerSideProps } from "next"
import { sql } from "drizzle-orm"

import { NewYearScreen, type NewYearOffers } from "@/features/v2-newyear/components/NewYearScreen"
import { issueNonce, NONCE_COOKIE } from "@/lib/calculator/nonce"
import { db } from "@/lib/db"
import { isNewYearOpen } from "@/lib/newyear/live"
import { NEWYEAR_PLUS_PACKAGE, NEWYEAR_PRO_PACKAGE, newYearOffer } from "@/lib/newyear/offer"

const rowsOf = (x: unknown): Array<{ amount?: unknown; is_active?: unknown }> => (Array.isArray(x) ? x : ((x as { rows?: [] })?.rows ?? []))

export const getServerSideProps: GetServerSideProps<{ offers: NewYearOffers }> = async (ctx) => {
  if (!isNewYearOpen()) return { notFound: true }
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  ctx.res.setHeader("Set-Cookie", `${NONCE_COOKIE}=${issueNonce()}; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=1800`)
  // The two yearly prices from payment_package — the page never types a price; the owner's codes come from env.
  const load = (code: string) =>
    db.execute(sql`SELECT amount, is_active FROM payment_package WHERE package_code = ${code} LIMIT 1`).then((r) => rowsOf(r)[0] ?? null).catch(() => null)
  const [plusRow, proRow] = await Promise.all([load(NEWYEAR_PLUS_PACKAGE), load(NEWYEAR_PRO_PACKAGE)])
  const offers: NewYearOffers = {
    plus: newYearOffer(plusRow, process.env.NEWYEAR_PLUS_CODE, NEWYEAR_PLUS_PACKAGE),
    pro: newYearOffer(proRow, process.env.NEWYEAR_PRO_CODE, NEWYEAR_PRO_PACKAGE),
  }
  return { props: { offers } }
}

export default function NewYearPage({ offers }: { offers: NewYearOffers }) {
  const title = "แผนชีวิตปีใหม่ 2570 · ปีใหม่มาหา solution ของคุณ · MuMate"
  const desc = "สรุปทั้งปีในหน้าเดียว เฉพาะดวงคุณ — 4 เสา 12 เดือน และสิ่งที่ควรทำ กับ MuMate"
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
      </Head>
      <NewYearScreen offers={offers} />
    </>
  )
}
