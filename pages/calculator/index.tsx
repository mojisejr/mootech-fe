// Public Bazi Calculator (#public-bazi-calculator). No login, free, unlimited. Runs parallel to the
// homepage ("/"): both serve the SAME CalculatorHomeExperience (#calculator-homepage-swap). The
// difference lives in the page wrapper — "/" adds the auth/register machine + logged-in redirect;
// this route is the pure public tool, always the free calculator regardless of auth.
//
// getServerSideProps issues the compute nonce cookie on every page load (lib/calculator/nonce.ts)
// — the compute API rejects requests without a valid one, which blocks direct scripted POSTs that
// never loaded a host page, invisibly (no captcha).
//
// robots: indexable (the noindex was removed when the calculator became a public front door — it is
// now a real, linkable landing surface).
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { issueNonce, NONCE_COOKIE } from '@/lib/calculator/nonce'
import { CalculatorHomeExperience } from '@/components/calculator/CalculatorHomeExperience'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const nonce = issueNonce()
  ctx.res.setHeader('Set-Cookie', `${NONCE_COOKIE}=${nonce}; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=600`)
  return { props: {} }
}

export default function CalculatorPage() {
  return (
    <>
      <Head>
        <title>คำนวณดวงจีนฟรี · ผังชะตากำเนิด — MuMate</title>
      </Head>
      {/* menu-reached, not a landing page → no hero, just the birth form */}
      <CalculatorHomeExperience showHero={false} />
    </>
  )
}
