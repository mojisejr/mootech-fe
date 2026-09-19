// MuMate v2 — หน้าฟีเจอร์แยก "สร้างคำอธิษฐาน" (/v2/service/prayer). v2 gate เดียวกับหน้าบริการ.
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { PrayerScreen } from '@/features/v2-service/components/PrayerScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2ServicePrayerPage() {
  return <PrayerScreen />
}
