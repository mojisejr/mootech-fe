// /taisui-2570 — ปีชง 2570 กับเสี่ยวมู่ (ciel-os workstream mumate-taisui-2570-001). Public: no login to see the
// four characters; the full reading needs LINE login. One URL for every channel, told apart by utm_*.
// ?ref=<referral code> opens a red packet from that member. Closed on production until TAISUI_2570_LIVE.
import Head from 'next/head'
import type { GetServerSideProps } from 'next'

import { TaisuiScreen } from '@/features/v2-taisui/components/TaisuiScreen'
import { issueNonce, NONCE_COOKIE } from '@/lib/calculator/nonce'
import { isTaisuiOpen } from '@/lib/taisui/live'
import { senderByCode } from '@/lib/taisui/server'
import { proOfferFrom, TAISUI_PRO_PACKAGE } from '@/lib/taisui/pro-offer'
import type { ProOffer } from '@/features/v2-taisui/components/taisui-motion'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

type Props = { refCode: string | null; sender: { name: string; animal: string; image: string } | null; origin: string; proOffer: ProOffer }

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  if (!isTaisuiOpen()) return { notFound: true }
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  ctx.res.setHeader('Set-Cookie', `${NONCE_COOKIE}=${issueNonce()}; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=1800`)
  const proto = (ctx.req.headers['x-forwarded-proto'] as string)?.split(',')[0] || 'https'
  const origin = `${proto}://${ctx.req.headers.host ?? 'bazichart.mumate.co'}`
  const raw = typeof ctx.query.ref === 'string' ? ctx.query.ref.trim().toUpperCase() : ''
  let sender: Props['sender'] = null
  let refCode: string | null = null
  if (raw) {
    const s = await senderByCode(raw).catch(() => null)
    if (s) { refCode = raw; sender = { name: s.name, animal: s.animal, image: s.image } }
  }
  // revision 0.14: the Pro yearly price from payment_package, the owner's code from env (TAISUI_PRO_CODE)
  const rowsOf = (x: unknown): Array<{ amount?: unknown; is_active?: unknown }> => (Array.isArray(x) ? x : ((x as { rows?: [] })?.rows ?? []))
  const pkg = await db.execute(sql`SELECT amount, is_active FROM payment_package WHERE package_code = ${TAISUI_PRO_PACKAGE} LIMIT 1`).then((r) => rowsOf(r)[0] ?? null).catch(() => null)
  const proOffer = proOfferFrom(pkg, process.env.TAISUI_PRO_CODE)
  return { props: { refCode, sender, origin, proOffer } }
}

export default function TaisuiPage({ refCode, sender, origin, proOffer }: Props) {
  const title = sender ? `อั่งเปาปีมะแมจาก ${sender.name} · MuMate` : 'ปีมะแม 2570 ส่งผลกับคุณยังไง · MuMate'
  const desc = 'ดูนักษัตรทั้ง 4 ตัวของคุณกับปีมะแมไฟ 丁未 ฟรี พร้อมเดือนที่ควรรุกและควรรอ กับเสี่ยวมู่'
  const image = `${origin}/images/v2/characters/08_มะแม-ไฟ.webp`
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:image" content={image} />
        <meta property="og:url" content={`${origin}/taisui-2570`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chonburi&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" />
      </Head>
      <TaisuiScreen refCode={refCode} sender={sender} proOffer={proOffer} />
    </>
  )
}
