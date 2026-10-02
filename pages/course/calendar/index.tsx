// /course/calendar — Sale page คอร์ส "Win the Day" (คอร์สปฏิทิน Mumate ฿490) ตามเอกสาร sale page ของพล 2026-10-01.
// 8 ส่วน: Hero · ขยี้ปัญหา · ทางออก · หลักสูตร 13 บท · โบนัส Plus 1 เดือน · สรุปมูลค่า · FAQ · ปิดการขาย
// มีสิทธิ์แล้ว (สมาชิกที่จ่ายเงินจริง / เคยซื้อ) → ไม่โชว์ปุ่มซื้อ โชว์ "เรียนได้เลย" แทน
// upsell/downsell (Bazi Life Matrix) เสนอ "หลังจ่าย 490" ที่ /course/offer
import { useState } from 'react'
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { SkyBackdrop, SkyHeader } from '@/features/v2-profile/components/kit'
import { useCourse, type CourseState } from '@/features/course/useCourse'
import { EpisodeList, CARD } from '@/features/course/EpisodeList'
import { COURSES, checkoutHrefFor } from '@/lib/course/content'

const COURSE = COURSES.calendar
const BUY_HREF = checkoutHrefFor('COURSE_CAL_490')

const PAINS = [
  { icon: '❌', text: 'ใส่เสื้อสีมงคลตามตารางทั่วไป แต่ทำไมไปคุยงานแล้วยังพัง ไม่รู้สึกว่าเป็นวันของเรา?' },
  { icon: '🌪️', text: 'นัดเจรจาหรือตัดสินใจเรื่องใหญ่ในวันที่พลังงานต้านทาน จนเกิดข้อผิดพลาดที่แก้ยาก?' },
  { icon: '⏱️', text: 'ยุ่งจนไม่มีเวลาดูฤกษ์ยามซับซ้อน แต่อยากรู้วิธีเลี่ยง "วันชง" หรือ "วันพัง" แบบง่าย ๆ ทันทีที่ตื่นนอน?' },
]

const FAQ = [
  { q: 'ไม่มีพื้นฐานดวงจีนเลย เรียนรู้เรื่องไหม?', a: 'เรียนได้ 100% คอร์สนี้ไม่ได้สอนให้คุณเป็นหมอดู แต่สอนวิธีใช้ "เครื่องมือ" (ปฏิทิน) เพื่อคนทั่วไปนำไปปรับใช้กับชีวิตประจำวันได้ทันที' },
  { q: 'มีสอนหาฤกษ์ยามแบบลึกซึ้งเลยไหม?', a: 'คอร์สนี้เน้นการหาวันที่เหมาะสม-วันควรระวัง และการเลือกกิจกรรมให้เข้ากับวันนั้น ๆ เพื่อให้คนทั่วไปใช้งานได้จริงอย่างรวดเร็ว โดยเลี่ยงความซับซ้อนของวิชาฤกษ์ยามขั้นสูง' },
  { q: 'หลังจากแอปฟรี 1 เดือนหมดอายุ จะโดนตัดบัตรอัตโนมัติไหม?', a: 'ไม่มีการหักเงินอัตโนมัติซ่อนเร้น คุณสามารถเลือกต่ออายุด้วยตัวเองได้หากชื่นชอบ หรือกลับไปใช้แอปเวอร์ชันปกติได้ฟรีตลอดไป' },
  { q: 'เรียนที่ไหน มีวันหมดอายุไหม?', a: 'เรียนผ่านระบบออนไลน์ เข้าเรียนได้ทันทีหลังชำระเงิน และดูซ้ำได้ตลอดชีพ ไม่มีวันหมดอายุ' },
]

