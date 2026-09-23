// features/v2-calendar/components/day-detail/SpecialDayBlessingPopup.tsx
// ซินแสนุ้ย 2026-09-23: กดป้าย "วันความรัก"/"วันลาภสวรรค์" → เด้งแผงคำอธิษฐาน + สถานที่สักการะ + (ลาภสวรรค์) ทิศมงคล.
// เนื้อหาคำอธิษฐาน/เทพ = static (special-day-blessings.ts, จาก Google Docs ซินแส). ปุ่ม "เฉพาะคุณ" = /api/prayer (personalize 用神).
// มิเรอร์ GateDetailPopup: portal → body, bottom-sheet มือถือ / dialog จอใหญ่, ปิดด้วย backdrop/Esc.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SpecialDayBlessing } from './special-day-blessings'

export function SpecialDayBlessingPopup({
  blessing,
  luckyDirection,
  onClose,
}: {
  blessing: SpecialDayBlessing
  luckyDirection?: string
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const [copied, setCopied] = useState(false)
  // ปุ่ม "คำอธิษฐานเฉพาะคุณ" — ยิง /api/prayer (resolve ดวงหลังบ้าน, personalize ตาม 用神)
  const [personal, setPersonal] = useState<string | null>(null)
  const [praying, setPraying] = useState(false)
  const [personalCopied, setPersonalCopied] = useState(false)

  const copy = (text: string, which: 'main' | 'personal') => {
    void navigator.clipboard?.writeText(text).then(() => {
      if (which === 'main') { setCopied(true); setTimeout(() => setCopied(false), 2000) }
      else { setPersonalCopied(true); setTimeout(() => setPersonalCopied(false), 2000) }
    })
  }

  const makePersonal = async () => {
    setPraying(true)
    try {
      const res = await fetch('/api/prayer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: blessing.generatorTopic, deity: blessing.deity }),
      })
      const j = await res.json().catch(() => null)
      setPersonal(res.ok && typeof j?.text === 'string' ? j.text : 'สร้างคำอธิษฐานไม่สำเร็จ ลองใหม่อีกครั้งนะคะ')
    } catch {
      setPersonal('เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้งนะคะ')
    } finally {
      setPraying(false)
    }
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      data-testid="special-day-popup"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-[#fbf3df] p-5 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[85vh] sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="ปิด" data-testid="special-day-close" onClick={onClose} className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-white/80 text-v3-text-muted">✕</button>

        {/* หัว: ไอคอน + ชื่อเทพ */}
        <div className="mb-3 flex flex-col items-center text-center">
          <span className="text-4xl leading-none">{blessing.emoji}</span>
          <p className="mt-2 text-[17px] font-black" style={{ color: blessing.accent }}>{blessing.deity}</p>
        </div>

        {/* ที่มา/ความเป็นมา */}
        <p className="rounded-2xl bg-white/70 p-3.5 text-[13px] leading-6 text-v3-text-body">{blessing.intro}</p>

        {/* คำอธิษฐาน */}
        <div className="mt-3 rounded-2xl border border-[#e7d6a8] bg-[#fffdf5] p-3.5" data-testid="special-day-prayer">
          <p className="mb-1.5 text-[13px] font-black text-v3-navy">🙏 คำอธิษฐาน</p>
          <p className="whitespace-pre-line text-[13px] leading-6 text-v3-text-body">{blessing.prayer}</p>
          <button
            type="button"
            data-testid="special-day-prayer-copy"
            onClick={() => copy(blessing.prayer, 'main')}
            className="mt-2.5 grid h-9 w-full place-items-center rounded-full border border-[#eadfbf] bg-white text-[12px] font-bold text-v3-navy"
          >
            {copied ? '✓ คัดลอกแล้ว' : 'คัดลอกบท'}
          </button>
          <p className="mt-2 text-center text-[10px] text-v3-text-muted">แทนที่ (ระบุชื่อ-นามสกุล) และ (…สถานที่…) ด้วยของคุณก่อนอธิษฐาน</p>
        </div>

        {/* ทิศมงคลวันนี้ (ลาภสวรรค์) */}
        {blessing.showDirection && luckyDirection ? (
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3" data-testid="special-day-direction">
            <span className="text-[13px] font-bold text-v3-navy">🧭 ทิศมงคลวันนี้ (หันหน้าขณะอธิษฐาน)</span>
            <span className="text-[15px] font-black" style={{ color: blessing.accent }}>{luckyDirection}</span>
          </div>
        ) : null}

        {/* สถานที่สักการะ */}
        {blessing.shrines && blessing.shrines.length > 0 ? (
          <div className="mt-3 rounded-2xl bg-white/70 p-3.5" data-testid="special-day-shrines">
            <p className="mb-2 text-[13px] font-black text-v3-navy">📍 สถานที่สักการะ</p>
            <div className="flex flex-col gap-2">
              {blessing.shrines.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5 text-[13px]">🛕</span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-v3-navy">{s.name}</p>
                    <p className="text-[11px] leading-4 text-v3-text-muted">{s.place}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* ปุ่มคำอธิษฐานเฉพาะคุณ (personalize ตามดวง — /api/prayer) */}
        <button
          type="button"
          data-testid="special-day-personal"
          onClick={() => void makePersonal()}
          disabled={praying}
          className="mt-3 grid h-11 w-full place-items-center rounded-full bg-v3-sapphire text-[14px] font-bold text-white disabled:opacity-60"
        >
          {praying ? 'กำลังเรียบเรียง…' : blessing.generatorLabel}
        </button>

        {personal && (
          <div className="mt-3 rounded-2xl border border-[#e7d6a8] bg-[#fffdf5] p-3.5" data-testid="special-day-personal-prayer">
            <p className="mb-1.5 text-[13px] font-black text-v3-navy">คำอธิษฐานเฉพาะคุณ (ตามดวง)</p>
            <p className="whitespace-pre-line text-[13px] leading-6 text-v3-text-body">{personal}</p>
            <button
              type="button"
              onClick={() => copy(personal, 'personal')}
              className="mt-2.5 grid h-9 w-full place-items-center rounded-full border border-[#eadfbf] bg-white text-[12px] font-bold text-v3-navy"
            >
              {personalCopied ? '✓ คัดลอกแล้ว' : 'คัดลอกบท'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
