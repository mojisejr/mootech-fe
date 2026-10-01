// /course/calendar/[ep] — ดูคลิปคอร์สปฏิทินทีละตอน.
// EP ฟรี: ทุกคนดูได้ · EP เสียเงิน: API ส่ง videoId ให้เฉพาะคนมีสิทธิ์ ไม่มีสิทธิ์ → ชวนซื้อ/ล็อกอิน
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { SkyBackdrop, SkyHeader } from '@/features/v2-profile/components/kit'
import { useCalendarCourse } from '@/features/course/useCalendarCourse'
import { EPISODES } from '@/lib/course/calendar-content'

const CARD = 'rounded-[20px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.10)]'

export default function CalendarEpisodePage() {
  const router = useRouter()
  const epNo = Number(router.query.ep)
  const meta = EPISODES.find((e) => e.ep === epNo)
  const s = useCalendarCourse()
  const ep = s.status === 'ok' ? s.episodes.find((e) => e.ep === epNo) : undefined
  const prev = EPISODES.find((e) => e.ep === epNo - 1)
  const next = EPISODES.find((e) => e.ep === epNo + 1)

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <Head>
        <title>{meta ? `EP ${meta.ep} · ${meta.title}` : 'คอร์สปฏิทิน Mumate'}</title>
      </Head>
      <SkyBackdrop />
      <SkyHeader title={meta ? `EP ${meta.ep}` : 'คอร์สปฏิทิน'} backHref="/course/calendar" testId="course-ep" />

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-16 pt-3">
        {router.isReady && !meta ? (
          <p className="text-center text-sm text-v3-text-body">ไม่พบตอนนี้ — <Link href="/course/calendar" className="font-bold text-v3-sapphire">กลับไปสารบัญ</Link></p>
        ) : null}

        {meta ? (
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
                <div className="grid aspect-video place-items-center p-6 text-center text-sm text-white/80">คลิปตอนนี้กำลังจะมา เร็ว ๆ นี้</div>
              ) : (
                <div data-testid="course-locked" className="grid aspect-video place-items-center gap-2 p-6 text-center text-white">
                  <p className="text-3xl">🔒</p>
                  <p className="text-sm font-bold">ตอนนี้อยู่ใน Advance Mode (EP 8-13)</p>
                  <p className="text-xs text-white/70">ซื้อคอร์ส หรือเป็นสมาชิก Mumate + / Pro เพื่อดูต่อ</p>
                </div>
              )}
            </div>

            <section className={CARD}>
              <p className="text-xs font-bold text-v3-cyan">EP {meta.ep}{meta.free ? ' · ดูฟรี' : ' · Advance'}</p>
              <h2 className="mt-1 text-lg font-black leading-7 text-v3-navy">{meta.title}</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-v3-text-body">
                {meta.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>

            {s.status === 'ok' && !meta.free && !s.access ? (
              <Link href="/course/calendar" data-testid="course-unlock" className="grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-base font-bold text-white">
                ปลดล็อกคอร์ส เริ่มต้น ฿490
              </Link>
            ) : null}

            <nav className="flex gap-3">
              {prev ? (
                <Link href={`/course/calendar/${prev.ep}`} className="grid h-11 flex-1 place-items-center rounded-full border border-v3-sapphire text-sm font-bold text-v3-sapphire">
                  ‹ EP {prev.ep}
                </Link>
              ) : <span className="flex-1" />}
              {next ? (
                <Link href={`/course/calendar/${next.ep}`} className="grid h-11 flex-1 place-items-center rounded-full border border-v3-sapphire text-sm font-bold text-v3-sapphire">
                  EP {next.ep} ›
                </Link>
              ) : <span className="flex-1" />}
            </nav>
          </>
        ) : null}
      </main>
    </div>
  )
}
