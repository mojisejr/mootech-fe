// Glass Box trace panels (#bazi-chat-anti-drift v2, Track B2).
// Renders the three observability lenses the ซินแส reads side-by-side with the answer:
//   👂 ได้ยิน (heard)  ·  📊 ความจริงที่ใช้ (truth used)  ·  ⏳ ตัวกรอง (filters)
// Pure presentational: it shows whatever trace the BFF surfaced, never derives chart facts.
import { useState } from "react"
import type { GlassBoxTrace } from "@/features/glass-box/use-glass-box-stream"

function Panel({
  icon,
  title,
  children,
}: {
  icon: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-chat_panel/80 rounded-2xl border border-white/10 p-4">
      <div className="text-white/90 text-[13px] font-medium mb-3 flex items-center gap-2">
        <span className="text-[15px]">{icon}</span>
        {title}
      </div>
      <div className="space-y-1.5 text-[12px] text-white/70">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-white/45 flex-none">{label}</span>
      <span className="text-white/85 text-right break-words">{value}</span>
    </div>
  )
}

function Pending({ label }: { label: string }) {
  return (
    <div className="bg-chat_panel/40 rounded-2xl border border-white/5 p-4 text-white/40 text-[12px] flex items-center gap-2">
      <span className="text-[15px] opacity-60">{label}</span>
      <span>รอคำถามแรก…</span>
    </div>
  )
}

export default function TracePanels({ trace }: { trace: GlassBoxTrace | null }) {
  const [showFull, setShowFull] = useState(false)

  if (!trace) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <Pending label="👂 ได้ยิน" />
        <Pending label="📊 ความจริงที่ใช้" />
        <Pending label="⏳ ตัวกรอง" />
      </div>
    )
  }

  const { heard, truthUsed, filters } = trace
  const reading = truthUsed.injectedReadingText
  const readingPreview = reading
    ? reading.length > 220 && !showFull
      ? `${reading.slice(0, 220)}…`
      : reading
    : null

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Panel icon="👂" title="ได้ยิน (triage)">
        <Row label="หัวข้อ" value={heard.topicId ?? "—"} />
        <Row label="ช่วงเวลา" value={heard.timeframe ?? "—"} />
        <Row
          label="ต้องดูดวง"
          value={heard.requiresBaziConsult ? "ใช่" : "ไม่"}
        />
        <Row label="ความมั่นใจ" value={heard.confidence.toFixed(2)} />
        <Row label="ระบุวันเกิด" value={heard.birthResolved ? "ครบ" : "ไม่ครบ"} />
      </Panel>

      <Panel icon="📊" title="ความจริงที่ใช้ (engine)">
        <Row label="ช่องทาง" value={truthUsed.seam ?? "ไม่ได้ใช้ดวง"} />
        {readingPreview ? (
          <div className="pt-1">
            <div className="text-white/45 mb-1">ข้อความที่ฉีดเข้า</div>
            <pre className="whitespace-pre-wrap break-words text-white/80 text-[11px] leading-relaxed bg-black/15 rounded-lg p-2 max-h-[180px] overflow-y-auto">
              {readingPreview}
            </pre>
            {reading && reading.length > 220 ? (
              <button
                onClick={() => setShowFull((v) => !v)}
                className="mt-1 text-moumate_blue_light/80 text-[11px] cursor-pointer hover:underline"
              >
                {showFull ? "ย่อ" : "ดูเต็ม"}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="text-white/40">— ไม่มีข้อความดวงถูกฉีดเข้า —</div>
        )}
      </Panel>

      <Panel icon="⏳" title="ตัวกรอง (filters)">
        <Row
          label="ปรับความแม่นเวลา"
          value={
            filters.honestPrecisionApplied ? (
              <span className="text-amber-300/90">ใช้ (ตอบเป็นแนวโน้ม)</span>
            ) : (
              "ไม่ใช้"
            )
          }
        />
        <p className="text-white/35 text-[11px] pt-1 leading-relaxed">
          ตัวกรองนี้ทำงานเมื่อถามเจาะจงระดับวัน/เดือน เพื่อกันการรับปากความแม่นที่ดวงให้ไม่ได้
        </p>
      </Panel>
    </div>
  )
}
