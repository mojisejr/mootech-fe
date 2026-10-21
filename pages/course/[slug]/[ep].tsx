// /course/[slug]/[ep] — ดูคลิปทีละบท (calendar | life-matrix).
// EP ฟรี: ทุกคนดูได้ · EP เสียเงิน: API ส่ง videoId ให้เฉพาะคนมีสิทธิ์ ไม่มีสิทธิ์ → ชวนกลับไปหน้าคอร์ส
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { SkyBackdrop, SkyHeader } from '@/features/v2-profile/components/kit'
import { useCourse } from '@/features/course/useCourse'
import { CARD } from '@/features/course/EpisodeList'
import { COURSES, episodeCover, isCourseSlug } from '@/lib/course/content'

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
  // ปก + คลิปแนวตั้ง 9:16 (gafiw 2026-10-21) — โชว์ปกก่อน แตะ ▶ แล้วค่อยโหลดคลิป (ไม่โหลด YouTube จนกว่าจะกดดู)
  const cover = slug && meta ? episodeCover(slug, meta.ep) : null
  const [playing, setPlaying] = useState<number | null>(null)
  const isPlaying = playing === epNo

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
            <div className={cover ? 'relative mx-auto aspect-[9/16] w-full max-w-[340px] overflow-hidden rounded-[20px] bg-black' : 'overflow-hidden rounded-[20px] bg-black'}>
              {cover && !(ep?.videoId && isPlaying) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt={meta.title} data-testid="course-cover" className="absolute inset-0 size-full object-cover" />
              ) : null}
              {s.status === 'loading' ? (
                <div className={(cover ? 'absolute inset-0 bg-black/40 ' : 'aspect-video ') + 'grid place-items-center text-sm text-white/80'}>กำลังโหลด…</div>
              ) : ep?.videoId ? (
                cover && !isPlaying ? (
                  <button
                    type="button"
                    onClick={() => setPlaying(epNo)}
                    data-testid="course-play"
                    aria-label={`เล่นคลิปบทที่ ${meta.ep}`}
                    className="absolute inset-0 grid place-items-center bg-black/10"
                  >
                    <span className="grid size-16 place-items-center rounded-full bg-white/90 pl-1 text-2xl text-v3-sapphire shadow-lg">▶</span>
                  </button>
                ) : (
                  <iframe
                    data-testid="course-player"
                    className={cover ? 'absolute inset-0 size-full' : 'aspect-video w-full'}
                    src={`https://www.youtube-nocookie.com/embed/${ep.videoId}?rel=0&modestbranding=1${cover ? '&autoplay=1&playsinline=1' : ''}`}
                    title={meta.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )
              ) : ep && (ep.free || (s.status === 'ok' && s.access)) ? (
                <div className={(cover ? 'absolute inset-x-0 bottom-0 bg-black/60 ' : 'aspect-video ') + 'grid place-items-center p-6 text-center text-sm text-white/90'}>คลิปบทนี้กำลังจะมา เร็ว ๆ นี้</div>
              ) : (
                <div data-testid="course-locked" className={(cover ? 'absolute inset-0 bg-black/55 ' : 'aspect-video ') + 'grid place-items-center gap-2 p-6 text-center text-white'}>
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
