// features/v2-service/components/OneBookScreen.tsx — /v2/service/one-book
// "YOUR LIFE CODE — คู่มือดวงจีนเฉพาะบุคคล" (หนังสือเล่มเดียวในโลก). Rebuild ตาม Figma 55666-3969 (2026-09-10):
// hero book → stats → pain points → "ไม่ใช่คำทำนาย" → 3 ศาสตร์ → คน 5 ธาตุ → 15 หัวข้อ → เทียบราคา →
// ได้อะไรบ้าง+ของแถม → วันนี้ ฿1,890 → ตัวอย่าง 3 หน้า → เหมาะกับคุณ → รีวิว → FAQ → CTA + แถบล่างฟิกซ์.
// วิเคราะห์โดยซินแส (สั่งทำ) → ทุก CTA ไป LINE OA. asset: book hero เดิม + มาสคอต 5 ธาตุ (referral/*).
import Head from "next/head"
import Image from "next/image"
import { useState } from "react"

import { SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { MateAIButton } from "@/features/v2-shell/components/MateAIButton"
import { TopBarBell } from "@/features/v2-shell/components/TopBarBell"
import { TopBarAvatar } from "@/features/v2-shell/components/TopBarAvatar"

const LINE_ORDER_URL = "https://line.me/R/ti/p/@082cvuiy?ts=09151109&oat_content=url"
const CARD = "v3-shadow-card w-full rounded-[24px] bg-white p-5"

const PAINS = [
  ["ทุ่มเทเต็มที่แต่ผลลัพธ์ไม่มา", "ทำเยอะกว่าคนอื่น แต่ได้น้อยกว่า"],
  ["ตัดสินใจครั้งใหญ่แล้วพลาดทุกที", "เปลี่ยนงาน ลงทุน ย้ายบ้าน ผิดจังหวะเสมอ"],
  ["เก่งแต่ไม่มีใครเห็น", "ผลงานดีแต่โอกาสไปตกที่คนอื่น"],
  ["เหนื่อยกับความสัมพันธ์เดิม ๆ", "เจอคนแบบเดิมซ้ำแล้วซ้ำอีก"],
  ["เงินเข้าเยอะแต่ไม่เหลือ", "หาได้มากขึ้นแต่เก็บไม่อยู่"],
  ["รู้สึกว่าตัวเองยังไม่ใช่", "ทำได้ทุกอย่าง แต่ไม่รู้ว่าอะไรคือของเรา"],
] as const

const SCIENCES = [
  ["ปาจื๋อ (BaZi) ตาราง 8 ช่อง", "คำนวณจากปี เดือน วัน และยามเกิดของคุณ ไม่ใช่แค่ราศี"],
  ["เบญจธาตุและความสัมพันธ์", "ดูว่าธาตุไหนเสริมคุณ ธาตุไหนบั่นทอน และควรใช้ธาตุใดนำ"],
  ["วัฏจักรและช่วงวัย", "บอกจังหวะขึ้นลงของชีวิตเป็นช่วง ๆ ไม่ใช่ดวงรายวัน"],
] as const

const ELEMENTS = [
  { key: "wood", label: "ธาตุไม้", trait: "เติบโต ริเริ่ม ชอบเริ่มสิ่งใหม่", tone: "bg-[#EAF7EA] text-[#4E9A4A]" },
  { key: "fire", label: "ธาตุไฟ", trait: "ร้อนแรง ดึงดูดคน ตัดสินใจไว", tone: "bg-[#FCE9F0] text-[#B0568A]" },
  { key: "earth", label: "ธาตุดิน", trait: "มั่นคง อดทน เป็นที่พึ่งของคนอื่น", tone: "bg-[#FBF3DE] text-[#B08A3B]" },
  { key: "metal", label: "ธาตุทอง", trait: "ละเอียด มีวินัย ชอบความถูกต้อง", tone: "bg-[#F1F1F4] text-[#6B6B76]" },
  { key: "water", label: "ธาตุน้ำ", trait: "ยืดหยุ่น ปรับตัวเก่ง คิดลึก", tone: "bg-[#EAF3FF] text-v3-sapphire" },
] as const

const TOPICS = [
  "พื้นฐานบุคลิกและตัวตนที่แท้จริง", "จุดแข็งที่ควรใช้ให้เต็มที่", "จุดอ่อนที่ต้องระวัง",
  "อาชีพและงานที่เหมาะกับธาตุคุณ", "จังหวะการเงินและการลงทุน", "แบบแผนความรักและคู่ที่เหมาะ",
  "ความสัมพันธ์ในครอบครัว", "สุขภาพและอวัยวะที่ควรดูแล", "ปีที่ควรรุกและปีที่ควรตั้งรับ",
  "สีและทิศมงคลเฉพาะคุณ", "สิ่งศักดิ์สิทธิ์ที่คุ้มครองดวงชะตา", "คนที่ควรคบและควรเลี่ยง",
  "ช่วงวัยที่ดวงเปลี่ยน", "วิธีเสริมดวงด้วยธาตุที่ขาด", "แผนที่ชีวิต 10 ปีข้างหน้า",
]

const SPENT = [
  ["ดูดวงกับหมอดู 3 ครั้ง", "฿4,500"],
  ["ดูดวงออนไลน์ 8 ครั้ง", "฿2,400"],
  ["เครื่องรางและของเสริมดวง", "฿1,100"],
] as const

const INCLUDED = [
  ["หนังสือเฉพาะคุณ 40+ หน้า", "฿2,890"],
  ["BaZi Life Matrix ออนไลน์", "฿499"],
  ["อัปเดตดวงประจำปี 1 ปี", "฿990"],
  ["ปรึกษาซินแสทางแชท 1 ครั้ง", "฿590"],
] as const

const FITS = [
  "กำลังจะตัดสินใจเรื่องใหญ่ในปีนี้", "เบื่อการดูดวงที่ฟังแล้วลืม",
  "อยากรู้ว่าตัวเองเหมาะกับงานแบบไหน", "กำลังหาจังหวะลงทุนหรือเปลี่ยนงาน",
  "อยากเข้าใจตัวเองมากขึ้น", "อยากมีคู่มือที่กลับมาอ่านได้ตลอด",
]

const REVIEWS = [
  ["อ่านแล้วเข้าใจว่าทำไมตัวเองเปลี่ยนงานบ่อย ไม่ใช่เพราะไม่อดทน แต่เพราะเลือกงานที่ขัดกับธาตุตัวเอง", "คุณแพรวา · ธาตุไม้"],
  ["ชอบตรงที่มีตารางคำนวณให้ดูด้วย ไม่ใช่แค่บอกว่าดวงดีหรือไม่ดี ตรวจสอบย้อนกลับได้", "คุณบอส · ธาตุทอง"],
  ["ส่วนแผนที่ชีวิต 10 ปีทำให้วางแผนได้จริง รู้ว่าปีไหนควรรุก ปีไหนควรอยู่นิ่ง", "คุณมิ้นท์ · ธาตุน้ำ"],
] as const

const FAQ = [
  ["ต้องรู้เวลาเกิดแม่นแค่ไหน", "ยิ่งแม่นยิ่งดี (ระดับชั่วโมง) แต่ถ้าจำได้คร่าว ๆ ก็วิเคราะห์ได้ ทีมงานจะช่วยปรับให้เหมาะที่สุด"],
  ["ใช้เวลาผลิตกี่วัน", "ปกติ 3–5 วันทำการหลังยืนยันข้อมูลวันเวลาเกิด (ซินแสวิเคราะห์เอง ไม่ใช่ AI)"],
  ["ถ้าไม่พอใจขอคืนเงินได้ไหม", "เป็นงานวิเคราะห์เฉพาะบุคคล จึงเริ่มผลิตหลังชำระ ทักไลน์เพื่อสอบถามเงื่อนไขก่อนสั่งได้"],
  ["ต่างจากดูดวงกับหมอดูยังไง", "ได้เป็นเล่มคู่มือที่กลับมาอ่านซ้ำได้ตลอดชีพ คำนวณจากดวงจริงของคุณ ไม่ใช่คำทำนายจำ ๆ"],
  ["ซื้อเป็นของขวัญให้คนอื่นได้ไหม", "ได้ เพียงแจ้งวันเวลาเกิดของผู้รับ เหมาะเป็นของขวัญพิเศษเฉพาะบุคคล"],
  ["ข้อมูลวันเกิดปลอดภัยไหม", "ใช้เพื่อคำนวณดวงของคุณเท่านั้น ไม่เปิดเผยต่อบุคคลอื่น"],
]

function Stars() {
  return <span className="text-[14px] tracking-[2px] text-v3-pumpkin">★★★★★</span>
}

function OrderCta({ label = "สั่งซื้อเลย", testId }: { label?: string; testId?: string }) {
  return (
    <a href={LINE_ORDER_URL} target="_blank" rel="noopener noreferrer" data-testid={testId}
      className="grid h-12 w-full place-items-center rounded-full bg-v3-grade-yellow text-[15px] font-bold text-v3-navy">
      {label}
    </a>
  )
}

export function OneBookScreen() {
  const [faq, setFaq] = useState<number | null>(null)

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-v3-bg-cream font-ibm">
      <SkyBackdrop height={420} />
      <Head><title>Your Life Code · คู่มือดวงจีนเฉพาะบุคคล · MuMate</title></Head>

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-28 pt-1">
        <SkyHeader
          title="Your life code"
          backHref="/v2/service"
          testId="one-book"
          right={<span className="flex items-center gap-2"><TopBarBell variant="solid" href="/v2/calendar/notifications" /><TopBarAvatar variant="sapphire" href="/v2/account" /></span>}
        />
        {/* HERO — หนังสือตั้งทับขอบบนกรอบน้ำเงิน (ครึ่งบนโผล่พ้นกรอบ) + glow ด้านหลัง */}
        <section className="relative mt-[68px]" data-testid="one-book-hero">
          <div className="pointer-events-none absolute -top-[68px] left-1/2 z-10 flex w-[48%] max-w-[180px] -translate-x-1/2 justify-center select-none">
            <span aria-hidden className="absolute left-1/2 top-[55%] -z-10 size-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25 blur-2xl" />
            <span aria-hidden className="absolute left-1/2 top-[55%] -z-10 size-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-v3-lime/25 blur-xl" />
            <Image src="/images/v2/features/one-book/book.png" alt="YOUR LIFE CODE · คู่มือดวงจีนเฉพาะบุคคล" width={536} height={578} className="h-auto w-full drop-shadow-[0_18px_34px_rgba(0,0,0,.4)]" priority />
          </div>
          <div className="flex flex-col items-center gap-3 rounded-[24px] bg-v3-sapphire px-5 pb-6 pt-[104px] text-center text-white">
            <div>
              <h1 className="text-[27px] font-black leading-9 text-v3-lime">คู่มือระดับ 1 ของชีวิตคุณ</h1>
              <p className="text-[18px] font-black tracking-[0.14em] text-white">YOUR LIFE CODE</p>
            </div>
            <p className="text-[13px] leading-5 text-white/85">หนังสือเล่มเดียวในโลกที่คำนวณจากวันเดือนปี<br />และเวลาเกิดของคุณ ไม่ซ้ำกับใคร</p>
            <p className="flex items-baseline justify-center gap-2">
              <span className="text-[16px] font-medium text-white/50 line-through">฿2,890</span>
              <span className="text-[32px] font-black text-v3-lime">฿1,890</span>
            </p>
            <OrderCta testId="one-book-order-hero" />
          </div>
        </section>

        {/* STATS */}
        <section className={`${CARD} flex items-center justify-around text-center`} data-testid="one-book-stats">
          {[["15", "หัวข้อชีวิต"], ["11", "ศาสตร์ที่ใช้คำนวณ"], ["40+", "หน้าเฉพาะคุณ"]].map(([n, l]) => (
            <div key={l} className="flex flex-col">
              <span className="text-[22px] font-black text-v3-sapphire">{n}</span>
              <span className="text-[12px] text-v3-text-muted">{l}</span>
            </div>
          ))}
        </section>

        {/* PAIN POINTS */}
        <section className="flex flex-col gap-3">
          <h2 className="text-center text-[18px] font-black leading-7 text-v3-navy">เคยเป็นแบบนี้ไหม<br />ทั้งที่รู้ตัวเองดีแล้ว<br />แต่ยังตัดสินใจผิดซ้ำ ๆ</h2>
          {PAINS.map(([t, s]) => (
            <div key={t} className="flex items-start gap-3 rounded-2xl bg-white p-4 v3-shadow-card">
              <span aria-hidden className="mt-0.5 flex-none text-v3-pumpkin">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M8.5 15.5c.9-1.2 2.1-1.8 3.5-1.8s2.6.6 3.5 1.8" strokeLinecap="round" /><path d="M9 9.5h.01M15 9.5h.01" strokeLinecap="round" /></svg>
              </span>
              <div><p className="text-[14px] font-bold text-v3-navy">{t}</p><p className="text-[12px] leading-5 text-v3-text-muted">{s}</p></div>
            </div>
          ))}
          <p className="text-center text-[13px] font-bold leading-5 text-v3-sapphire">ถ้าตอบว่าใช่มากกว่า 3 ข้อ<br />แปลว่าคุณกำลังฝืนแบบแผนของตัวเองอยู่</p>
        </section>

        {/* NOT JUST FORTUNE */}
        <section className="flex flex-col gap-3 rounded-[24px] bg-v3-sapphire p-5 text-white">
          <h2 className="text-[18px] font-black leading-7">เพราะคุณไม่ใช่แค่ “คำทำนาย”<br />และไม่ใช่แค่ “ดวงชะตา”</h2>
          <p className="text-[13px] font-bold text-v3-lime">YOUR LIFE CODE</p>
          <p className="text-[13px] leading-5 text-white/85">ไม่ได้บอกว่าอนาคตจะเป็นยังไง แต่บอกว่าคุณถูกออกแบบมาแบบไหน และควรเดินด้วยจังหวะของใคร</p>
          <OrderCta label="สั่งซื้อเลย YOUR LIFE CODE" />
        </section>

        {/* 3 SCIENCES */}
        <section className="flex flex-col gap-3">
          <h2 className="text-center text-[18px] font-black leading-7 text-v3-navy">ไม่ใช่คำทำนายลอย ๆ<br />ศาสตร์เก่าแก่ + การคำนวณที่ตรวจสอบย้อนกลับได้</h2>
          {SCIENCES.map(([t, s]) => (
            <div key={t} className="flex items-center gap-3 rounded-2xl bg-white p-4 v3-shadow-card">
              <span className="relative size-14 flex-none"><Image src="/images/v2/home/sian/oracle.png" alt="" fill sizes="56px" className="object-contain" /></span>
              <div><p className="text-[15px] font-bold text-v3-navy">{t}</p><p className="text-[12px] leading-5 text-v3-text-muted">{s}</p></div>
            </div>
          ))}
        </section>

        {/* 5 ELEMENTS */}
        <section className={CARD} data-testid="one-book-elements">
          <h2 className="text-center text-[18px] font-black text-v3-navy">คน 5 ธาตุ ต่างกันยังไง</h2>
          <div className="mt-3 flex flex-col gap-2.5">
            {ELEMENTS.map((e) => (
              <div key={e.key} className="flex items-center gap-3">
                <span className="relative size-11 flex-none overflow-hidden rounded-full bg-v3-ghost-white">
                  <Image src={`/images/v2/referral/mascot-${e.key}.png`} alt="" fill sizes="44px" className="object-contain" />
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${e.tone}`}>{e.label}</span>
                <span className="min-w-0 flex-1 text-[13px] leading-5 text-v3-text-body">{e.trait}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-[12px] leading-5 text-v3-sapphire">หนังสือของคุณจะบอกว่าคุณเป็นธาตุอะไร และควรใช้ธาตุไหนช่วยเสริม</p>
        </section>

        {/* 15 TOPICS */}
        <section className={CARD} data-testid="one-book-topics">
          <p className="text-center text-[12px] text-v3-text-muted">ข้างในมีอะไร</p>
          <h2 className="text-center text-[18px] font-black text-v3-navy">15 หัวข้อ ครบทุกมิติชีวิต</h2>
          <div className="mt-3 flex flex-col divide-y divide-v3-border-card">
            {TOPICS.map((t, i) => (
              <div key={t} className="flex items-center gap-3 py-2.5">
                <span className="grid size-6 flex-none place-items-center rounded-full bg-v3-lime text-[12px] font-black text-v3-navy">{i + 1}</span>
                <span className="text-[13px] leading-5 text-v3-text-body">{t}</span>
              </div>
            ))}
          </div>
        </section>

        {/* PRICE COMPARE */}
        <section className={CARD}>
          <h2 className="text-center text-[18px] font-black leading-7 text-v3-navy">ปีที่ผ่านมาคุณจ่ายค่าดูดวง<br />ไปแล้วเท่าไหร่</h2>
          <div className="mt-3 flex flex-col gap-2">
            {SPENT.map(([t, p]) => (
              <div key={t} className="flex items-center justify-between border-b border-dashed border-v3-divider-dashed pb-2 text-[13px]"><span className="text-v3-text-body">{t}</span><span className="font-bold text-v3-navy">{p}</span></div>
            ))}
            <div className="flex items-center justify-between pt-1"><span className="text-[14px] font-bold text-v3-navy">รวมที่จ่ายไปแล้ว</span><span className="text-[20px] font-black text-v3-pumpkin">฿8,000</span></div>
          </div>
          <p className="mt-3 text-center text-[12px] leading-5 text-v3-text-muted">ได้คำตอบเป็นครั้ง ๆ ที่จำไม่ได้ว่าใครบอกอะไร และไม่มีอะไรให้กลับมาอ่าน</p>
        </section>

        {/* INCLUDED */}
        <section className={CARD}>
          <h2 className="text-center text-[18px] font-black text-v3-navy">YOUR LIFE CODE ให้อะไรบ้าง</h2>
          <div className="mt-3 flex flex-col gap-2">
            {INCLUDED.map(([t, p]) => (
              <div key={t} className="flex items-center justify-between border-b border-dashed border-v3-divider-dashed pb-2 text-[13px] last:border-0"><span className="text-v3-text-body">{t}</span><span className="font-bold text-v3-navy">{p}</span></div>
            ))}
          </div>
        </section>

        {/* ของแถม BaZi Life Matrix — กล่องแยก, ใช้ภาพเดียวกับกล่อง BaZi Life Matrix บนหน้าแรก */}
        <section className="flex items-center gap-3 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#F3E9FB] to-[#E7F0FF] p-4 v3-shadow-card" data-testid="one-book-bonus">
          <span className="relative size-20 flex-none">
            <Image src="/images/v2/home/%E0%B9%80%E0%B8%A3%E0%B8%B5%E0%B8%A2%E0%B8%99%E0%B8%9B%E0%B8%B2%E0%B8%88%E0%B8%B7%E0%B9%88%E0%B8%AD.png" alt="BaZi Life Matrix" fill sizes="80px" className="object-contain" />
          </span>
          <div className="min-w-0">
            <p className="inline-block rounded-full bg-v3-purple/15 px-2 py-0.5 text-[11px] font-bold text-v3-purple">ของแถมส่งวันนี้</p>
            <p className="mt-1 text-[15px] font-black text-v3-navy">BaZi Life Matrix ออนไลน์</p>
            <p className="text-[12px] leading-5 text-v3-text-body">ตารางธาตุแบบโต้ตอบได้ เปิดดูบนมือถือได้ตลอดชีวิต มูลค่า ฿499</p>
          </div>
        </section>

        {/* TODAY PRICE BAND */}
        <section className="relative flex flex-col items-center gap-3 overflow-hidden rounded-[24px] bg-v3-sapphire px-5 py-6 text-center text-white">
          <p className="text-[13px] text-white/80">รวมมูลค่า ฿4,969</p>
          <p className="text-[26px] font-black text-v3-lime">วันนี้เพียง ฿1,890</p>
          <OrderCta />
        </section>

        {/* PREVIEW */}
        <section className="flex flex-col gap-3">
          <h2 className="text-center text-[18px] font-black text-v3-navy">ดูตัวอย่างหน้าจริงในเล่ม</h2>
          <div className="flex gap-3">
            {["ตาราง 8 ช่อง", "บุคลิกและจุดแข็ง", "แผนที่ชีวิต 10 ปี"].map((t) => (
              <div key={t} className="flex flex-1 flex-col items-center gap-2">
                <div className="aspect-[3/4] w-full rounded-xl border border-v3-border-card bg-white" />
                <span className="text-center text-[11px] leading-4 text-v3-text-muted">{t}</span>
              </div>
            ))}
          </div>
        </section>

        {/* FITS */}
        <section className={CARD}>
          <h2 className="text-center text-[18px] font-black text-v3-navy">เล่มนี้เหมาะกับคุณ ถ้า</h2>
          <div className="mt-3 flex flex-col gap-2">
            {FITS.map((t) => (
              <div key={t} className="flex items-center gap-3 rounded-full bg-v3-ghost-white px-3 py-2">
                <span className="grid size-5 flex-none place-items-center rounded-full bg-[#EAF7EA] text-[11px] text-[#4E9A4A]">✓</span>
                <span className="text-[13px] text-v3-text-body">{t}</span>
              </div>
            ))}
          </div>
        </section>

        {/* REVIEWS */}
        <section className="flex flex-col gap-3">
          <h2 className="text-center text-[18px] font-black text-v3-navy">เสียงจากคนที่ได้อ่านแล้ว</h2>
          {REVIEWS.map(([r, who]) => (
            <div key={who} className="rounded-2xl bg-white p-4 v3-shadow-card">
              <Stars />
              <p className="mt-1 text-[13px] leading-5 text-v3-text-body">{r}</p>
              <p className="mt-1 text-[11px] text-v3-text-muted">{who}</p>
            </div>
          ))}
        </section>

        {/* FAQ */}
        <section className={CARD} data-testid="one-book-faq">
          <h2 className="text-center text-[18px] font-black text-v3-navy">คำถามที่พบบ่อย</h2>
          <div className="mt-2 flex flex-col divide-y divide-v3-border-card">
            {FAQ.map(([q, a], i) => {
              const open = faq === i
              return (
                <div key={q} className="py-1">
                  <button type="button" onClick={() => setFaq(open ? null : i)} aria-expanded={open} className="flex w-full items-center gap-2 py-2 text-left">
                    <span className="min-w-0 flex-1 text-[14px] font-medium text-v3-navy">{q}</span>
                    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`flex-none text-v3-text-muted transition-transform ${open ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                  {open && <p className="pb-2 text-[13px] leading-5 text-v3-text-body">{a}</p>}
                </div>
              )
            })}
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="flex flex-col items-center gap-3 rounded-[24px] bg-v3-sapphire px-5 py-7 text-center text-white">
          <h2 className="text-[22px] font-black leading-8">พร้อมอ่านคู่มือ<br />ของตัวเองหรือยัง</h2>
          <p className="text-[14px] font-bold text-v3-lime">YOUR LIFE CODE</p>
          <p className="text-[12px] leading-5 text-white/80">คำนวณจากวันเดือนปีและเวลาเกิดของคุณ ไม่ซ้ำกับใครในโลก</p>
          <p className="flex items-baseline justify-center gap-2"><span className="text-[15px] text-white/50 line-through">฿2,890</span><span className="text-[26px] font-black text-v3-lime">฿1,890</span></p>
          <OrderCta />
        </section>
      </div>

      {/* แถบล่างฟิกซ์: สั่งซื้อเลย + Mate AI (ตาม Figma) */}
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <a href={LINE_ORDER_URL} target="_blank" rel="noopener noreferrer" data-testid="one-book-order" className="grid h-[52px] min-w-0 flex-1 place-items-center rounded-full bg-v3-sapphire text-[15px] font-bold text-white v3-shadow-card">สั่งซื้อเลย</a>
        <span className="flex-none"><MateAIButton /></span>
      </div>
    </div>
  )
}

export default OneBookScreen
