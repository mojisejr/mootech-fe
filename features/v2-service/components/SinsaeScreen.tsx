// features/v2-service/components/SinsaeScreen.tsx — /v2/service/sinsae
// "ดูดวงส่วนตัว กับซินแส" — บริการปรึกษาดวงตัวต่อตัวกับซินแส (คนจริง ไม่ใช้ AI).
// ไม่มีเฟรมใน Figma → ออกแบบเองตามคอนเทนต์การตลาด (ตาราง 3 แพ็กเกจ + แถบความน่าเชื่อถือ) + ภาษาดีไซน์ของแอป.
// เป็นบริการแบบจอง → ทุก CTA ไปที่ LINE OA เดียวกับ one-book (ทักเพื่อจองรอบ).
import Head from "next/head"

import { SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"

const LINE_ORDER_URL = "https://line.me/R/ti/p/@082cvuiy?ts=09151109&oat_content=url"

type Tone = "teal" | "sapphire"
type Tier = {
  id: string
  icon: "lock" | "fire" | "rocket"
  name: string
  price: string
  duration: string
  badge?: string
  tone: Tone
  best?: boolean
  points: React.ReactNode[]
}

// เนื้อหา verbatim จากคอนเทนต์การตลาด (โปสเตอร์ 3 แพ็กเกจ)
const TIERS: Tier[] = [
  {
    id: "unlock",
    icon: "lock",
    name: "Unlock!",
    price: "690",
    duration: "30 นาที",
    tone: "teal",
    points: [
      <>เคลียร์ทุกเรื่องคาใจ แบบตรงจุด</>,
      <>เหมาะกับเรื่องเร่งด่วน อยากได้คำตอบทันที</>,
    ],
  },
  {
    id: "deepdive",
    icon: "fire",
    name: "Deep Dive!",
    price: "1,190",
    duration: "60 นาที",
    badge: "🔥 Popular",
    tone: "sapphire",
    best: true,
    points: [
      <>สแกนดวงแบบละเอียด ทุกมิติ</>,
      <>สร้าง Personal Map วางแผนชีวิตให้ <b className="text-v3-navy">“ปังจริง ไม่ใช่แค่ฟังเพลิน”</b></>,
    ],
  },
  {
    id: "levelup",
    icon: "rocket",
    name: "Level Up!",
    price: "2,890",
    duration: "90 นาที",
    badge: "🚀 VIP",
    tone: "teal",
    points: [
      <>ไม่ใช่แค่ดูดวง… แต่ <b className="text-v3-navy">“ออกแบบอนาคต”</b></>,
      <>วางกลยุทธ์ชีวิตแบบ CEO Follow-up ต่อเนื่อง <b className="text-v3-navy">7 วันเต็ม</b></>,
    ],
  },
]

// 4 จุดความน่าเชื่อถือ (แถบล่างของโปสเตอร์)
const TRUST: { icon: "heart" | "target" | "shield" | "star"; a: string; b: string }[] = [
  { icon: "heart", a: "เข้าใจง่าย", b: "ไม่ซับซ้อน" },
  { icon: "target", a: "ตรงจุด", b: "ใช้งานได้จริง" },
  { icon: "shield", a: "เชื่อถือได้", b: "เป็นส่วนตัว" },
  { icon: "star", a: "ดูแลด้วยใจ", b: "ใส่ใจคุณ" },
]

const TONE_ICON: Record<Tone, string> = {
  teal: "bg-[#E3F4F7] text-[#127687]",
  sapphire: "bg-v3-sapphire text-white",
}
const TONE_NAME: Record<Tone, string> = {
  teal: "text-[#127687]",
  sapphire: "text-v3-sapphire",
}
const TONE_PRICE: Record<Tone, string> = {
  teal: "bg-[#E3F4F7] text-[#127687]",
  sapphire: "bg-[#EAF3FF] text-v3-sapphire",
}

function TierIcon({ name }: { name: Tier["icon"] }) {
  const c = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  switch (name) {
    case "lock": return <svg {...c}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
    case "fire": return <svg {...c}><path d="M12 3c1 3-1.5 4-1.5 6.5A1.5 1.5 0 0 0 12 11a3 3 0 0 0 .8-2.2C15 10 16 12 16 14a4 4 0 1 1-8 0c0-2.3 1.6-3.6 2-5C10.5 7.5 11 5 12 3z" /></svg>
    case "rocket": return <svg {...c}><path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2M9 12l3 3M14.5 4.5c3-1 6 2 5 5l-7 7-4-4z" /></svg>
  }
}

function TrustIcon({ name }: { name: (typeof TRUST)[number]["icon"] }) {
  const c = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  switch (name) {
    case "heart": return <svg {...c}><path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1z" /></svg>
    case "target": return <svg {...c}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /><path d="M12 1v3M12 20v3M1 12h3M20 12h3" /></svg>
    case "shield": return <svg {...c}><path d="M12 3l7 3v6c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V6z" /></svg>
    case "star": return <svg {...c}><path d="M12 3.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8L3.5 9.6l5.9-.8z" /></svg>
  }
}

export function SinsaeScreen() {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-v3-bg-cream font-ibm">
      <SkyBackdrop height={460} />
      <Head><title>ดูดวงส่วนตัว กับซินแส · MuMate</title></Head>
      <SkyHeader title="ดูดวงส่วนตัว กับซินแส" backHref="/v2/service" testId="sinsae" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-40 pt-2">
        {/* HERO — แบรนด์ + สโลแกน + ความน่าเชื่อถือ */}
        <section className="flex flex-col items-center gap-2 pt-1 text-center" data-testid="sinsae-hero">
          <h1 className="text-[24px] font-black leading-8 text-v3-navy">ดูดวงส่วนตัว กับซินแส</h1>
          <p className="text-[15px] font-bold text-v3-cyan">✦ คำตอบที่ใช่ แผนชีวิตที่ชัดเจน ✦</p>
          <p className="mt-1 rounded-full bg-white px-4 py-1.5 text-[12px] font-bold text-v3-navy shadow-[0_2px_8px_rgba(26,38,77,.08)]">
            ✅ ปรึกษาตัวต่อตัวกับซินแสจริง — ไม่ใช้ AI
          </p>
        </section>

        {/* 3 แพ็กเกจ */}
        <section className="flex flex-col gap-4" data-testid="sinsae-tiers">
          {TIERS.map((t) => (
            <div
              key={t.id}
              data-testid={`sinsae-tier-${t.id}`}
              className={`relative flex flex-col gap-3 rounded-[24px] border-2 bg-white p-5 ${t.best ? "border-v3-sapphire shadow-[0_10px_30px_rgba(20,85,164,.14)]" : "border-v3-border-card"}`}
            >
              {t.badge ? (
                <span className="absolute -top-3 left-5 rounded-full bg-v3-lime px-3 py-1 text-[11px] font-black text-v3-navy shadow-[0_2px_6px_rgba(26,38,77,.15)]">
                  {t.badge}
                </span>
              ) : null}

              <div className="flex items-center gap-3">
                <span className={`grid size-12 flex-none place-items-center rounded-full ${TONE_ICON[t.tone]}`}>
                  <TierIcon name={t.icon} />
                </span>
                <div className="min-w-0">
                  <p className={`text-[22px] font-black leading-7 ${TONE_NAME[t.tone]}`}>{t.name}</p>
                  <span className={`mt-1 inline-block rounded-full px-3 py-1 text-[13px] font-bold ${TONE_PRICE[t.tone]}`}>
                    {t.price} บาท / {t.duration}
                  </span>
                </div>
              </div>

              <ul className="flex flex-col gap-2">
                {t.points.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-[14px] leading-5 text-v3-text-body">
                    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-none text-v3-cyan"><path d="m5 12 4 4 10-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span className="min-w-0">{p}</span>
                  </li>
                ))}
              </ul>

              <a
                href={LINE_ORDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`sinsae-book-${t.id}`}
                className={`mt-1 grid h-11 w-full place-items-center rounded-full text-[14px] font-bold uppercase ${t.best ? "bg-v3-sapphire text-v3-lime" : "border border-v3-sapphire text-v3-sapphire"}`}
              >
                จองเลย · ทักไลน์
              </a>
            </div>
          ))}
        </section>

        {/* แถบความน่าเชื่อถือ */}
        <section className="mt-1 rounded-[24px] bg-v3-sapphire p-4" data-testid="sinsae-trust">
          <div className="grid grid-cols-2 gap-y-4">
            {TRUST.map((t) => (
              <div key={t.a} className="flex items-center gap-2.5">
                <span className="grid size-9 flex-none place-items-center rounded-full border border-white/40 text-white">
                  <TrustIcon name={t.icon} />
                </span>
                <p className="text-[12px] font-medium leading-4 text-white">
                  {t.a}
                  <br />
                  {t.b}
                </p>
              </div>
            ))}
          </div>
        </section>

        <p className="text-center text-[11px] leading-4 text-v3-text-muted">
          กดจองแล้วทักไลน์เพื่อยืนยันรอบและวันเวลา — วิเคราะห์โดยซินแสจริง
        </p>
      </div>

      <Menubar />
    </div>
  )
}

export default SinsaeScreen
