// features/v2-service/components/ServiceHubScreen.tsx — "เมนูแนะนำ" (ประชุม 2026-10-27 · Figma Mumate-app_-final 55751:1793)
// 2 กลุ่มไทล์: "ฟีเจอร์ฮอตฮิต" (น้ำเงิน 6 ใบ) + "ไอเทมเสริมดวง" (ฟ้าอมเขียว 5 ใบ) · ไทล์ = ชื่อ (เหลือง) + คำโปรย (ขาว)
// เดิมเป็นการ์ดรูปยาว 12 ใบ (Figma 333:7519) — catalog เดิมยังอยู่ใน services.ts (route/ServiceId ไม่เปลี่ยน)
// testid service-card-<id> คงไว้ให้ทัวร์แนะนำ (features/v2-guide/tourSteps.ts) ส่องไทล์เดิมได้
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { Menubar } from '@/features/v2-shell/components/Menubar'
import { useClientTier } from '@/features/v2-shell/hooks/useClientTier'
import { Reveal } from '@/features/v2-shell/components/Reveal'
import { ServiceHeader } from './ServiceHeader'

type Tile = {
  id: string
  title: string
  sub: string
  href: string
  /** ป้ายมุมขวาบน เช่น "ลด 50%" */
  badge?: string
  /** ไอคอนไฟ "ฮิต" มุมขวาบน */
  hot?: boolean
}

const HOT: readonly Tile[] = [
  { id: 'couple', title: 'ดวงสมพงษ์\nความรัก', sub: 'คู่เราเข้ากันได้ไหม', href: '/v2/service/compatibility/love', hot: true },
  { id: 'coworker', title: 'ดวงสมพงษ์\nเพื่อนร่วมงาน', sub: 'ใครทำงานเข้ากับเราบ้าง', href: '/v2/service/compatibility/colleague' },
  { id: 'oracle-kiang', title: 'ไพ่ออราเคิล', sub: 'ไขข้อข้องใจที่อยากแก้', href: '/v2/fortune/oracle' },
  { id: 'sian', title: 'เสี่ยงเซียมซี', sub: 'รับคำทำนายรายวัน', href: '/v2/fortune/sage' },
  { id: 'sacred-map', title: 'แผนที่ตามไปมู', sub: 'ไหว้ที่ไหนดี ตามดวงคุณ', href: '/v2/service/sacred-map' },
  { id: 'phone-number', title: 'ทายนิสัยจากเบอร์', sub: 'เจ้าของเบอร์เป็นคนแบบไหน', href: '/v2/service/phone-number' },
]

const ITEMS: readonly Tile[] = [
  // Ebook สอนดวงจีน — ยังไม่มีสินค้า/หน้าขาย → coming-soon ไปก่อน (ได้ลิงก์จริงแล้วเปลี่ยน href บรรทัดนี้)
  { id: 'ebook', title: 'Ebook สอนดวงจีน', sub: 'เรียนรู้พื้นฐานด้วยตัวเอง', href: `/v2/service/coming-soon?service=${encodeURIComponent('Ebook สอนดวงจีน')}`, badge: 'ลด 50%' },
  { id: 'course-calendar', title: 'คอร์สปฏิทิน', sub: 'คอร์สเรียนวางแผนชีวิต', href: '/course/calendar' },
  { id: 'sinsae', title: 'ดูดวงกับ ซินแซ', sub: 'ปรึกษาปัญหากับผู้เชี่ยวชาญ', href: '/v2/service/sinsae' },
  { id: 'calendar', title: 'ปฏิทินมงคล', sub: 'เช็ควันดี\nวันมงคลรายเดือน', href: '/v2/calendar' },
  { id: 'one-book', title: 'คู่มือดวงเฉพาะคุณ', sub: 'เล่มเดียวใช้ได้ทั้งชีวิต', href: '/v2/service/one-book' },
]

function TileCard({ t, tone }: { t: Tile; tone: 'hot' | 'item' }) {
  return (
    <Link
      href={t.href}
      data-testid={`service-card-${t.id}`}
      className={`relative flex min-h-[76px] flex-col justify-between gap-1.5 rounded-[14px] px-3 py-2.5 shadow-[0_3px_10px_rgba(26,38,77,0.18)] active:scale-[0.98] ${
        tone === 'hot' ? 'bg-v3-sapphire' : 'bg-v3-chart-teal'
      }`}
    >
      <span className="whitespace-pre-line text-[17px] font-bold leading-[22px] text-v3-lime">{t.title}</span>
      <span className="whitespace-pre-line text-[12px] leading-4 text-white">{t.sub}</span>
      {t.hot ? (
        <span aria-hidden className="absolute -right-1 -top-3 text-[26px] leading-none">🔥</span>
      ) : null}
      {t.badge ? (
        <span className="absolute -top-2.5 right-2 rounded-md bg-[#FF4B1F] px-2 py-0.5 text-[12px] font-bold leading-4 text-white">{t.badge}</span>
      ) : null}
    </Link>
  )
}

function Section({ title, tiles, tone, testId }: { title: string; tiles: readonly Tile[]; tone: 'hot' | 'item'; testId: string }) {
  return (
    <section data-testid={testId} className="flex flex-col gap-2.5">
      <h2 className="px-1 text-[18px] font-bold leading-7 text-v3-navy">{title}</h2>
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map((t, i) => (
          <Reveal key={t.id} delay={(i % 2) * 60}>
            <TileCard t={t} tone={tone} />
          </Reveal>
        ))}
      </div>
    </section>
  )
}

// teamPreview (issue #225): drilled from pages/v2/service.tsx getServerSideProps (?tier= override on prod gate)
export function ServiceHubScreen({ teamPreview = false }: { teamPreview?: boolean }) {
  const tier = useClientTier(teamPreview)
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <Head>
        <title>เมนูแนะนำ · MuMate</title>
      </Head>

      {/* พื้นหลังเต็มจอ ตรึงไว้ (Figma 55751:1793 เมฆคลุมทั้งหน้า) — เดิม BG01 สูง 365px แล้วตัดเป็นขาว เห็นรอยตัดกลางจอ */}
      <div aria-hidden className="pointer-events-none fixed inset-0 select-none">
        <Image src="/images/v2/bg/BG01.png" alt="" fill priority sizes="100vw" style={{ objectFit: 'cover', objectPosition: 'center' }} />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-36 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <ServiceHeader membership={tier} />
        <div data-testid="service-hub-list" className="flex flex-col gap-6">
          <Section title="ฟีเจอร์ฮอตฮิต" tiles={HOT} tone="hot" testId="service-hub-hot" />
          <Section title="ไอเทมเสริมดวง" tiles={ITEMS} tone="item" testId="service-hub-items" />
        </div>
      </div>

      <Menubar />
    </div>
  )
}
