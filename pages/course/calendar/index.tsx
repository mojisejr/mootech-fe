// /course/calendar — หน้าขาย + สารบัญคอร์สสอนใช้ปฏิทินจีน Mumate (สาธารณะ ไม่ต้องล็อกอิน).
// ฟิว/พล 2026-10-01: EP 1-7 ฟรีทุกคน · EP 8-13 คอร์ส 490 (แถม Plus 1 เดือน) / 790 (แถม Plus 1 ปี)
// สมาชิก Plus/Pro เรียนได้เลยไม่ต้องซื้อ · ซื้อคอร์สแล้วเรียนได้ตลอด (แม้ Plus ที่แถมหมดอายุ)
import { useState } from 'react'
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { SkyBackdrop, SkyHeader } from '@/features/v2-profile/components/kit'
import { useCalendarCourse } from '@/features/course/useCalendarCourse'
import { PARTS, FREE_UNTIL_EP, COURSE_UPSELL_CODE, COURSE_UPSELL_PRICE, checkoutHrefFor } from '@/lib/course/calendar-content'

const CARD = 'rounded-[20px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.10)]'

/** flow จ่ายเงินของฟิว: กดซื้อ 490 → ① ชวน 790 (Plus 1 ปี) → ไม่เอา → ② 790 ลด 10% = 711 → ไม่เอา → จ่าย 490 */
function UpsellSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const go = (href: string) => void router.push(href)
  return (
    <div role="dialog" aria-modal="true" data-testid="course-upsell" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-[24px] bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-[24px]" onClick={(e) => e.stopPropagation()}>
        {step === 1 ? (
          <>
            <p className="text-xs font-bold text-v3-cyan">ก่อนชำระเงิน</p>
            <h3 className="mt-1 text-xl font-black leading-7 text-v3-navy">เพิ่มอีก ฿300 ได้ใช้ปฏิทิน 1 ปีเต็ม</h3>
            <p className="mt-2 text-sm leading-6 text-v3-text-body">
              คอร์ส ฿490 แถม Mumate + 1 เดือน · เพิ่มเป็น <b>฿790</b> ได้ Mumate + ใช้ปฏิทินครบ <b>1 ปี</b> — คุ้มกว่า เรียนจบแล้วยังใช้จริงต่อได้ทั้งปี
            </p>
            <button type="button" data-testid="upsell-yes-790" onClick={() => go(checkoutHrefFor('COURSE_CAL_790'))} className="mt-4 h-12 w-full rounded-full bg-v3-sapphire text-base font-bold text-white">
              เอา ฿790 (ได้ 1 ปี)
            </button>
            <button type="button" data-testid="upsell-no-790" onClick={() => setStep(2)} className="mt-2 h-11 w-full rounded-full text-sm font-semibold text-v3-text-body">
              ไม่เอา
            </button>
          </>
        ) : (
          <>
            <p className="text-xs font-bold text-v3-error">ข้อเสนอพิเศษ · ครั้งเดียว</p>
            <h3 className="mt-1 text-xl font-black leading-7 text-v3-navy">ลดเพิ่ม 10% เหลือ ฿{COURSE_UPSELL_PRICE}</h3>
            <p className="mt-2 text-sm leading-6 text-v3-text-body">
              คอร์สปฏิทิน + Mumate + 1 ปี จาก <s>฿790</s> เหลือ <b>฿{COURSE_UPSELL_PRICE}</b> — จ่ายเพิ่มจาก ฿490 แค่ ฿{COURSE_UPSELL_PRICE - 490}
            </p>
            <button type="button" data-testid="upsell-yes-711" onClick={() => go(checkoutHrefFor('COURSE_CAL_790', COURSE_UPSELL_CODE))} className="mt-4 h-12 w-full rounded-full bg-v3-sapphire text-base font-bold text-white">
              เอา ฿{COURSE_UPSELL_PRICE}
            </button>
            <button type="button" data-testid="upsell-no-711" onClick={() => go(checkoutHrefFor('COURSE_CAL_490'))} className="mt-2 h-11 w-full rounded-full text-sm font-semibold text-v3-text-body">
              ไม่เอา ซื้อคอร์ส ฿490 ตามเดิม
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function CalendarCoursePage() {
  const s = useCalendarCourse()
  const [upsell, setUpsell] = useState(false)
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
        {/* ภาพคอร์ส — รูปเดียวกับแบนเนอร์หน้าแรก (public/images/v2/popup/calendar-course.png) */}
        <Image src="/images/v2/popup/calendar-course.png" alt="คอร์สปฏิทิน Mumate" width={1000} height={1300} priority className="h-auto w-full rounded-[20px] drop-shadow-[0_4px_15px_rgba(26,38,77,0.10)]" />

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
            <div className={CARD}>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-base font-black text-v3-navy">คอร์สปฏิทิน Mumate</h3>
                <span className="text-2xl font-black text-v3-navy">฿490</span>
              </div>
              <p className="mt-1 text-sm text-v3-text-body">เรียนครบ 13 ตอน (ตลอดชีพ) · แถม Mumate + ใช้ปฏิทินฟรี 1 เดือน</p>
              <button
                type="button"
                data-testid="course-buy"
                onClick={() => setUpsell(true)}
                className="mt-3 grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-base font-bold text-white"
              >
                ซื้อคอร์ส ฿490
              </button>
            </div>
            <p className="text-center text-xs leading-5 text-v3-text-muted">
              สมัครสมาชิก Mumate + หรือ Pro แบบชำระเงินอยู่แล้ว? เรียนได้เลยไม่ต้องซื้อ (สิทธิ์ฟรีจากโค้ดกิจกรรมไม่รวม) —{' '}
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
      {upsell ? <UpsellSheet onClose={() => setUpsell(false)} /> : null}
    </div>
  )
}
