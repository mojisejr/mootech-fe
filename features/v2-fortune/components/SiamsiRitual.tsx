// เซียมซีโป๊ยเซียน — พิธีเขย่า (2026-11-03): กระบอกเอียงไปข้างหน้าแล้วเขย่าแบบ 求籤 จริง → ไม้ติ้วกระทบกันเด้ง
// → ไม้ 1 อันค่อย ๆ เลื่อนออกแล้วหล่น → แสงทองระเบิดเป็นรัศมี + ประกายกระจาย → ไพ่พลิกจากหลังเป็นหน้า แล้ว onDone()
// รอบ 2: ฉากมืด + วงยันต์หมุน 2 ชั้น + ประกายลอยจากกระบอก + ช่วงท้ายเขย่าคลั่ง (frenzy) → ไม้หล่นกระแทก (คลื่น+จอสั่น)
// → ไพ่หลังโผล่แล้ว "ชาร์จพลัง" (สั่นถี่ขึ้น + แสงดูดเข้า) ~1.6 วิ → แฟลชขาวเต็มฉาก → พลิก + ชื่อใบเด้งเข้า
// stage: "shake" (≥ SHAKE_MS ระหว่างรอ API) → "drop" → "burst" (ชาร์จ+พลิก) · CSS อยู่ใน styles/globals.css (siamsi-*)
import { useEffect, useState } from "react"

export const SHAKE_MS = 3200 // เขย่าอย่างน้อยเท่านี้ ต่อให้ API ตอบเร็ว
const FRENZY_MS = 2000 // หลังจากนี้เขย่าแรงขึ้น
const DROP_MS = 900
const BURST_MS = 3400