/** ปุ่ม CTA: ยังตรวจสิทธิ์ → รอ · มีสิทธิ์ → เข้าเรียน · ไม่มี → ไปจ่าย 490 */
function Cta({ s, label, testId, gold }: { s: CourseState; label: string; testId: string; gold?: boolean }) {
  if (s.status === 'loading') return <p className={`text-center text-sm ${gold ? 'text-white/70' : 'text-v3-text-muted'}`}>กำลังตรวจสอบสิทธิ์ของคุณ…</p>
  if (s.status === 'ok' && s.access) {
    return (
      <Link
        href="/course/calendar/1"
        data-testid={`${testId}-go`}
        className={`grid min-h-14 w-full place-items-center rounded-full px-4 text-base font-bold text-white ${gold ? 'bg-gradient-to-r from-[#1c2547] via-[#4b4a6e] to-[#c9a45c] shadow-[0_6px_18px_rgba(201,164,92,0.45)]' : 'bg-v3-cyan'}`}
      >
        {s.via === 'member' ? 'คุณเป็นสมาชิก — เข้าเรียนได้เลย ▶' : 'คุณมีสิทธิ์แล้ว — เข้าเรียนเลย ▶'}
      </Link>
    )
  }
  return (
    <Link
      href={BUY_HREF}
      data-testid={testId}
      className={`grid min-h-14 w-full place-items-center rounded-full px-4 text-center text-base font-bold shadow-lg transition-transform hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 ${gold ? 'bg-gradient-to-r from-[#1c2547] via-[#4b4a6e] to-[#c9a45c] text-white shadow-[0_6px_18px_rgba(201,164,92,0.45)]' : 'bg-v3-sapphire text-white'}`}
    >
      {label}
    </Link>
  )
}

