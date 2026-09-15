// features/v2-share/components/ShareCard.tsx — #6/#359 (ซินแสนุ้ย 2026-09-15)
// การ์ดแชร์เฉพาะบุคคล (render ซ่อนไว้นอกจอ → html2canvas จับเป็นรูป แล้วแนบตอนแชร์). ใช้ร่วมทุกจอผล:
// ดวงธาตุ/สมพงศ์/ไพ่/เซียมซี/เบอร์/รังผึ้ง — ต่างกันแค่ props (ภาพเฉพาะบุคคล + สรุปสั้น).
// สีสำคัญใช้ inline hex เพื่อกัน html2canvas อ่าน token/oklch ไม่ออก. รูปใช้ <img crossOrigin> ให้ useCORS ทำงาน.
// #359 รอบ 10: พื้นหลังภาพ (BG01) + overlay น้ำเงินโปร่ง (เลิกสีน้ำเงินล้วน), เลย์เอาต์ justify-start กันตัวอักษรโดนตัด,
// รองรับ 3 รูป (ไพ่ 3 ใบ), และ clamp สรุปแบบไม่ตัดกลางคำแบบเดิม (150 → ~300 + …).
import { forwardRef, type ReactNode } from "react"

/** ที่วางการ์ดแชร์แบบซ่อนนอกจอ (ยัง render มี layout ให้ html2canvas จับได้ แต่ผู้ใช้ไม่เห็น). */
export function ShareStage({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
      {children}
    </div>
  )
}

/** แถบสกิล 1 ด้าน (ดวงธาตุ) */
export type ShareSkill = { label: string; percent: number; grade: string; color: string; top?: boolean }

export type ShareCardProps = {
  title: string
  subtitle?: string
  summary: string
  images: string[] // 1-3 ภาพเฉพาะบุคคล (มาสคอต/หน้าไพ่/ใบเซียมซี)
  tag?: string
  skills?: ShareSkill[] // แถบสกิล 4 ด้าน (เฉพาะจอดวงธาตุ) — ไม่ส่ง = ไม่วาด
}

// clamp ข้อความสรุป: ไทยไม่มีเว้นวรรคระหว่างคำ → ตัดยาก, ใช้ตัดตรง ๆ + … เมื่อยาวเกิน (การ์ดโตตามเนื้อ ไม่ clip)
function clampSummary(s: string, max = 300): string {
  const t = (s ?? "").trim()
  return t.length <= max ? t : t.slice(0, max).trimEnd() + "…"
}

export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard(
  { title, subtitle, summary, images, tag, skills },
  ref,
) {
  const imgs = images.filter((u) => typeof u === "string" && u.length > 0).slice(0, 3)
  return (
    <div
      ref={ref}
      data-testid="share-card"
      // พอร์ตเทรต 4:5 (กว้าง 540 → 1080×1350 หลัง html2canvas scale 2). สีสำรอง navy เผื่อภาพ bg โหลดไม่ได้
      style={{ width: 540, backgroundColor: "#0b2a65" }}
      className="relative overflow-hidden rounded-[28px] font-ibm text-white"
    >
      {/* พื้นหลังภาพแบรนด์ + overlay น้ำเงินไล่เฉด (ตัวอักษรขาวยังอ่านออก) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/v2/bg/BG01.png" alt="" crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(18,72,155,0.80) 0%, rgba(11,42,101,0.93) 100%)" }} />

      <div className="relative z-10 flex min-h-[675px] w-full flex-col items-center px-8 py-10">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[24px] font-black tracking-tight">Mumate</span>
          {tag ? (
            <span style={{ backgroundColor: "rgba(255,255,255,0.16)" }} className="rounded-full px-3 py-1 text-[13px] font-bold">
              {tag}
            </span>
          ) : null}
        </div>

        {imgs.length > 0 ? (
          <div className="mb-4 flex items-center justify-center gap-2">
            {imgs.map((src, i) => (
              <span
                key={i}
                style={{ backgroundColor: "rgba(255,255,255,0.10)" }}
                className="block h-[184px] w-[140px] overflow-hidden rounded-[16px]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" crossOrigin="anonymous" className="h-full w-full object-cover" />
              </span>
            ))}
          </div>
        ) : null}

        <p className="text-center text-[26px] font-black leading-tight">{title}</p>
        {subtitle ? (
          <p style={{ color: "#FFD84D" }} className="mt-1.5 text-center text-[17px] font-black">
            {subtitle}
          </p>
        ) : null}
        <p style={{ color: "rgba(255,255,255,0.92)" }} className="mt-3 max-w-[440px] text-center text-[16px] leading-relaxed">
          {clampSummary(summary)}
        </p>

        {skills && skills.length > 0 ? (
          <div className="mt-5 flex w-full max-w-[440px] flex-col gap-2.5">
            {skills.map((s, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="w-[132px] shrink-0 truncate text-[15px] font-bold">
                  {s.label}{s.top ? " ⭐" : ""}
                </span>
                <span style={{ backgroundColor: "rgba(255,255,255,0.22)" }} className="block h-[10px] flex-1 overflow-hidden rounded-full">
                  <span className="block h-full rounded-full" style={{ width: `${s.percent}%`, backgroundColor: s.color }} />
                </span>
                <span className="w-[38px] shrink-0 text-right text-[14px] font-bold">{s.percent}%</span>
                <span style={{ backgroundColor: s.color, color: "#fff" }} className="grid h-6 min-w-[34px] place-items-center rounded-full px-1.5 text-[13px] font-bold">
                  {s.grade}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ backgroundColor: "rgba(255,255,255,0.16)" }} className="mt-6 rounded-full px-4 py-1.5 text-[14px] font-bold">
          bazichart.mumate.co
        </div>
      </div>
    </div>
  )
})
