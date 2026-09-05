// features/v2-service/components/OneBookScreen.tsx — /v2/service/one-book
// "Your Life Code — คู่มือดวงจีนเฉพาะบุคคล" (บริการ one-book / หนังสือเล่มเดียวในโลก)
// ไม่มีเฟรมใน Figma → ออกแบบเองตามคอนเทนต์การตลาด (IG carousel) + ภาษาดีไซน์ของแอป (SkyBackdrop/kit).
// วิเคราะห์โดยซินแส (คนจริง ไม่ใช้ AI) → บริการแบบสั่งทำ; CTA "สั่งจองเลย" ไปที่ LINE OA.
import Head from "next/head"
import Image from "next/image"
import { useState } from "react"

import { SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"

const LINE_ORDER_URL = "https://lin.ee/mumate"
const CARD = "v3-shadow-card w-full rounded-[24px] bg-white p-5"

/** จุดเด่น 6 อย่างที่ "รู้รหัสชีวิตแล้วจะรู้" (IG slide 2) */
const KNOW = [
  { icon: "briefcase", text: "งานแบบไหนเหมาะกับคุณ" },
  { icon: "coins", text: "หาเงินจากอะไรได้ดีที่สุด" },
  { icon: "heart", text: "ความสัมพันธ์แบบใดส่งเสริมชีวิต" },
  { icon: "rocket", text: "พรสวรรค์ที่ซ่อนอยู่ในตัวคุณ" },
  { icon: "run", text: "ช่วงเวลาไหนควรรีบคว้าโอกาส" },
  { icon: "clock", text: "ช่วงเวลาไหนควรรอไปก่อน" },
] as const

/** 6 "รหัส" หลักในคู่มือ (IG slide 3) */
const CODES = [
  { en: "Life Direction", th: "ทิศทางชีวิต", tone: "teal" },
  { en: "Career Code", th: "การงาน", tone: "blue" },
  { en: "Wealth Code", th: "การเงิน", tone: "gold" },
  { en: "Relationship Code", th: "ความรัก", tone: "pink" },
  { en: "Talent Code", th: "พรสวรรค์", tone: "amber" },
  { en: "Timing Code", th: "จังหวะชีวิต", tone: "green" },
] as const

const CODE_TONE: Record<string, string> = {
  teal: "bg-[#E3F4F7] text-[#127687]",
  blue: "bg-[#EAF3FF] text-v3-sapphire",
  gold: "bg-[#FBF3DE] text-[#B08A3B]",
  pink: "bg-[#FCE9F0] text-[#B0568A]",
  amber: "bg-[#FFF3E0] text-[#C77800]",
  green: "bg-[#EAF7EA] text-[#4E9A4A]",
}

/** 15 ด้านที่วิเคราะห์เต็ม — หัวข้อ + ประโยคชวนอ่าน (verbatim จากคอนเทนต์) */
const CHAPTERS: Array<{ t: string; hook: string }> = [
  { t: "พื้นฐานดวงชะตาที่ถูกกำหนด", hook: "ทำไมบางเรื่องเราถึงอดทนไม่ได้ ทั้งที่คนอื่นมองว่าเรื่องนิดเดียว — เผยรหัสจิตวิทยาที่ซ่อนในวันเกิดคุณ" },
  { t: "อาชีพ / ธุรกิจ ที่ควรทำ และไม่ควรทำ", hook: "ขยันแทบตายแต่ไม่เคยรวยขึ้น? เช็กด่วนว่าคุณกำลังทำอาชีพที่ ‘พิฆาตดวงชะตา’ ตัวเองอยู่หรือเปล่า" },
  { t: "โชคลาภที่ถูกทาง โอกาสรวยอยู่แค่เอื้อม", hook: "เปิดช่องทางขุมทรัพย์ตามพลังธาตุ ที่เปลี่ยนคนเก็บเงินไม่อยู่ ให้มีเงินเก็บหลักล้าน" },
  { t: "ผู้อุปถัมภ์ที่พร้อมช่วยเหลือคือใคร", hook: "รู้ไหมว่าคุณมี ‘กัลยาณมิตรสายเปย์’ รอหนุนหลังอยู่ แค่ต้องหาเขาให้เจอ" },
  { t: "พรสวรรค์ที่คุณค้นหามาตลอดชีวิต", hook: "คุณอาจกำลังทิ้งเงินหมื่นเงินแสน ถ้ายังไม่รู้ว่ามี ‘พรสวรรค์ลับ’ ซ่อนอยู่ในดวงชะตา" },
  { t: "ครอบครัว พื้นฐานสำคัญของชีวิต", hook: "ทำไมยิ่งคุยยิ่งไม่เข้าใจกัน? ถอดรหัสคลื่นพลังงานในบ้าน ปรับจุดเดียวชีวิตครอบครัวเปลี่ยน" },
  { t: "ความรัก / คู่ครองที่เหมาะสม", hook: "อกหักซ้ำ ๆ เพราะเจอผิดคน? เช็กดวงคู่แท้ก่อนเสียเวลาให้คนผิด ๆ อีกต่อไป" },
  { t: "เพื่อนแท้ ศัตรู คือใคร และควรทำอย่างไร", hook: "คนที่ยิ้มให้วันนี้…หวังดีจริงไหม? สแกนพลังงานรอบตัว ใครคือมิตรพาเจริญ ใครคือคนพาพัง" },
  { t: "หุ้นส่วนควรมีหรือไม่ / ลุยเดี่ยวดีกว่า", hook: "ก่อนเซ็นสัญญาร่วมทุน เช็กก่อนว่าดวงคุณเหมาะกับ ‘ลุยเดี่ยว’ หรือ ‘จับมือแล้วรวย’" },
  { t: "ลูกน้อง บริวารที่ทำให้ธุรกิจรุ่งเรือง", hook: "เปิดเทคนิคคัดคนเข้าทีมตามพลังธาตุ ให้ทำงานแทนเราได้เต็มร้อย" },
  { t: "การเรียนที่ตรงสาย ช่วยให้ร่ำรวยขึ้น", hook: "อย่าเสียเวลาเรียนสิ่งที่ไม่ได้ใช้ เปิดวิชาที่ถูกโฉลกกับดวงคุณ ต่อยอดทำเงินได้ไวที่สุด" },
  { t: "ช่วงอายุที่ดี และช่วงที่ควรระวัง", hook: "ก่อนเปลี่ยนงานหรือลงทุนใหญ่ เช็ก ‘ไทม์ไลน์จังหวะชีวิต’ ว่าปีนี้ควรเหยียบคันเร่งหรือแตะเบรก" },
  { t: "การดูแลสุขภาพ เตรียมความพร้อม", hook: "นอนเท่าไหร่ก็ไม่พอ? เช็กจุดอ่อนของร่างกายตามธาตุเจ้าเรือน ก่อนจะสายเกินแก้" },
  { t: "สี และทิศมงคล (สีกระเป๋า / สีรถ)", hook: "มูตามคนอื่นแล้วไม่เห็นผล เพราะสีและทิศมงคลของคุณไม่เหมือนใคร — เผยสีดูดทรัพย์เฉพาะบุคคล" },
  { t: "องค์เทพที่คุ้มครองดวง หนุนให้สำเร็จ", hook: "ไหว้พระมาทั่วแต่ยังติดขัด? รู้จัก ‘องค์เทพประจำตัว’ ที่พร้อมคุ้มครองดวงคุณโดยเฉพาะ" },
]

const PLANS = [
  { id: "standard", name: "Standard", detail: "ไฟล์ PDF (30+ หน้า) อ่านซ้ำได้ตลอดชีพ", price: "1,890", note: "", best: false },
  { id: "premium", name: "Premium", detail: "เล่มปกอ่อน พิมพ์สี A5 + ไฟล์ PDF", price: "2,390", note: "🚚 จัดส่งฟรี", best: true },
] as const

function KnowIcon({ name }: { name: string }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  switch (name) {
    case "briefcase": return <svg {...common}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
    case "coins": return <svg {...common}><circle cx="8" cy="8" r="5" /><path d="M15 6a5 5 0 1 1 0 10M6 18h12" /></svg>
    case "heart": return <svg {...common}><path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1z" /></svg>
    case "rocket": return <svg {...common}><path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2M9 12l3 3M14.5 4.5c3-1 6 2 5 5l-7 7-4-4z" /></svg>
    case "run": return <svg {...common}><circle cx="13" cy="4" r="2" /><path d="M4 17l4-1 2-4 4 3v5M14 8l3 2 3-1" /></svg>
    case "clock": return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
    default: return null
  }
}

export function OneBookScreen() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-v3-bg-cream font-ibm">
      <SkyBackdrop height={520} />
      <Head><title>Your Life Code · คู่มือดวงจีนเฉพาะบุคคล · MuMate</title></Head>
      <SkyHeader title="หนังสือเล่มเดียวในโลก" backHref="/v2/service" testId="one-book" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-40 pt-2">
        {/* HERO — รูปโปสเตอร์เต็ม (ไม่ crop) */}
        <section className="flex flex-col items-center gap-3" data-testid="one-book-hero">
          <span className="relative block w-full overflow-hidden rounded-[20px] shadow-[0_10px_30px_rgba(26,38,77,.15)]">
            <Image src="/images/v2/features/one-book/hero.jpg" alt="Your Life Code — ถอดรหัสชีวิตจากวันเกิดของคุณ · คู่มือดวงจีนเฉพาะบุคคล" width={1000} height={1000} className="h-auto w-full" priority />
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {["ไม่คุย", "ไม่โทร", "ไม่เสียเวลา"].map((t) => (
              <span key={t} className="rounded-full bg-white px-3 py-1 text-[12px] font-bold text-v3-sapphire shadow-[0_2px_8px_rgba(26,38,77,.08)]">{t}</span>
            ))}
            <span className="rounded-full bg-v3-pumpkin px-3 py-1 text-[12px] font-black text-white">ได้ไฟล์อ่าน</span>
          </div>
        </section>

        {/* CREDIBILITY */}
        <section className={CARD} data-testid="one-book-cred">
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="grid size-9 flex-none place-items-center rounded-full bg-[#E3F4F7] text-[#127687]"><KnowIcon name="heart" /></span>
              <p className="text-[14px] leading-5 text-v3-text-body">วิเคราะห์โดย <b className="text-v3-navy">ซินแสเซียนปลาน้อย</b><br /><span className="text-[12px] text-v3-text-muted">Co-Founder of Mumate</span></p>
            </div>
            <div className="flex items-start gap-3">
              <span className="grid size-9 flex-none place-items-center rounded-full bg-[#EAF3FF] text-[13px] font-black text-v3-sapphire">20+</span>
              <p className="text-[14px] leading-5 text-v3-text-body"><b className="text-v3-navy">20+ ปี</b> แห่งประสบการณ์ดูดวงจีน</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="grid size-9 flex-none place-items-center rounded-full bg-[#FBF3DE] text-[16px]">☯</span>
              <p className="text-[14px] leading-5 text-v3-text-body">ใช้ศาสตร์จีนโบราณ <b className="text-v3-navy">BaZi กว่า 3,000 ปี</b></p>
            </div>
            <p className="rounded-[12px] bg-v3-ghost-white px-3 py-2 text-center text-[12px] font-bold text-v3-navy">✅ วิเคราะห์โดยซินแสจริง — ไม่ใช้ AI ในการวิเคราะห์</p>
          </div>
        </section>

        {/* KNOW — ถ้ารู้รหัสชีวิต จะรู้ว่า */}
        <section className={CARD} data-testid="one-book-know">
          <p className="text-[16px] font-black text-v3-navy">ถ้าคุณรู้ “รหัสชีวิต” ของตัวเอง จะรู้ว่า…</p>
          <div className="mt-3 grid grid-cols-1 gap-2.5">
            {KNOW.map((k) => (
              <div key={k.text} className="flex items-center gap-3">
                <span className="grid size-8 flex-none place-items-center rounded-full bg-[#E3F4F7] text-[#127687]"><KnowIcon name={k.icon} /></span>
                <p className="text-[13px] leading-5 text-v3-text-body">{k.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CODES — ภายในคู่มือ */}
        <section className={CARD} data-testid="one-book-codes">
          <p className="text-[16px] font-black text-v3-navy">ภายในคู่มือกว่า 30 หน้า</p>
          <p className="text-[13px] leading-5 text-v3-text-muted">ปลดล็อกระบบชีวิตของคุณ ผ่าน 6 รหัสหลัก</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {CODES.map((c) => (
              <div key={c.en} className={`flex flex-col gap-0.5 rounded-[16px] p-3 ${CODE_TONE[c.tone]}`}>
                <span className="text-[13px] font-black leading-4">{c.en}</span>
                <span className="text-[12px] font-bold opacity-90">{c.th}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-[12px] leading-5 text-v3-text-muted">PDF 30+ หน้า · อ่านซ้ำได้ตลอดชีพ · มีเพียงเล่มเดียวในโลก</p>
        </section>

        {/* CHAPTERS — 15 ด้าน (accordion) */}
        <section className={CARD} data-testid="one-book-chapters">
          <p className="text-[16px] font-black text-v3-navy">อ่านลึกครบ 15 ด้านของชีวิต</p>
          <div className="mt-2 flex flex-col divide-y divide-v3-border-card">
            {CHAPTERS.map((c, i) => {
              const isOpen = open === i
              return (
                <div key={c.t} className="py-2">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    data-testid={`one-book-ch-${i}`}
                    className="flex w-full items-center gap-3 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="grid size-7 flex-none place-items-center rounded-full bg-v3-sapphire text-[12px] font-black text-white">{i + 1}</span>
                    <span className="min-w-0 flex-1 text-[14px] font-bold leading-5 text-v3-navy">{c.t}</span>
                    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`flex-none text-v3-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                  {isOpen ? <p className="mt-1.5 pl-10 pr-1 text-[13px] leading-[21px] text-v3-text-body">{c.hook}</p> : null}
                </div>
              )
            })}
          </div>
        </section>

        {/* PRICING */}
        <section data-testid="one-book-pricing" className="flex flex-col gap-3">
          <p className="px-1 text-[16px] font-black text-v3-navy">เลือกแพ็กเกจของคุณ</p>
          {PLANS.map((p) => (
            <div key={p.id} className={`relative flex items-center justify-between gap-3 rounded-[20px] border-2 bg-white p-4 ${p.best ? "border-v3-sapphire" : "border-v3-border-card"}`}>
              {p.best ? <span className="absolute -top-2 right-4 rounded-full bg-v3-sapphire px-2 py-[2px] text-[10px] font-black text-white">แนะนำ</span> : null}
              <div className="min-w-0">
                <p className="text-[15px] font-black text-v3-navy">{p.name}</p>
                <p className="text-[12px] leading-4 text-v3-text-body">{p.detail}</p>
                {p.note ? <p className="mt-0.5 text-[12px] font-bold text-v3-cyan">{p.note}</p> : null}
              </div>
              <div className="flex-none text-right">
                <p className="text-[20px] font-black leading-6 text-v3-navy">{p.price}</p>
                <p className="text-[11px] text-v3-text-muted">บาท</p>
              </div>
            </div>
          ))}
        </section>

        {/* CTA — บริการสั่งทำ (วิเคราะห์โดยซินแส) → ทักไลน์ */}
        <a
          href={LINE_ORDER_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="one-book-order"
          className="mt-1 grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-[15px] font-bold uppercase text-v3-lime transition"
        >
          สั่งจองเลย · ทักไลน์เพื่อสั่งทำ
        </a>
        <p className="text-center text-[11px] leading-4 text-v3-text-muted">อ่านซ้ำและใช้วางแผนได้ตลอดชีพ ครบทุกด้านในชีวิต</p>
      </div>

      <Menubar />
    </div>
  )
}

export default OneBookScreen