export default function CalendarCoursePage() {
  const s = useCourse('calendar')
  const [faqOpen, setFaqOpen] = useState<number | null>(0)

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <Head>
        <title>Win the Day — สูตรอ่านปฏิทินดวงจีน | Mumate</title>
        <meta name="description" content="เลิกเดาจังหวะชีวิต! รู้วันดี-วันต้องระวังล่วงหน้า ด้วยปฏิทิน Mumate — คอร์สออนไลน์ 13 บทเรียน ดูฟรี 7 บทแรก" />
      </Head>
      <SkyBackdrop />
      <SkyHeader title="Win the Day" backHref="/v2" testId="course" />

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-16 pt-3">
        {/* Section 1 — Hero */}
        <section className="flex flex-col gap-4" data-testid="sale-hero">
          {/* ส่วนหัวแบบที่พลปรับ (2026-10-02): พื้นห้องสมุดโทนเข้ม · แบนเนอร์ม้วนชื่อคอร์ส · มาสคอต · ปุ่มทองบนภาพ */}
          <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-b from-[#1c2547] via-[#27325c] to-[#3a3f6b] px-4 pb-5 pt-5 shadow-xl">
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-25 [background-image:repeating-linear-gradient(90deg,#5b4632_0_18px,#3d2f22_18px_22px,#7a5b3c_22px_34px,#2e241a_34px_38px)] [mask-image:linear-gradient(to_bottom,transparent_30%,black_60%,transparent_95%)]" />
            <div className="relative mx-auto max-w-[92%] rounded-md border-y-4 border-[#c9a45c] bg-[#fbf3df] px-4 py-3 text-center shadow-[0_6px_18px_rgba(0,0,0,0.35)]">
              <h1 className="text-[26px] font-black leading-8 text-v3-navy">Win the Day</h1>
              <p className="mt-1 text-[15px] font-bold leading-6 text-v3-navy">สูตรอ่านปฏิทินดวงจีน รู้ &ldquo;วันดี-วันต้องระวัง&rdquo; ล่วงหน้า</p>
              <p className="text-xs text-v3-text-muted">(อ่านง่ายแม้ไม่มีพื้นฐาน)</p>
            </div>
            <div className="relative mx-auto mt-3 aspect-[1/0.78] w-[86%] overflow-hidden rounded-[20px]">
              <Image src="/images/v2/popup/calendar-course.png" alt="น้องมูเมทถือปฏิทิน" fill priority sizes="(max-width: 448px) 86vw, 380px" className="object-cover object-top" />
            </div>
            <div className="relative mt-4">
              <Cta s={s} label="สมัครเรียน + รับสิทธิ์ใช้แอปฟรี 1 เดือน (เพียง 490.-)" testId="course-buy-hero-top" gold />
            </div>
          </div>
          <div className={CARD}>
            <p className="text-sm font-semibold text-v3-text-muted">หยุดเสียเวลาและพลังงานไปกับวันที่ไม่ใช่...</p>
            <h2 className="mt-1 text-2xl font-black leading-8 text-v3-navy">
              เลิกเดาจังหวะชีวิต! รู้วันดี-วันต้องระวังล่วงหน้า เพื่อผลลัพธ์ที่ดีที่สุดในทุก ๆ วัน ด้วย &ldquo;ปฏิทิน Mumate&rdquo;
            </h2>
            <p className="mt-3 text-sm leading-6 text-v3-text-body">
              คอร์สออนไลน์ที่จะสอนคุณ &ldquo;ถอดรหัสปฏิทินดวงยุคใหม่&rdquo; พร้อมวิธีเลือกกิจกรรมให้ตรงกับพลังงานของวัน วางแผนชีวิตได้แม่นยำขึ้นใน 60 วินาที แม้ไม่มีพื้นฐานโหราศาสตร์
            </p>
            <div className="mt-4">
              <Cta s={s} label="สมัครเรียน + รับสิทธิ์ใช้แอปฟรี 1 เดือน (เพียง 490.-)" testId="course-buy-hero" />
            </div>
            <p className="mt-3 text-center text-xs text-v3-text-muted">🔒 ชำระเงินปลอดภัย · 📱 เข้าเรียนได้ทันที · ♾️ เรียนทบทวนได้ตลอดชีพ</p>
            <p className="mt-1 text-center text-xs font-semibold text-v3-cyan">✅ ดูฟรี 7 บทแรกได้เลย ไม่ต้องสมัคร</p>
          </div>
        </section>

        {/* Section 2 — Agitation */}
        <section className="flex flex-col gap-3 rounded-[24px] bg-v3-bg-cream p-4">
          <h2 className="text-xl font-black leading-7 text-v3-navy">คุณกำลังรู้สึกแบบนี้อยู่หรือเปล่า?</h2>
          {PAINS.map((p) => (
            <div key={p.icon} className="flex gap-3 rounded-2xl bg-white p-4 text-sm leading-6 text-v3-text-body">
              <span className="text-xl">{p.icon}</span>
              <span>{p.text}</span>
            </div>
          ))}
          <p className="text-center text-base font-black leading-7 text-v3-navy">
            ปัญหาไม่ได้อยู่ที่คุณไม่เก่ง แต่อยู่ที่คุณอาจกำลัง &ldquo;ออกแรงในวันที่ทิศทางลมต้าน&rdquo;
          </p>
        </section>

        {/* Section 3 — Solution */}
        <section className={CARD}>
          <h2 className="text-xl font-black leading-7 text-v3-navy">ทุกอย่างจะง่ายขึ้น เมื่อคุณมี &ldquo;เข็มทิศ&rdquo; บอกจังหวะชีวิตในทุก ๆ วัน</h2>
          <p className="mt-2 text-sm leading-6 text-v3-text-body">
            คอร์ส &ldquo;ปฏิทิน Mumate&rdquo; คือหลักสูตรที่ย่อยศาสตร์ Bazi (ปาจื่อ) ที่ซับซ้อน ให้กลายเป็นเครื่องมือที่ใช้งานง่ายที่สุดในชีวิตประจำวัน
            คุณจะไม่ต้องเดาอีกต่อไปว่าวันไหนควรลุย วันไหนควรพัก หรือวันไหนควรระวังตัวเป็นพิเศษ
          </p>
        </section>

        {/* Section 4 — Curriculum */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-black leading-7 text-v3-navy">เจาะลึกสิ่งที่คุณจะได้เรียนรู้ (นำไปใช้จริงได้ทันที)</h2>
          {s.status === 'error' ? <p className="text-center text-sm text-v3-error">โหลดรายการบทเรียนไม่สำเร็จ ลองรีเฟรชอีกครั้ง</p> : null}
          {s.status === 'ok' ? <EpisodeList course={COURSE} episodes={s.episodes} access={s.access} /> : null}
          <Cta s={s} label="ปลดล็อกเนื้อหาทั้งหมดนี้ ในราคาเพียง 490.-" testId="course-buy-mid" />
        </section>

        {/* Section 5 — Bonus */}
        <section className="rounded-[24px] border-2 border-[#d4a63a] bg-gradient-to-b from-[#fff8e6] to-white p-5">
          <p className="text-xs font-black tracking-wide text-[#b8862a]">🎁 FREE 1 MONTH</p>
          <h2 className="mt-1 text-xl font-black leading-7 text-v3-navy">พิเศษ! ไม่ใช่แค่คอร์สเรียน แต่เราให้ &ldquo;เครื่องมือ&rdquo; คุณไปใช้ลงมือทำจริง</h2>
          <p className="mt-2 text-sm leading-6 text-v3-text-body">
            ทฤษฎีจะไม่มีประโยชน์หากไม่ได้ลงมือทำ! สมัครเรียนวันนี้ รับสิทธิ์ใช้งานแอป <b>Mumate Plus ฟรี 1 เดือนเต็ม</b>
          </p>
          <ul className="mt-3 space-y-1 text-sm leading-6 text-v3-navy">
            <li>✨ ให้ระบบ AI ของแอปช่วยประมวลผลดวงจีนที่ซับซ้อนแทนคุณ</li>
            <li>✨ ดูเกรดรายวัน สีมงคลเฉพาะตัว และทิศทางแบบเรียลไทม์</li>
            <li>✨ ใช้งานควบคู่กับบทเรียนได้ทันทีตั้งแต่นาทีแรกที่เข้าเรียน</li>
          </ul>
        </section>

        {/* Section 6 — Value stack */}
        <section className={CARD}>
          <h2 className="text-xl font-black leading-7 text-v3-navy">สรุปสิ่งที่คุณจะได้รับทั้งหมดในวันนี้...</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm leading-6 text-v3-text-body">
            <li className="flex justify-between gap-3"><span>คอร์สออนไลน์ ปฏิทิน Mumate 13 บทเรียน (เรียนซ้ำได้ตลอดชีพ)</span><span className="flex-none">มูลค่า 990.-</span></li>
            <li className="flex justify-between gap-3"><span>[โบนัส] สิทธิ์ใช้งาน Mumate Plus 1 เดือน</span><span className="flex-none">มูลค่า 99.-</span></li>
          </ul>
          <hr className="my-3 border-v3-border-card" />
          <p className="text-center text-sm text-v3-text-muted">มูลค่ารวมทั้งหมด <s>1,089 บาท</s></p>
          <p className="mt-1 text-center text-3xl font-black text-v3-navy">วันนี้ จ่ายเพียง 490 บาท</p>
          <div className="mt-4">
            <Cta s={s} label="สมัครเรียน + รับสิทธิ์ใช้ Mumate Plus ฟรี 1 เดือน" testId="course-buy-value" />
          </div>
        </section>

        {/* Section 7 — FAQ */}
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-black leading-7 text-v3-navy">คำถามที่พบบ่อย (FAQ)</h2>
          {FAQ.map((f, i) => (
            <div key={f.q} className="rounded-2xl bg-white drop-shadow-[0_2px_8px_rgba(26,38,77,0.08)]">
              <button type="button" onClick={() => setFaqOpen(faqOpen === i ? null : i)} className="flex w-full items-center justify-between gap-3 p-4 text-left text-sm font-bold text-v3-navy" aria-expanded={faqOpen === i}>
                <span>Q: {f.q}</span>
                <span className="flex-none text-v3-text-muted">{faqOpen === i ? '−' : '+'}</span>
              </button>
              {faqOpen === i ? <p className="px-4 pb-4 text-sm leading-6 text-v3-text-body">{f.a}</p> : null}
            </div>
          ))}
        </section>

        {/* Section 8 — Final CTA */}
        <section className="rounded-[24px] bg-v3-navy p-6 text-center text-white">
          <h2 className="text-xl font-black leading-7">อย่าปล่อยให้ความสำเร็จของคุณ ต้องพึ่งพาแค่ความบังเอิญอีกต่อไป</h2>
          <p className="mt-2 text-sm leading-6 text-white/80">เริ่มต้นออกแบบจังหวะชีวิตล่วงหน้า ในราคาที่คุ้มค่ากว่ากาแฟไม่กี่แก้ว</p>
          <div className="mt-4">
            <Cta s={s} label="สมัครเรียนตอนนี้เลย (490 บาท)" testId="course-buy-final" gold />
          </div>
          <p className="mt-3 text-xs text-white/60">สมาชิก Mumate + / Pro แบบชำระเงิน เรียนได้เลยไม่ต้องซื้อ (สิทธิ์ฟรีจากโค้ดกิจกรรมไม่รวม)</p>
        </section>
      </main>
    </div>
  )
}
