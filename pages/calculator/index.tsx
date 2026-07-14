// Public Bazi Calculator (#public-bazi-calculator). No login, free, unlimited.
// getServerSideProps issues the compute nonce cookie on every page load (lib/calculator/nonce.ts)
// — the compute API rejects requests without a valid one, which blocks direct scripted POSTs
// that never loaded this page, invisibly (no captcha).
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { issueNonce, NONCE_COOKIE } from '@/lib/calculator/nonce'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const nonce = issueNonce()
  ctx.res.setHeader(
    'Set-Cookie',
    `${NONCE_COOKIE}=${nonce}; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=600`,
  )
  return { props: {} }
}

export default function CalculatorPage() {
  return (
    <>
      <Head>
        <title>ผังชะตากำเนิดของคุณ — MuMate</title>
      </Head>
      {/* TODO Phase 2: full scene per มุน's frame sheet (F0-F6) */}
      <main>Calculator — Phase 2 build in progress</main>
    </>
  )
}
