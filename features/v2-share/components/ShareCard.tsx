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

export type ShareCardProps = {
  title: string
  subtitle?: string
  summary: string
  images: string[] // 1-2 ภาพเฉพาะบุคคล (มาสคอต/หน้าไพ่/ใบเซียมซี)
  tag?: string
}

export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard(
  { title, subtitle, summary, images, tag },
  ref,
) {
  return (
    <div
      ref={ref}
      data-testid="share-card"
      style={{ width: 540, backgroundColor: "#12489B" }}
      className="relative flex flex-col items-center overflow-hidden rounded-[28px] px-8 pb-10 pt-8 font-ibm text-white"
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
        <div className="mb-5 flex items-center justify-center gap-3">
          {images.slice(0, 2).map((src, i) => (
            <span
              key={i}
              style={{ backgroundColor: "rgba(255,255,255,0.10)" }}
              className="block h-[220px] w-[164px] overflow-hidden rounded-[18px]"
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

      <div style={{ backgroundColor: "rgba(255,255,255,0.16)" }} className="mt-6 rounded-full px-4 py-1.5 text-[14px] font-bold">
        bazichart.mumate.co
      </div>
    </div>
  )
})
