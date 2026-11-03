// เซียมซีโป๊ยเซียน — พิธีเขย่า (2026-11-03): กระบอกเอียงไปข้างหน้าแล้วเขย่าแบบ 求籤 จริง → ไม้ติ้วกระทบกันเด้ง
// → ไม้ 1 อันค่อย ๆ เลื่อนออกแล้วหล่น → แสงทองระเบิดเป็นรัศมี + ประกายกระจาย → ไพ่พลิกจากหลังเป็นหน้า แล้ว onDone()
// stage: "shake" (≥ SHAKE_MS ระหว่างรอ API) → "drop" → "burst" (ไพ่พลิก) · CSS อยู่ใน styles/globals.css (siamsi-*)
import { useEffect, useState } from "react"

export const SHAKE_MS = 3200 // เขย่าอย่างน้อยเท่านี้ ต่อให้ API ตอบเร็ว
const DROP_MS = 900
const BURST_MS = 2000

const STICKS = Array.from({ length: 13 }, (_, i) => ({
  x: 38 + i * 5.2,
  h: 92 + ((i * 37) % 23),
  delay: (i * 0.053) % 0.29,
  tint: i % 3 === 0 ? "#C0392B" : "#D9A441",
}))
const SPARKS = Array.from({ length: 18 }, (_, i) => ({ angle: (360 / 18) * i + (i % 2 ? 7 : -5), dist: 110 + ((i * 29) % 70), delay: (i % 6) * 0.04 }))

type Props = {
  /** มีผลแล้ว (API ตอบ) — ครบเวลาเขย่าแล้วจึงไปต่อ */
  ready: boolean
  cardImage?: string
  cardName?: string
  onDone: () => void
}

