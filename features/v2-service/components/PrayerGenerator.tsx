// features/v2-service/components/PrayerGenerator.tsx
// UI สร้าง "คำอธิษฐาน" — เลือกเรื่องที่ขอ (7 หมวด) → กดสร้าง → เรียก /api/prayer (BFF resolve ดวงหลังบ้าน
// เสริมตามธาตุเสริมดวง用神) → โชว์บทอธิษฐาน + ปุ่มคัดลอก/แชร์. ใช้ได้ทั้งในหน้าสถานที่ศักดิ์สิทธิ์
// (ส่ง placeName/deity มา) และหน้าฟีเจอร์แยก. presentational + fetch เท่านั้น ไม่ยุ่ง auth.
import { useState } from "react"

export type PrayerTopic = "love" | "wealth" | "career" | "health" | "study" | "fixluck" | "general"

const TOPICS: { key: PrayerTopic; label: string; emoji: string }[] = [
  { key: "love", label: "ความรัก", emoji: "💗" },
  { key: "wealth", label: "การเงิน โชคลาภ", emoji: "💰" },
  { key: "career", label: "การงาน", emoji: "💼" },
  { key: "health", label: "สุขภาพ", emoji: "🌿" },
  { key: "study", label: "การเรียน", emoji: "📖" },
  { key: "fixluck", label: "เปิดทาง สะเดาะเคราะห์", emoji: "🕯️" },
  { key: "general", label: "รุ่งเรืองรอบด้าน", emoji: "✨" },
]

/** map ความต้องการของสถานที่ (needs) → หมวดพรเริ่มต้น */
export function topicFromNeeds(needs?: string[]): PrayerTopic {
  const n = (needs ?? []).join(" ")
  if (/รัก|คู่|เนื้อคู่/.test(n)) return "love"
  if (/เงิน|โชคลาภ|ทรัพย์|ค้าขาย/.test(n)) return "wealth"
  if (/งาน|การงาน|อาชีพ/.test(n)) return "career"
  if (/สุขภาพ/.test(n)) return "health"
  if (/เรียน|สอบ|ปัญญา/.test(n)) return "study"
  if (/เคราะห์|ชง|จิตใจ/.test(n)) return "fixluck"
  return "general"
}

type PrayerResult = { title: string; text: string; favorableElements?: string[] }

export function PrayerGenerator({
  defaultTopic = "general",
  placeName,
  deity,
}: {
  defaultTopic?: PrayerTopic
  placeName?: string
  deity?: string | null
}) {
  const [topic, setTopic] = useState<PrayerTopic>(defaultTopic)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PrayerResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const generate = async () => {
    setLoading(true)
    setError(null)
    setCopied(false)
    try {
      const res = await fetch("/api/prayer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, placeName, deity: deity ?? undefined }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.text) {
        setError("สร้างคำอธิษฐานไม่สำเร็จ ลองใหม่อีกครั้งนะคะ")
        setResult(null)
      } else {
        setResult(json as PrayerResult)
      }
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้งนะคะ")
    } finally {
      setLoading(false)
    }
  }

  const copy = () => {
    if (!result?.text) return
    void navigator.clipboard?.writeText(result.text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const share = () => {
    if (!result?.text) return
    if (navigator.share) void navigator.share({ title: result.title, text: result.text }).catch(() => {})
    else copy()
  }

  return (
    <div className="flex flex-col gap-3" data-testid="prayer-generator">
      <div>
        <p className="text-[13px] font-black text-[#2F7A46]">เลือกเรื่องที่ขอพร</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TOPICS.map((t) => {
            const on = topic === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTopic(t.key)}
                data-testid={`prayer-topic-${t.key}`}
                className={
                  "rounded-full border px-3 py-1.5 text-[12px] font-bold " +
                  (on ? "border-transparent bg-v3-sapphire text-white" : "border-v3-border-card bg-white text-v3-navy")
                }
              >
                {t.emoji} {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void generate()}
        disabled={loading}
        data-testid="prayer-generate"
        className="grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-[14px] font-bold text-white disabled:opacity-60"
      >
        {loading ? "กำลังเรียบเรียงคำอธิษฐาน…" : "🙏 สร้างคำอธิษฐาน"}
      </button>

      {error ? <p className="text-center text-[12px] text-red-500">{error}</p> : null}

      {result ? (
        <div className="rounded-[14px] border border-v3-border-card bg-[#FBF6F0] p-4" data-testid="prayer-result">
          <p className="whitespace-pre-line text-[13px] leading-6 text-v3-text-body">{result.text}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={copy}
              data-testid="prayer-copy"
              className="grid h-10 place-items-center rounded-full border border-v3-border-card bg-white text-[13px] font-bold text-v3-navy"
            >
              {copied ? "✓ คัดลอกแล้ว" : "คัดลอกบท"}
            </button>
            <button
              type="button"
              onClick={share}
              data-testid="prayer-share"
              className="grid h-10 place-items-center rounded-full border border-v3-border-card bg-white text-[13px] font-bold text-v3-navy"
            >
              ↗ แชร์
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-v3-text-muted">
            แทนที่ (ระบุชื่อ-นามสกุล) ด้วยชื่อของคุณก่อนอธิษฐาน
          </p>
        </div>
      ) : null}
    </div>
  )
}
