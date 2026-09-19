// /launch — secret go-live console (#606). Reachable only with LAUNCH_KEY: middleware guardLaunch gates
// the edge, and this SSR re-checks the cookie (defense in depth). Unauthed → 404 (never leaks existence).
import type { GetServerSideProps } from "next"
import Head from "next/head"
import { isLaunchAuthed } from "@/lib/launch/auth"
import { LaunchConsole } from "@/features/launch/LaunchConsole"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  if (!isLaunchAuthed(ctx.req)) return { notFound: true }
  return { props: {} }
}

export default function LaunchPage() {
  return (
    <>
      <Head>
        <title>Launch · MuMate</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <LaunchConsole />
    </>
  )
}
