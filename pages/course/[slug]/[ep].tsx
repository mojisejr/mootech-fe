// /course/[slug]/[ep] — ดูคลิปทีละบท (calendar | life-matrix).
// EP ฟรี: ทุกคนดูได้ · EP เสียเงิน: API ส่ง videoId ให้เฉพาะคนมีสิทธิ์ ไม่มีสิทธิ์ → ชวนกลับไปหน้าคอร์ส
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { SkyBackdrop, SkyHeader } from '@/features/v2-profile/components/kit'
import { useCourse } from '@/features/course/useCourse'
import { CARD } from '@/features/course/EpisodeList'
import { COURSES, isCourseSlug } from '@/lib/course/content'

export default function CourseEpisodePage() {
  const router = useRouter()
  const slugRaw = String(router.query.slug ?? '')
  const slug = isCourseSlug(slugRaw) ? slugRaw : null
  const course = slug ? COURSES[slug] : null
  const epNo = Number(router.query.ep)
  const meta = course?.episodes.find((e) => e.ep === epNo)
  const s = useCourse(slug)
  const ep = s.status === 'ok' ? s.episodes.find((e) => e.ep === epNo) : undefined
  const prev = course?.episodes.find((e) => e.ep === epNo - 1)
  const next = course?.episodes.find((e) => e.ep === epNo + 1)
  const home = slug ? `/course/${slug}` : '/course/calendar'

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <Head>
        <title>{meta && course ? `บทที่ ${meta.ep} · ${course.name}` : 'คอร์ส Mumate'}</title>
      </Head>
      <SkyBackdrop />
      <SkyHeader title={meta && course ? `${course.name} · บทที่ ${meta.ep}` : 'คอร์ส Mumate'} backHref={home} testId="course-ep" />

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-16 pt-3">
        {router.isReady && !meta ? (
          <p className="text-center text-sm text-v3-text-body">ไม่พบบทเรียนนี้ — <Link href={home} className="font-bold text-v3-sapphire">กลับไปสารบัญ</Link></p>
        ) : null}

        {meta && course ? (
          <>
            <div className="overflow-hidden rounded-[20px] bg-black">
              {s.status === 'loading' ? (
                <div className="grid aspect-video place-items-center text-sm text-white/70">กำลังโหลด…</div>
              ) : ep?.videoId ? (
                <iframe
                  data-testid="course-player"
                  className="aspect-video w-full"
                  src={`https://www.youtube-nocookie.com/embed/${ep.videoId}?rel=0&modestbranding=1`}
                  title={meta.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : ep && (ep.free || (s.status === 'ok' && s.access)) ? (
                <div className="grid aspect-video place-items-center p-6 text-center text-sm text-white/80">คลิปบทนี้กำลังจะมา เร็ว ๆ นี้</div>
              ) : (
                <div data-testid="course-locked" className="grid aspect-video place-items-center gap-2 p-6 text-center text-white">
                  <p className="text-3xl">🔒</p>
                  <p className="text-sm font-bold">บทเรียนนี้สำหรับผู้ที่สมัครคอร์สแล้ว</p>
                </div>
              )}
            </div>

            <section className={CARD}>
              <p className="text-xs font-bold text-v3-cyan">บทที่ {meta.ep}{meta.free ? ' · ดูฟรี' : ''}</p>
              <h2 className="mt-1 text-lg font-black leading-7 text-v3-navy">{meta.title}</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-v3-text-body">
                {meta.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>

            {s.status === 'ok' && !meta.free && !s.access ? (
              <Link href={home} data-testid="course-unlock" className="grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-base font-bold text-white">
                {slug === 'calendar' ? 'ปลดล็อกคอร์ส ฿490' : 'ดูวิธีรับคอร์สนี้'}
              </Link>
            ) : null}

            <nav className="flex gap-3">
              {prev ? (
                <Link href={`/course/${course.slug}/${prev.ep}`} className="grid h-11 flex-1 place-items-center rounded-full border border-v3-sapphire text-sm font-bold text-v3-sapphire">‹ บทที่ {prev.ep}</Link>
              ) : <span className="flex-1" />}
              {next ? (
                <Link href={`/course/${course.slug}/${next.ep}`} className="grid h-11 flex-1 place-items-center rounded-full border border-v3-sapphire text-sm font-bold text-v3-sapphire">บทที่ {next.ep} ›</Link>
              ) : <span className="flex-1" />}
            </nav>
          </>
        ) : null}
      </main>
    </div>
  )
}
