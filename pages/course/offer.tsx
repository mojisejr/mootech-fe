// /course/offer — ข้อเสนอ "ก่อนจ่าย" ของคอร์ส Win the Day (พล 2026-10-02) — จ่ายครั้งเดียวตามที่เลือก
//   ?step=up   (80%) Upsell   เอา → COURSE_BUNDLE_790 (490+300: ปฏิทิน + Bazi Life Matrix + Mumate + 1 ปี)
//   ?step=down (90%) Downsell เอา → COURSE_BUNDLE_689 (490+199: ปฏิทิน + Bazi Life Matrix + Mumate + 1 เดือน)
//   ไม่เอาทั้งคู่ → COURSE_CAL_490 (ปฏิทิน + Mumate + 1 เดือน)
// ข้อความตามเอกสาร sale page ของพล (ปรับประโยคต้อนรับให้เข้ากับ "ก่อนจ่าย")
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { SkyBackdrop } from '@/features/v2-profile/components/kit'
import { CARD } from '@/features/course/EpisodeList'
import { checkoutHrefFor } from '@/lib/course/content'

const MATRIX_POINTS = [
  'บทที่ 01-03 รื้อถอนโครงสร้างตัวเอง: เข้าใจวงจรพลังงาน 5 ธาตุในตัวคุณเพื่อหาจุดสมดุล วางแผนชีวิตแบบไม่ฝืนธรรมชาติ',
  'บทที่ 04-06 คัมภีร์สแกนมนุษย์ & วิธีเซฟตัวเอง: ถอดรหัสบุคลิกคน 10 แบบ และเช็กจุดปะทะ/ขัดแย้งล่วงหน้า',
  'บทที่ 07-10 ภาคปฏิบัติเช็กพลังดวง: วัดความแรงชะตา 12 ระยะ (เชี่ยงแซ) รู้ว่าคุณดิถีแข็ง/สมดุล หรืออ่อน',
  'บทที่ 11-12 เจาะลึกถังซำซิ่ว อาชีพ & การเงิน: อ่านดาวการเงิน (Cai) และดาวอาชีพ (Guan/Sha) เก็บเงินให้อยู่หมัด',
  'บทที่ 13-15 ปรับ Vibe รอบตัว & แมชชิ่งขั้นเซียน: สีมงคล/ทิศโต๊ะทำงาน, สแกนคู่แท้/หุ้นส่วน และเซียมซี Advance',
]

