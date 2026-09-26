// features/v2-share/components/BaziShareChart.tsx — เรนเดอร์ผังปาจื่อ + วัยจร/ปีจร + ธาตุ 5 บนหน้า invite ที่แชร์.
// เอ็ม 2026-09-26: ดวงธาตุที่แชร์ให้ขึ้น "ผังปาจื่อ + วัยจรปัจจุบัน + ปีจรปัจจุบัน (ทั้งตาราง) + จุดแข็ง-จุดอ่อน 5 ธาตุ".
//   ข้อมูลพร้อมแสดงมาจาก BaziSharePayload (สี/ป้ายคำนวณฝั่ง DestinyScreen) — คอมโพเนนต์นี้ไม่รู้ตรรกะปาจื่อ.
//   ดีไซน์มิเรอร์ตารางบน DestinyScreen (กล่องเสา 5 ช่อง + การ์ดวัยจร/ปีจรเลื่อนแนวนอน + แถวธาตุ).
import Image from 'next/image'
import type { BaziGlyph, BaziSharePayload } from '@/lib/v2/bazi-share'

function Glyph({ g, size = 30 }: { g?: BaziGlyph | null; size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-[8px] font-bold"
      style={{ width: size, height: size, fontSize: size * 0.5, background: g?.ink ? `${g.ink}1a` : '#f1f2f4', color: g?.ink ?? '#333' }}
    >
      {g?.ch ?? '-'}
    </span>
  )
}

function Qi({ label }: { label?: string | null }) {
  if (!label) return null
  return <span className="mt-0.5 rounded-full bg-v3-sapphire/10 px-1.5 py-0.5 text-[8px] font-bold leading-none text-v3-sapphire">{label}</span>
}

export function BaziShareChart({ bazi }: { bazi: BaziSharePayload }) {
  const hasLuck = bazi.luck?.length > 0
  const hasYears = bazi.years?.length > 0
  return (
    <div data-testid="invite-bazi" className="mt-3 flex flex-col gap-3">
      {/* ผังปาจื่อ — 5 เสา (ลัคนา/ยาม/วัน/เดือน/ปี) */}
      {bazi.pillars?.length ? (
        <section className="rounded-2xl border border-v3-border-card bg-white p-3">
          <p className="text-[13px] font-bold text-v3-navy">ผังปาจื่อ</p>
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {bazi.pillars.map((p, i) => (
              <div key={i} className="flex flex-col items-center rounded-[12px] border border-v3-border-card px-0.5 py-2">
                <span className="text-[10px] text-v3-text-muted">{p.label}</span>
                <span className="text-[15px] font-bold leading-5" style={{ color: p.stemInk }}>{p.stem}</span>
                <span className="text-center text-[8px] leading-tight text-v3-text-muted">{p.stemEn}</span>
                <span className="mt-0.5 text-[15px] font-bold leading-5" style={{ color: p.branchInk }}>{p.branch}</span>
                <span className="text-center text-[8px] capitalize leading-tight text-v3-text-muted">{p.branchEn}</span>
                {p.hidden?.length ? (
                  <span className="mt-1 flex items-center justify-center gap-0.5 border-t border-v3-border-card/60 pt-1">
                    {p.hidden.map((h, j) => (
                      <span key={j} className="text-[11px] font-bold leading-none" style={{ color: h.ink }}>{h.ch}</span>
                    ))}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* วัยจร / ปีจร — เลื่อนแนวนอน, ช่วง/ปีปัจจุบันไฮไลต์ */}
      {hasLuck || hasYears ? (
        <section className="rounded-2xl border border-v3-border-card bg-white p-3">
          <p className="text-[13px] font-bold text-v3-navy">ตารางวัยจร · ปีจร</p>
          {hasLuck ? (
            <div className="mt-2">
              <p className="text-[11px] font-bold text-v3-navy">วัยจร — ช่วงปัจจุบันไฮไลต์</p>
              <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1">
                {bazi.luck.map((d, i) => (
                  <div key={i} className={'flex w-[86px] shrink-0 flex-col items-center rounded-[12px] border p-1.5 ' + (d.current ? 'border-v3-warning bg-v3-warning/10' : 'border-v3-border-card bg-white')}>
                    <span className="text-[10px] font-bold text-v3-text-muted">{d.range}</span>
                    {d.phases?.length ? (
                      <div className="mt-1 flex w-full flex-col gap-1">
                        {d.phases.map((ph, j) => (
                          <div key={j} className="flex flex-col items-center rounded-[8px] py-1">
                            <span className="text-[8px] leading-tight text-v3-text-muted">{ph.range}</span>
                            <Glyph g={{ ch: ph.sym, ink: ph.ink }} />
                            <span className="text-[8px] leading-tight text-v3-text-muted">{ph.band}</span>
                            <Qi label={ph.qi} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-1 flex flex-col items-center gap-1"><Glyph g={d.stem} /><Glyph g={d.branch} /></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {hasYears ? (
            <div className="mt-3">
              <p className="text-[11px] font-bold text-v3-navy">ปีจร (รายปี) — ปีปัจจุบันไฮไลต์</p>
              <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1">
                {bazi.years.map((y, i) => (
                  <div key={i} className={'flex w-[70px] shrink-0 flex-col items-center rounded-[12px] border p-1.5 ' + (y.current ? 'border-v3-sapphire bg-v3-sapphire/5' : 'border-v3-border-card bg-white')}>
                    <span className="text-[10px] font-bold text-v3-navy">{y.year}</span>
                    <span className="text-[8px] leading-tight text-v3-text-muted">พ.ศ. {y.be}</span>
                    <span className="mt-1 flex flex-col items-center gap-0.5"><Glyph g={y.stem} size={26} /><Glyph g={y.branch} size={26} /></span>
                    <Qi label={y.qi} />
                    <span className="mt-0.5 text-[8px] leading-tight text-v3-text-muted">{y.age ?? ''}</span>
                    {y.clash ? <span className="text-[7px] font-bold leading-none text-v3-error">ชง</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* จุดแข็ง-จุดอ่อน 5 ธาตุ */}
      {bazi.elements?.length ? (
        <section className="rounded-2xl border border-v3-border-card bg-white p-3">
          <p className="text-[13px] font-bold text-v3-navy">จุดแข็ง-จุดอ่อน 5 ธาตุ</p>
          {bazi.headline ? <p className="mt-1 text-[15px] font-bold leading-6 text-v3-navy">{bazi.headline}</p> : null}
          {bazi.tagline ? <p className="text-[12px] leading-5 text-[#888]">{bazi.tagline}</p> : null}
          <div className="mt-2 flex flex-col gap-3">
            {bazi.elements.map((el, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="grid h-11 w-11 flex-none place-items-center overflow-hidden rounded-[14px]" style={{ backgroundColor: el.tint }}>
                  {el.mascot ? <Image src={el.mascot} alt="" width={28} height={34} unoptimized className="h-8 w-6 object-contain" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold leading-5 text-v3-navy">
                    ธาตุ{el.th}
                    {typeof el.count === 'number' ? <span className="ml-1 text-[12px] font-normal text-v3-text-muted">({el.count})</span> : null}
                  </p>
                  <p className="text-[12px] leading-4 text-[#888]">{el.role}</p>
                  {el.nisai ? <p className="mt-0.5 text-[12px] leading-[18px] text-v3-text-body">{el.nisai}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

export default BaziShareChart
