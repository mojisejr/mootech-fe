// /course/life-matrix — คอร์ส Bazi Life Matrix (15 บท). ขายเป็นข้อเสนอหลังซื้อคอร์ส Win the Day เท่านั้น
// (upsell +300 / downsell +199 ที่ /course/offer) — ยังไม่มีคลิป บทเรียนขึ้น "เร็ว ๆ นี้" จนกว่าฟิวจะวางลิงก์ที่ /ops
import Head from 'next/head'
import Link from 'next/link'
import { SkyBackdrop, SkyHeader } from '@/features/v2-profile/components/kit'
import { useCourse } from '@/features/course/useCourse'
import { EpisodeList, CARD } from '@/features/course/EpisodeList'
import { COURSES } from '@/lib/course/content'

const COURSE = COURSES['life-matrix']

export default function LifeMatrixPage() {
  const s = useCourse('life-matrix')
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <Head>
        <title>Bazi Life Matrix | Mumate</title>
      </Head>
      <SkyBackdrop />
      <SkyHeader title="Bazi Life Matrix" backHref="/course/calendar" testId="matrix" />
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-16 pt-3">
        <section className={CARD}>
          <p className="text-xs font-bold text-v3-cyan">คอร์สออนไลน์ · 15 บทเรียน</p>
          <h1 className="mt-1 text-2xl font-black leading-8 text-v3-navy">{COURSE.name}</h1>
          <p className="mt-2 text-sm leading-6 text-v3-text-body">{COURSE.tagline}</p>
          {s.status === 'ok' && s.access ? (
            <p data-testid="matrix-access" className="mt-3 rounded-2xl bg-v3-sapphire/10 p-3 text-center text-sm font-bold text-v3-sapphire">🎉 คุณมีสิทธิ์เรียนคอร์สนี้แล้ว</p>
          ) : s.status === 'ok' ? (
            <p className="mt-3 rounded-2xl bg-v3-bg-cream p-3 text-center text-sm leading-6 text-v3-text-body">
              รับคอร์สนี้ได้เป็นข้อเสนอพิเศษหลังสมัคร{' '}
              <Link href="/course/calendar" className="font-bold text-v3-sapphire">คอร์ส Win the Day</Link>
            </p>
          ) : null}
        </section>
        {s.status === 'error' ? <p className="text-center text-sm text-v3-error">โหลดรายการบทเรียนไม่สำเร็จ ลองรีเฟรชอีกครั้ง</p> : null}
        {s.status === 'ok' ? <EpisodeList course={COURSE} episodes={s.episodes} access={s.access} /> : null}
      </main>
    </div>
  )
}
