// /course/calendar — หน้าขาย + สารบัญคอร์สสอนใช้ปฏิทินจีน Mumate (สาธารณะ ไม่ต้องล็อกอิน).
// ฟิว/พล 2026-10-01: EP 1-7 ฟรีทุกคน · EP 8-13 คอร์ส 490 (แถม Plus 1 เดือน) / 790 (แถม Plus 1 ปี)
// สมาชิก Plus/Pro เรียนได้เลยไม่ต้องซื้อ · ซื้อคอร์สแล้วเรียนได้ตลอด (แม้ Plus ที่แถมหมดอายุ)
import Head from 'next/head'
import Link from 'next/link'
import { SkyBackdrop, SkyHeader } from '@/features/v2-profile/components/kit'
import { useCalendarCourse } from '@/features/course/useCalendarCourse'
import { COURSE_OFFERS, PARTS, FREE_UNTIL_EP } from '@/lib/course/calendar-content'

const CARD = 'rounded-[20px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.10)]'

export default function CalendarCoursePage() {
  const s = useCalendarCourse()
  const access = s.status === 'ok' && s.access

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <Head>
        <title>คอร์สสอนใช้ปฏิทินจีน Mumate</title>
        <meta name="description" content="เรียนอ่านปฏิทินจีน Mumate ให้ใช้เป็นในชีวิตจริง — ดูฟรี 7 ตอน และ Advance Mode อีก 6 ตอน" />
      </Head>
      <SkyBackdrop />
      <SkyHeader title="คอร์สปฏิทิน Mumate" backHref="/v2" testId="course" />

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-16 pt-3">
        {/* Hero */}
        <section className={CARD}>
          <p className="text-xs font-bold tracking-wide text-v3-cyan">คอร์สออนไลน์ · 13 ตอน</p>
          <h2 className="mt-1 text-2xl font-black leading-8 text-v3-navy">อ่านปฏิทินจีนเป็น ใช้ได้จริงทุกวัน</h2>
          <p className="mt-2 text-sm leading-6 text-v3-text-body">
            เลิกเดาสีเสื้อ ทิศ และเวลามงคลจากสูตรตายตัว — เรียนวิธีอ่านปฏิทิน Mumate ที่คำนวณเฉพาะดวงของคุณ ตั้งแต่เกรด A-F
            เวลาทอง ไปจนถึง 8 ประตู 10 เทพ และการใช้จริงกับงาน เงิน ความรัก
          </p>
          <ul className="mt-3 space-y-1 text-sm text-v3-navy">
            <li>✅ ดูฟรี {FREE_UNTIL_EP} ตอนแรก ไม่ต้องสมัคร</li>
            <li>🔒 Advance Mode อีก 6 ตอน (EP 8-13)</li>
            <li>♾️ ซื้อครั้งเดียว เรียนได้ตลอด</li>
          </ul>
        </section>

        {/* สถานะสิทธิ์ / ข้อเสนอ */}
        {s.status === 'loading' ? (
          <p className="text-center text-sm text-v3-text-muted">กำลังตรวจสอบสิทธิ์ของคุณ…</p>
        ) : access ? (
          <p data-testid="course-access" className="rounded-2xl bg-v3-sapphire/10 p-4 text-center text-sm font-bold text-v3-sapphire">
            {s.status === 'ok' && s.via === 'member'
              ? '🎉 คุณเป็นสมาชิก Mumate — เรียนได้ครบทุกตอนโดยไม่ต้องซื้อคอร์ส'
              : '🎉 คุณมีสิทธิ์เรียนคอร์สนี้ครบทุกตอนแล้ว'}
          </p>
        ) : (
          <section className="flex flex-col gap-3" data-testid="course-offers">
            {COURSE_OFFERS.map((o, i) => (
              <div key={o.code} className={`${CARD} ${i === 1 ? 'ring-2 ring-v3-cyan' : ''}`}>
                {i === 1 ? <p className="mb-1 text-xs font-bold text-v3-cyan">คุ้มสุด · เพิ่มแค่ ฿300</p> : null}
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-base font-black text-v3-navy">{o.title}</h3>
                  <span className="text-2xl font-black text-v3-navy">฿{o.price.toLocaleString('th-TH')}</span>
                </div>
                <p className="mt-1 text-sm text-v3-text-body">เรียนครบ 13 ตอน (ตลอดชีพ) · {o.bonus}</p>
                <Link
                  href={`/v2/shop/checkout?package_code=${o.code}`}
                  data-testid={`course-buy-${o.code}`}
                  className="mt-3 grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-base font-bold text-white"
                >
                  ซื้อคอร์ส ฿{o.price.toLocaleString('th-TH')}
                </Link>
              </div>
            ))}
            <p className="text-center text-xs leading-5 text-v3-text-muted">
              เป็นสมาชิก Mumate + หรือ Pro อยู่แล้ว? เรียนได้เลยไม่ต้องซื้อ —{' '}
              {s.status === 'ok' && !s.loggedIn ? <Link href="/v2/login" className="font-bold text-v3-sapphire">เข้าสู่ระบบ</Link> : 'ตรวจสอบแพ็กเกจที่หน้าร้านค้า'}
            </p>
          </section>
        )}

        {/* สารบัญ */}
        {s.status === 'error' ? (
          <p className="text-center text-sm text-v3-error">โหลดรายการตอนไม่สำเร็จ ลองรีเฟรชอีกครั้ง</p>
        ) : null}
        {s.status === 'ok'
          ? ([1, 2, 3] as const).map((part) => {
              const eps = s.episodes.filter((e) => e.part === part)
              return (
                <section key={part} className={CARD}>
                  <p className="text-xs font-bold text-v3-cyan">ส่วนที่ {part}</p>
                  <h3 className="mb-2 text-base font-black leading-6 text-v3-navy">{PARTS[part]}</h3>
                  <ul className="flex flex-col divide-y divide-v3-border-card">
                    {eps.map((e) => {
                      const open = e.free || access
                      return (
                        <li key={e.ep}>
                          <Link href={`/course/calendar/${e.ep}`} data-testid={`course-ep-${e.ep}`} className="flex items-start gap-3 py-3">
                            <span className="grid size-8 flex-none place-items-center rounded-full bg-v3-sky-tint text-sm font-black text-v3-sapphire">
                              {e.ep}
                            </span>
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
            })
          : null}
      </main>
    </div>
  )
}
