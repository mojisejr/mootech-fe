// features/v2-service/components/ServiceComingSoonScreen.tsx — the ONE shared "เร็วๆ นี้" destination for
// the 10 not-yet-built services (no Figma; designed within DESIGN.md). One page, not 10 empty routes.
// Meets บอง's minimum: (1) NAMES the service the user tapped — not a generic message; (2) honest — says
// plainly it isn't open, no fake-broken look, no fake "almost ready" countdown; (3) a clear way back;
// (4) stays in the shell (Menubar present, บริการ tab still active on /v2/service/*).
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Menubar } from '@/features/v2-shell/components/Menubar'

function BackIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  )
}

export function ServiceComingSoonScreen() {
  const { query } = useRouter()
  const raw = query.service
  const serviceName = (Array.isArray(raw) ? raw[0] : raw)?.trim() || 'บริการนี้'

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-v3-bg-cream font-ibm">
      <Head>
        <title>{`${serviceName} · เร็วๆ นี้ · MuMate`}</title>
      </Head>

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-36 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="py-4">
          <Link
            href="/v2/service"
            data-testid="coming-soon-back"
            className="inline-flex items-center gap-1 text-[14px] font-medium leading-5 text-v3-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v3-focus-border"
          >
            <BackIcon />
            กลับไปหน้าบริการ
          </Link>
        </div>

        <section className="mt-8 flex flex-col items-center gap-3 rounded-3xl bg-v3-ghost-white px-6 py-12 text-center">
          <span className="rounded-full bg-v3-grade-yellow px-3 py-1 text-[13px] font-semibold leading-5 text-v3-navy">เร็วๆ นี้</span>
          <h1 data-testid="coming-soon-title" className="text-[22px] font-bold leading-8 text-v3-navy [word-break:break-word]">{serviceName}</h1>
          <p className="max-w-xs text-[14px] font-medium leading-6 text-v3-text-body">
            บริการนี้ยังไม่เปิดให้ใช้งาน เรากำลังตั้งใจทำอยู่ และจะเปิดให้ใช้เมื่อพร้อมจริงๆ
          </p>
        </section>
      </div>

      <Menubar />
    </div>
  )
}
