// สารบัญ EP ของคอร์ส แบ่งตามส่วน — ใช้ทั้งหน้าขายคอร์สปฏิทินและหน้าคอร์ส Life Matrix
import Link from 'next/link'
import { episodeCover, type Course } from '@/lib/course/content'
import type { CourseEpisode } from './useCourse'

export const CARD = 'rounded-[20px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.10)]'

export function EpisodeList({ course, episodes, access }: { course: Course; episodes: CourseEpisode[]; access: boolean }) {
  return (
    <>
      {Object.keys(course.parts).map((k) => {
        const part = Number(k)
        const eps = episodes.filter((e) => e.part === part)
        return (
          <section key={part} className={CARD}>
            <p className="text-xs font-bold text-v3-cyan">ส่วนที่ {part}</p>
            <h3 className="mb-2 text-base font-black leading-6 text-v3-navy">{course.parts[part]}</h3>
            <ul className="flex flex-col divide-y divide-v3-border-card">
              {eps.map((e) => {
                const open = e.free || access
                const cover = episodeCover(course.slug, e.ep)
                return (
                  <li key={e.ep}>
                    <Link href={`/course/${course.slug}/${e.ep}`} data-testid={`course-ep-${e.ep}`} className="flex items-start gap-3 py-3">
                      {cover ? (
                        // ปกคลิปแนวตั้ง (gafiw 2026-10-21) — บทที่ล็อกยังเห็นปก (ชวนอยากดู) แต่หรี่ลง
                        <span className="relative h-[74px] w-[42px] flex-none overflow-hidden rounded-lg bg-v3-sky-tint">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={cover} alt="" loading="lazy" data-testid={`course-ep-cover-${e.ep}`} className={'size-full object-cover' + (open ? '' : ' opacity-60')} />
                        </span>
                      ) : (
                        <span className="grid size-8 flex-none place-items-center rounded-full bg-v3-sky-tint text-sm font-black text-v3-sapphire">{e.ep}</span>
                      )}
                      <span className="min-w-0 flex-1 text-sm font-semibold leading-5 text-v3-navy">{e.title}</span>
                      <span className="flex-none text-xs font-bold">
                        {!open ? '🔒' : e.ready ? <span className="text-v3-cyan">▶ ดู</span> : <span className="text-v3-text-muted">เร็ว ๆ นี้</span>}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </>
  )
}