function Progress({ pct, text }: { pct: number; text: string }) {
  return (
    <div className="w-full" data-testid="offer-progress">
      <p className="mb-1 text-center text-xs font-bold text-v3-navy">{text} ({pct}%)</p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-v3-border-card">
        <div className="h-full rounded-full bg-v3-cyan" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function CourseOfferPage() {
  const router = useRouter()
  const step = router.query.step === 'down' ? 'down' : 'up'

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <Head>
        <title>ข้อเสนอพิเศษ · Mumate</title>
      </Head>
      <SkyBackdrop />
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
        {step === 'up' ? (
          <>
            <Progress pct={80} text="รอเดี๋ยวก่อน การสั่งซื้อของคุณยังไม่เสร็จสมบูรณ์" />
            <section className={CARD} data-testid="offer-up">
              <h1 className="text-xl font-black leading-8 text-v3-navy">
                เดี๋ยวก่อน... อย่าเพิ่งปิดหน้านี้! ต่อยอดการอ่านดวงชะตาให้ลึกซึ้งขั้นสุด พร้อมรับสิทธิ์ใช้งานแอปยาวตลอด 1 ปีเต็ม
              </h1>
              <p className="mt-3 text-sm leading-6 text-v3-text-body">
                คุณกำลังจะได้รับคอร์สปฏิทิน Mumate และแอปฟรี 1 เดือน! เครื่องมือบอก &ldquo;จังหวะเวลา&rdquo; ที่ดีที่สุดจะอยู่ในมือคุณ
                แต่จะดีกว่าไหม... ถ้าคุณสามารถ &ldquo;ถอดรหัสโครงสร้างชีวิต&rdquo; ของตัวเองและคนรอบข้าง เพื่อรู้จุดแข็ง จุดอ่อน และวิธีดึงศักยภาพสูงสุดออกมาใช้ได้ด้วย?
              </p>
              <p className="mt-3 rounded-2xl bg-[#fff8e6] p-3 text-sm font-bold leading-6 text-v3-navy">
                One-Time Offer (สิทธิ์เฉพาะหน้านี้เท่านั้น): รับคอร์ส Bazi Life Matrix (ราคาปกติ 499 บาท) + อัปเกรด Mumate Plus จาก 1 เดือน เป็น 1 ปีเต็ม!
              </p>
              <p className="mt-3 text-sm font-bold text-v3-navy">สิ่งที่คุณจะได้จาก 15 บทเรียน Bazi Life Matrix:</p>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-v3-text-body">
                {MATRIX_POINTS.map((p) => <li key={p}>✅ {p}</li>)}
              </ul>
              <p className="mt-4 text-center text-sm text-v3-text-body">จ่ายเพิ่มเพียง <b className="text-2xl text-v3-navy">300 บาท</b> (ยอดรวม 790 บาท)</p>
              <Link href={checkoutHrefFor('COURSE_BUNDLE_790')} data-testid="offer-up-yes" className="mt-3 grid min-h-14 w-full place-items-center rounded-full bg-v3-sapphire px-4 text-center text-base font-bold text-white shadow-lg">
                ✅ ใช่! ฉันรับข้อเสนอนี้ อัปเกรดเป็นแพ็กเกจ 790 บาท
              </Link>
              <button type="button" data-testid="offer-up-no" onClick={() => void router.replace('/course/offer?step=down')} className="mt-3 w-full text-center text-xs leading-5 text-v3-text-muted underline">
                ไม่ ขอบคุณ ฉันขอใช้แอปแค่ 1 เดือน และยอมพลาดโอกาสเรียนคอร์ส Bazi Life Matrix ในราคานี้
              </button>
            </section>
          </>
        ) : (
          <>
            <Progress pct={90} text="ข้อเสนอสุดท้ายก่อนเข้าสู่บทเรียน" />
            <section className={CARD} data-testid="offer-down">
              <h1 className="text-xl font-black leading-8 text-v3-navy">
                เข้าใจครับว่าคุณอาจจะอยากลองใช้แอปแค่ 1 เดือนดูก่อน... ถ้างั้นรับ &ldquo;คัมภีร์ถอดรหัสชีวิต&rdquo; สิทธิพิเศษสุดท้ายนี้ไปแทนไหมครับ?
              </h1>
              <p className="mt-3 text-sm leading-6 text-v3-text-body">
                เพื่อให้คุณนำความรู้จากคอร์สปฏิทินไปประยุกต์ใช้ได้อย่างเต็มประสิทธิภาพ เราขอเสนอคอร์ส Bazi Life Matrix (ราคาปกติ 499 บาท) 15 บทเรียน
                ทั้งการหาจุดสมดุลธาตุ ถอดรหัสบุคลิกคนรอบข้าง เจาะลึกดาวการเงินอาชีพ ไปจนถึงเทคนิคเลือกสีมงคลและสแกนหุ้นส่วน (เรียนจบดูดวงเบื้องต้นให้เพื่อนได้ทันที)
              </p>
              <p className="mt-4 text-center text-sm text-v3-text-body">
                พิเศษเฉพาะหน้านี้ บวกเพิ่มเพียง <b className="text-2xl text-v3-navy">199 บาท</b>
                <br />
                (ประหยัด 300 บาทจากราคาปกติ · ยอดรวม 689 บาท)
              </p>
              <Link href={checkoutHrefFor('COURSE_BUNDLE_689')} data-testid="offer-down-yes" className="mt-3 grid min-h-14 w-full place-items-center rounded-full bg-v3-sapphire px-4 text-center text-base font-bold text-white shadow-lg">
                ✅ ใช่! ขอรับเฉพาะคอร์ส Bazi Life Matrix (เพิ่ม 199 บาท)
              </Link>
              <Link href={checkoutHrefFor('COURSE_CAL_490')} data-testid="offer-down-no" className="mt-3 block w-full text-center text-xs leading-5 text-v3-text-muted underline">
                ไม่ ขอบคุณ ขอเข้าสู่บทเรียนด้วยแพ็กเกจ 490 บาทเพียงอย่างเดียว
              </Link>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
