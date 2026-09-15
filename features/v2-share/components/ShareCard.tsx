// features/v2-share/components/ShareCard.tsx — #6 (ซินแสนุ้ย 2026-09-15)
// การ์ดแชร์เฉพาะบุคคล (render ซ่อนไว้นอกจอ → html2canvas จับเป็นรูป แล้วแนบตอนแชร์). ใช้ร่วมทุกจอผล:
// ดวงธาตุ/สมพงศ์/ไพ่/เซียมซี/เบอร์/รังผึ้ง — ต่างกันแค่ props (ภาพเฉพาะบุคคล + สรุปสั้น).
// สีสำคัญใช้ inline hex เพื่อกัน html2canvas อ่าน token/oklch ไม่ออก. รูปใช้ <img crossOrigin> ให้ useCORS ทำงาน.
import { forwardRef, type ReactNode } from "react"

/** ที่วางการ์ดแชร์แบบซ่อนนอกจอ (ยัง render มี layout ให้ html2canvas จับได้ แต่ผู้ใช้ไม่เห็น). */
export function ShareStage({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
      {children}
    </div>
  )
}

/** แถบสกิล 1 ด้าน (ดวงธาตุ) — #359 (ซินแสนุ้ย 2026-09-15) ให้ภาพแชร์บอกได้ว่าคืออะไร */
export type ShareSkill = { label: string; percent: number; grade: string; color: string; top?: boolean }

export type ShareCardProps = {
  title: string
  subtitle?: string
  summary: string
  images: string[] // 1-2 ภาพเฉพาะบุคคล (มาสคอต/หน้าไพ่/ใบเซียมซี)
  tag?: string
  skills?: ShareSkill[] // #359: แถบสกิล 4 ด้าน (เฉพาะจอดวงธาตุ) — ไม่ส่ง = ไม่วาด
}

export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard(
  { title, subtitle, summary, images, tag, skills },
  ref,
) {
  return (
    <div
      ref={ref}
      data-testid="share-card"
      // #359: สัดส่วนพอร์ตเทรต 4:5 (540×675 → 1080×1350 หลัง html2canvas scale 2) พอดี FB/IG feed
      style={{ width: 540, minHeight: 675, backgroundColor: "#12489B" }}
      className="relative flex flex-col items-center justify-center overflow-hidden rounded-[28px] px-8 py-9 font-ibm text-white"
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[24px] font-black tracking-tight">Mumate</span>
        {tag ? (
          <span style={{ backgroundColor: "rgba(255,255,255,0.16)" }} className="rounded-full px-3 py-1 text-[13px] font-bold">
            {tag}
          </span>
        ) : null}
      </div>

      {images.length > 0 ? (
        <div className="mb-4 flex items-center justify-center gap-3">
          {images.slice(0, 2).map((src, i) => (
            <span
              key={i}
              style={{ backgroundColor: "rgba(255,255,255,0.10)" }}
              className="block h-[190px] w-[144px] overflow-hidden rounded-[18px]"
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
      <p style={{ color: "rgba(255,255,255,0.92)" }} className="mt-3 max-w-[430px] text-center text-[16px] leading-relaxed">
        {summary}
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
  )
})