export function SiamsiRitual({ ready, cardImage, cardName, onDone }: Props) {
  const [stage, setStage] = useState<"shake" | "drop" | "burst">("shake")
  const [minDone, setMinDone] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), SHAKE_MS)
    // สั่นเครื่องเป็นจังหวะไม้กระทบกัน (Android; iOS ไม่รองรับ = เงียบ)
    try { navigator.vibrate?.([60, 50, 60, 50, 60, 120, 60, 50, 60, 50, 60, 120, 80]) } catch { /* ไม่รองรับ */ }
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (stage === "shake" && minDone && ready) setStage("drop")
  }, [stage, minDone, ready])

  // แต่ละ stage ตั้งเวลาของตัวเอง (ห้ามรวม effect เดียว — เปลี่ยน stage แล้ว cleanup จะล้างเวลาที่เหลือ)
  useEffect(() => {
    if (stage === "drop") {
      const t = setTimeout(() => {
        setStage("burst")
        try { navigator.vibrate?.(180) } catch { /* ไม่รองรับ */ }
      }, DROP_MS)
      return () => clearTimeout(t)
    }
    if (stage === "burst") {
      const t = setTimeout(onDone, BURST_MS)
      return () => clearTimeout(t)
    }
  }, [stage, onDone])

  return (
    <div className="relative mt-6 flex flex-col items-center gap-4 text-center" data-testid="sage-loading" data-stage={stage}>
      <div className="relative grid h-[340px] w-full max-w-[340px] place-items-center">
        {/* แสงรอบกระบอก: หายใจตอนเขย่า → ระเบิดตอนเปิด */}
        <span aria-hidden className={"absolute size-56 rounded-full bg-[radial-gradient(circle,#FFE9A8_0%,#F5C451_35%,transparent_70%)] " + (stage === "burst" ? "siamsi-flash" : "siamsi-aura")} />
        {stage === "burst" ? (
          <>
            <span aria-hidden className="siamsi-rays absolute size-[520px] rounded-full bg-[repeating-conic-gradient(from_0deg,rgba(255,215,120,0.55)_0deg_6deg,transparent_6deg_18deg)] [mask-image:radial-gradient(circle,black_20%,transparent_65%)]" />
            {SPARKS.map((s, i) => (
              <span
                key={i}
                aria-hidden
                className="siamsi-spark absolute size-2 rounded-full bg-[#FFE7A0] shadow-[0_0_10px_3px_rgba(255,214,102,0.9)]"
                style={{ ["--a" as string]: `${s.angle}deg`, ["--d" as string]: `${s.dist}px`, animationDelay: `${s.delay}s` }}
              />
            ))}
          </>
        ) : null}

        {stage !== "burst" ? (
          <div className={"relative h-[240px] w-[150px] " + (stage === "shake" ? "siamsi-cup-shake" : "siamsi-cup-settle")}>
            {/* ไม้ติ้ว */}
            <svg viewBox="0 0 150 240" className="absolute inset-0 overflow-visible">
              {STICKS.map((s, i) => (
                <g key={i} className={stage === "shake" ? "siamsi-stick" : undefined} style={{ animationDelay: `${s.delay}s` }}>
                  <rect x={s.x} y={150 - s.h} width="4.2" height={s.h + 40} rx="2" fill="#E8C98A" stroke="#A97B2F" strokeWidth="0.6" />
                  <rect x={s.x} y={150 - s.h} width="4.2" height="11" rx="2" fill={s.tint} />
                </g>
              ))}
              {/* ไม้ที่ถูกเลือก: ค่อย ๆ โผล่ระหว่างเขย่า → หล่นตอน drop */}
              <g className={stage === "shake" ? "siamsi-chosen-rise" : "siamsi-chosen-drop"}>
                <rect x="72" y="20" width="6" height="150" rx="3" fill="#F6DA9A" stroke="#B8862F" strokeWidth="0.8" />
                <rect x="72" y="20" width="6" height="14" rx="3" fill="#C0392B" />
                <circle cx="75" cy="27" r="9" fill="#FFE9A8" opacity="0.6" className="siamsi-twinkle" />
              </g>
              {/* กระบอก */}
              <defs>
                <linearGradient id="siamsi-cup" x1="0" x2="1">
                  <stop offset="0" stopColor="#7A1E16" />
                  <stop offset="0.45" stopColor="#C0392B" />
                  <stop offset="1" stopColor="#6B1A13" />
                </linearGradient>
              </defs>
              <path d="M28 120 L122 120 L114 236 Q75 244 36 236 Z" fill="url(#siamsi-cup)" stroke="#5A140E" strokeWidth="1.5" />
              <ellipse cx="75" cy="120" rx="47" ry="9" fill="#4A100B" stroke="#D9A441" strokeWidth="2" />
              <rect x="32" y="150" width="86" height="7" fill="#D9A441" opacity="0.9" />
              <rect x="35" y="208" width="80" height="6" fill="#D9A441" opacity="0.9" />
              <text x="75" y="190" textAnchor="middle" fontSize="22" fontWeight="900" fill="#F6DA9A">八仙</text>
            </svg>
          </div>
        ) : (
          // ไพ่พลิก หลัง → หน้า
          <div className="siamsi-card-in relative h-[280px] w-[187px] [perspective:1000px]">
            <div className="siamsi-card-flip relative size-full [transform-style:preserve-3d]">
              <div className="absolute inset-0 grid place-items-center rounded-[16px] border-4 border-[#D9A441] bg-[radial-gradient(circle,#C0392B,#6B1A13)] text-[40px] font-black text-[#F6DA9A] shadow-2xl [backface-visibility:hidden]">八仙</div>
              <div className="absolute inset-0 overflow-hidden rounded-[16px] border-4 border-[#D9A441] bg-white shadow-[0_0_40px_10px_rgba(255,214,102,0.7)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {cardImage ? <img src={cardImage} alt={cardName ?? ""} className="size-full object-cover" /> : null}
              </div>
            </div>
          </div>
        )}
      </div>
      <p className="text-[18px] font-black text-v3-navy">{stage === "shake" ? "ตั้งจิต… เขย่าเซียมซี" : stage === "drop" ? "ไม้เซียมซีหล่นแล้ว!" : cardName ?? "เปิดคำทำนาย"}</p>
      {stage === "shake" ? <p className="text-[13px] text-v3-text-body">ขอแปดเซียนชี้ทางให้ชัดเจน</p> : null}
    </div>
  )
}
