// features/v2-service/components/PrayerScreen.tsx — หน้าฟีเจอร์แยก "สร้างคำอธิษฐาน" (/v2/service/prayer)
// เลือกเรื่องที่ขอ → สร้างบทอธิษฐานตามคลัง 8 ประตู/10 เทพ + ธาตุเสริมดวง (用神) ของผู้ใช้.
// อยู่ในเชลล์เดียวกับหน้าบริการ (Menubar) เหมือน ServiceComingSoonScreen.
import Head from "next/head"
import Link from "next/link"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { PrayerGenerator } from "@/features/v2-service/components/PrayerGenerator"

function BackIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  )
}

export function PrayerScreen() {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-v3-bg-cream font-ibm">
      <Head>
        <title>สร้างคำอธิษฐาน · MuMate</title>
      </Head>

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-36 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="py-4">
          <Link
            href="/v2/service"
            data-testid="prayer-back"
            className="inline-flex items-center gap-1 text-[14px] font-medium leading-5 text-v3-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v3-focus-border"
          >
            <BackIcon />
            กลับไปหน้าบริการ
          </Link>
        </div>

        <h1 className="text-[22px] font-black text-v3-navy">สร้างคำอธิษฐาน</h1>
        <p className="mt-1 text-[13px] leading-5 text-v3-text-body">
          เลือกเรื่องที่อยากขอพร แล้วเราจะเรียบเรียงบทอธิษฐานให้ — เสริมด้วยธาตุมงคลจากดวงชะตาของคุณโดยเฉพาะ
        </p>

        <section className="mt-4 rounded-[18px] border border-v3-border-card bg-white p-4">
          <PrayerGenerator defaultTopic="general" />
        </section>
      </div>

      <Menubar />
    </div>
  )
}
