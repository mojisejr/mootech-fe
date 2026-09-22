// features/v2-element-finder/WallpaperCard.tsx — wallpaper "มาหาธาตุแท้" (Quiz Mumate, Kittipon/gafiw 2026-09-22)
// เลเยอร์ (ล่าง→บน): BG เต็มใบ 9:16 (ตามธาตุ · มีกล่องข้อมูลธาตุ baked ที่ล่าง) → Character การ์ด 60 (โปร่งใส,
// กลางค่อนล่าง เหนือกล่องข้อมูล) → Text (คำสุ่ม, โปร่งใสเต็มใบ 9:16, อยู่บนสุดจึงอ่านออกเสมอแม้ทับตัวละคร).
// render width คงที่ (แคป 540 → 1080×1920 หลัง html2canvas scale 2 = ตรง native ของ asset). ใช้ <img crossOrigin>
// ให้ html2canvas useCORS จับได้.
import { forwardRef } from "react"

/** ที่วางแบบซ่อนนอกจอ (ยังมี layout ให้ html2canvas จับได้ แต่ผู้ใช้ไม่เห็น) */
export function WallpaperStage({ children }: { children: React.ReactNode }) {
  return (
    <div aria-hidden className="no-print" style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
      {children}
    </div>
  )
}

export type WallpaperCardProps = {
  /** BG เต็มใบ 9:16 (ตามธาตุ) — /images/v2/element-finder/bg/NN_ธาตุ.png */
  bg: string
  /** Character การ์ด 60 โปร่งใส — /images/v2/characters/NN_นักษัตร-ธาตุ.webp */
  character: string
  /** Text คำสุ่ม (โปร่งใสเต็มใบ 9:16) — /images/v2/element-finder/text/N.png */
  text: string
  /** ความกว้างจริงตอน render (แคป 540; พรีวิวส่งเล็กลงได้ — เลย์เอาต์เป็น % จึงย่อตาม) */
  width?: number
}

export const WallpaperCard = forwardRef<HTMLDivElement, WallpaperCardProps>(function WallpaperCard(
  { bg, character, text, width = 540 },
  ref,
) {
  const height = Math.round((width * 16) / 9) // พอร์ตเทรต 9:16 (ตรง native ของ BG/Text)
  return (
    <div
      ref={ref}
      data-testid="wallpaper-card"
      style={{ width, height, backgroundColor: "#cfe6f5" }}
      className="relative overflow-hidden font-ibm"
    >
      {/* BG เต็มใบ (มีกล่องข้อมูลธาตุ baked ล่าง) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={bg} alt="" crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-cover" />

      {/* Character — กลางค่อนล่าง สูง ~42% พ้นกล่องข้อมูลล่าง */}
      {character ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={character}
          alt=""
          crossOrigin="anonymous"
          className="absolute left-1/2 -translate-x-1/2 object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.28)]"
          style={{ bottom: "28%", width: "60%", height: "42%" }}
        />
      ) : null}

      {/* Text (คำสุ่ม) — เต็มใบ 9:16 บนสุด (คำถูกวางตำแหน่งไว้แล้วในไฟล์) */}
      {text ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={text} alt="" crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-contain" />
      ) : null}
    </div>
  )
})