const STICKS = Array.from({ length: 13 }, (_, i) => ({
  x: 38 + i * 5.2,
  h: 92 + ((i * 37) % 23),
  delay: (i * 0.053) % 0.29,
  tint: i % 3 === 0 ? "#C0392B" : "#D9A441",
}))
const SPARKS = Array.from({ length: 24 }, (_, i) => ({ angle: (360 / 24) * i + (i % 2 ? 7 : -5), dist: 120 + ((i * 29) % 80), delay: 1.6 + (i % 6) * 0.04 }))
const EMBERS = Array.from({ length: 14 }, (_, i) => ({ left: 30 + ((i * 41) % 40), dx: ((i * 23) % 60) - 30, delay: (i * 0.23) % 1.6, size: 3 + (i % 3) }))
const CONVERGE = Array.from({ length: 16 }, (_, i) => ({ angle: (360 / 16) * i, dist: 150 + ((i * 17) % 50), delay: 0.5 + (i % 4) * 0.22 }))
const GLITTER = Array.from({ length: 12 }, (_, i) => ({ left: 8 + ((i * 53) % 84), top: 10 + ((i * 31) % 60), delay: 2.2 + (i % 6) * 0.3 }))

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
  const [frenzy, setFrenzy] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), SHAKE_MS)
    const f = setTimeout(() => setFrenzy(true), FRENZY_MS)
    // สั่นเครื่องเป็นจังหวะไม้กระทบกัน ถี่ขึ้นช่วงท้าย (Android; iOS ไม่รองรับ = เงียบ)
    try { navigator.vibrate?.([60, 60, 60, 60, 60, 120, 60, 60, 60, 60, 60, 120, 40, 30, 40, 30, 40, 30, 40, 30, 40, 30, 40, 30, 40]) } catch { /* ไม่รองรับ */ }
    return () => { clearTimeout(t); clearTimeout(f) }
  }, [])

  useEffect(() => {
    if (stage === "shake" && minDone && ready) setStage("drop")
  }, [stage, minDone, ready])

  // แต่ละ stage ตั้งเวลาของตัวเอง (ห้ามรวม effect เดียว — เปลี่ยน stage แล้ว cleanup จะล้างเวลาที่เหลือ)
  useEffect(() => {
    if (stage === "drop") {
      const t = setTimeout(() => {
        setStage("burst")
        // ชาร์จ = สั่นถี่ขึ้นเรื่อย ๆ → สั่นยาวตอนแฟลช (~1.6 วิ)
        try { navigator.vibrate?.([30, 120, 30, 90, 30, 60, 30, 40, 30, 30, 30, 20, 30, 20, 400]) } catch { /* ไม่รองรับ */ }
      }, DROP_MS)
      return () => clearTimeout(t)
    }
    if (stage === "burst") {
      const t = setTimeout(onDone, BURST_MS)
      return () => clearTimeout(t)
    }
  }, [stage, onDone])

  return (
    <div className="relative mt-4 flex flex-col items-center gap-4 text-center" data-testid="sage-loading" data-stage={stage}>
      <div className={"relative grid h-[380px] w-full max-w-[360px] place-items-center overflow-hidden rounded-[28px] " + (stage === "drop" ? "siamsi-quake" : stage === "burst" ? "siamsi-quake-late" : "")}>
        {/* ฉากมืด แดง-ทอง */}
        <span aria-hidden className="siamsi-stage-bg absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,#5A1410_0%,#2A0907_55%,#120403_100%)]" />
        {/* วงยันต์หมุน 2 ชั้น (ขีดแบบ 8 ทิศ) */}
        <svg aria-hidden viewBox="0 0 300 300" className="siamsi-ring absolute size-[320px] opacity-50">
          <circle cx="150" cy="150" r="140" fill="none" stroke="#D9A441" strokeWidth="1.5" strokeDasharray="4 8" />
          <circle cx="150" cy="150" r="124" fill="none" stroke="#D9A441" strokeWidth="0.8" />
          {Array.from({ length: 8 }, (_, i) => (
            <g key={i} transform={`rotate(${i * 45} 150 150)`}>
              <rect x="138" y="14" width="24" height="3" fill="#F6DA9A" />
              <rect x="138" y="20" width={i % 2 ? 10 : 24} height="3" fill="#F6DA9A" />
              {i % 2 ? <rect x="152" y="20" width="10" height="3" fill="#F6DA9A" /> : null}
              <rect x="138" y="26" width="24" height="3" fill="#F6DA9A" />
            </g>
          ))}
        </svg>
        <svg aria-hidden viewBox="0 0 300 300" className="siamsi-ring-rev absolute size-[230px] opacity-40">
          <circle cx="150" cy="150" r="140" fill="none" stroke="#FFE9A8" strokeWidth="2" strokeDasharray="1 14" strokeLinecap="round" />
        </svg>

        {/* แสงรอบกระบอก: หายใจตอนเขย่า → ระเบิดตอนเปิด */}
        <span aria-hidden className={"absolute size-56 rounded-full bg-[radial-gradient(circle,#FFE9A8_0%,#F5C451_35%,transparent_70%)] " + (stage === "burst" ? "siamsi-flash" : "siamsi-aura")} />

        {stage === "shake"
          ? EMBERS.map((e, i) => (
              <span
                key={i}
                aria-hidden
                className="siamsi-ember absolute bottom-[90px] rounded-full bg-[#FFD66B] shadow-[0_0_8px_2px_rgba(255,214,102,0.9)]"
                style={{ left: `${e.left}%`, width: e.size, height: e.size, ["--dx" as string]: `${e.dx}px`, animationDelay: `${e.delay}s` }}
              />
            ))
          : null}

        {stage === "drop" ? <span aria-hidden className="siamsi-shockwave absolute bottom-[60px] size-40 rounded-full border-solid border-[#FFE9A8]" /> : null}

        {stage === "burst" ? (
          <>
            {/* แสงดูดเข้าหาไพ่ระหว่างชาร์จ */}
            {CONVERGE.map((c, i) => (
              <span
                key={`c${i}`}
                aria-hidden
                className="siamsi-converge absolute h-[3px] w-6 rounded-full bg-[#FFE9A8] shadow-[0_0_8px_2px_rgba(255,214,102,0.9)]"
                style={{ ["--a" as string]: `${c.angle}deg`, ["--d" as string]: `${c.dist}px`, animationDelay: `${c.delay}s` }}
              />
            ))}
            <span aria-hidden className="siamsi-rays absolute size-[560px] rounded-full bg-[repeating-conic-gradient(from_0deg,rgba(255,215,120,0.6)_0deg_6deg,transparent_6deg_18deg)] [mask-image:radial-gradient(circle,black_20%,transparent_65%)]" />
            <span aria-hidden className="siamsi-shockwave-late absolute size-48 rounded-full border-solid border-[#FFF3C4]" />
            {SPARKS.map((s, i) => (
              <span
                key={i}
                aria-hidden
                className="siamsi-spark absolute size-2 rounded-full bg-[#FFE7A0] shadow-[0_0_10px_3px_rgba(255,214,102,0.9)]"
                style={{ ["--a" as string]: `${s.angle}deg`, ["--d" as string]: `${s.dist}px`, animationDelay: `${s.delay}s`, animationFillMode: "both" }}
              />
            ))}
            {GLITTER.map((g, i) => (
              <span key={`g${i}`} aria-hidden className="siamsi-glitter absolute text-[14px] text-[#FFE9A8]" style={{ left: `${g.left}%`, top: `${g.top}%`, animationDelay: `${g.delay}s` }}>✦</span>
            ))}
          </>
        ) : null}

        {stage !== "burst" ? (
          <div className={stage === "shake" ? "siamsi-build" : undefined}>
            <div className={"relative h-[240px] w-[150px] " + (stage === "shake" ? (frenzy ? "siamsi-cup-frenzy" : "siamsi-cup-shake") : "siamsi-cup-settle")}>
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
                  <circle cx="75" cy="27" r="16" fill="#FFE9A8" opacity="0.45" className="siamsi-twinkle" />
                  <rect x="72" y="20" width="6" height="150" rx="3" fill="#F6DA9A" stroke="#B8862F" strokeWidth="0.8" />
                  <rect x="72" y="20" width="6" height="14" rx="3" fill="#C0392B" />
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
          </div>
        ) : (
          // ไพ่โผล่ (หลัง) → ชาร์จพลัง → แฟลช → พลิกเป็นหน้า
          <div className="siamsi-card-in relative h-[280px] w-[187px] [perspective:1000px]">
            <div className="siamsi-charge size-full">
              <div className="siamsi-card-flip relative size-full [transform-style:preserve-3d]">
                <div className="absolute inset-0 overflow-hidden rounded-[16px] border-4 border-[#D9A441] bg-[#6B1A13] shadow-2xl [backface-visibility:hidden]">
                  {/* หลังไพ่ = ภาพปกเซียมซี 8 เซียน */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/v2/fortune/poysian-cover.webp" alt="" className="size-full object-cover" />
                </div>
                <div className="absolute inset-0 overflow-hidden rounded-[16px] border-4 border-[#D9A441] bg-white shadow-[0_0_40px_10px_rgba(255,214,102,0.7)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {cardImage ? <img src={cardImage} alt={cardName ?? ""} className="size-full object-cover" /> : null}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* แฟลชขาวเต็มฉากตอนพลังระเบิด */}
        {stage === "burst" ? <span aria-hidden className="siamsi-whiteout pointer-events-none absolute inset-0 bg-[#FFF8E1]" /> : null}
      </div>
      {stage === "burst" ? (
        <p className="siamsi-title-in text-[22px] font-black text-[#B8862F]">{cardName ?? "เปิดคำทำนาย"}</p>
      ) : (
        <p className={"text-[18px] font-black text-v3-navy " + (stage === "shake" ? "siamsi-pulse-text" : "")}>
          {stage === "drop" ? "ไม้เซียมซีหล่นแล้ว!" : frenzy ? "แปดเซียนกำลังเลือกไม้ให้คุณ…" : "ตั้งจิต… เขย่าเซียมซี"}
        </p>
      )}
      {stage === "shake" ? <p className="text-[13px] text-v3-text-body">ขอแปดเซียนชี้ทางให้ชัดเจน</p> : null}
    </div>
  )
}
