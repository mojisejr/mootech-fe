// honeycomb-parts.tsx — ส่วน render ของ "เบอร์รังผึ้ง" (พีระมิด + ชั้น) ใช้ร่วมในหน้าดูเบอร์มือถือ (โหมด honeycomb)
import { useState } from "react"

export type HcPairMeaning = { pair: string; feeling: string; work: string; money: string; love: string; analysis: string }
export type HoneycombPair = { pair: string; key: string; a: number; b: number; meaning: HcPairMeaning }
export type DigitInfo = { digit: number; planet: string; element: string; keyword: string }
export type HcZone = "self" | "near" | "far"
export type HoneycombLayer = { layerNo: number; digits: number[]; digitString: string; zone: HcZone; pairs: HoneycombPair[]; digitMeaning?: DigitInfo }
export type HoneycombReading = { input: string; normalized: string; rows: number[][]; layers: HoneycombLayer[] }

export const HC_ZONE_LABEL: Record<HcZone, string> = { self: "ตัวเรา", near: "คนใกล้ตัว", far: "คนห่างตัว" }
const ZONE_CHIP: Record<HcZone, string> = { self: "bg-v3-lime text-v3-navy", near: "bg-v3-cyan text-white", far: "bg-white text-v3-navy" }
const ZONE_PILL: Record<HcZone, string> = { self: "bg-v3-lime/20 text-v3-navy", near: "bg-v3-cyan/15 text-v3-cyan", far: "bg-v3-ghost-white text-v3-text-muted" }
export function zoneOfLayer(n: number): HcZone { return n <= 4 ? "self" : n <= 6 ? "near" : "far" }

export function buildHoneycombEngineText(r: HoneycombReading): string {
  const lines: string[] = [`เบอร์ ${r.normalized} (พีระมิดรังผึ้ง)`]
  const apex = r.layers.find((l) => l.layerNo === 1)
  if (apex?.digitMeaning) lines.push(`ยอดปิรามิด (แก่นเบอร์ = ตัวเรา) เลข ${apex.digitMeaning.digit}: ${apex.digitMeaning.keyword} (${apex.digitMeaning.planet}/ธาตุ${apex.digitMeaning.element})`)
  for (const l of r.layers) {
    if (!l.pairs.length) continue
    const top = l.pairs.slice(0, 3).map((p) => `${p.pair} ${p.meaning.analysis}`).join(" | ")
    lines.push(`ชั้น ${l.layerNo} [${HC_ZONE_LABEL[l.zone]}] ${l.digitString}: ${top}`)
  }
  return lines.join("\n")
}

// พีระมิด: rows[0] = ฐานกว้างสุด … rows[last] = ยอด. สีชิปตามโซน (ความยาวแถว = เลขชั้น)
export function Pyramid({ rows }: { rows: number[][] }) {
  return (
    <div className="flex flex-col items-stretch gap-1.5" data-testid="honeycomb-pyramid">
      {rows.map((row, i) => {
        const layerNo = row.length
        const zone = zoneOfLayer(layerNo)
        return (
          <div key={i} className="flex items-center gap-1">
            <span className="w-9 flex-none text-right text-[10px] font-bold text-white/70">ชั้น {layerNo}</span>
            <div className="flex flex-1 flex-nowrap justify-center gap-0.5">
              {row.map((d, j) => (
                <span key={j} className={"grid size-[22px] flex-none place-items-center rounded-md text-[11px] font-black " + ZONE_CHIP[zone]}>{d}</span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// การ์ดชั้นแบบพับได้
export function LayerRow({ l, defaultOpen }: { l: HoneycombLayer; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen)
  const fields = (m: HcPairMeaning) => ([
    { label: "บุคลิกภาพ", icon: "🧑", text: m.feeling },
    { label: "การงาน", icon: "💼", text: m.work },
    { label: "การเงิน", icon: "💰", text: m.money },
    { label: "ความรัก", icon: "❤️", text: m.love },
    { label: "บทวิเคราะห์", icon: "⭐", text: m.analysis },
  ].filter((f) => f.text))
  return (
    <div className="rounded-[16px] bg-white p-4 v3-shadow-card" data-testid="honeycomb-layer">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 text-left">
        <span className="grid size-10 flex-none place-items-center rounded-[14px] bg-[#EAF7EA] text-[16px] font-black text-[#3E7E3A]">{l.layerNo}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-black text-v3-navy">ชั้น {l.layerNo} · {l.digitString}</span>
          <span className={"mt-0.5 inline-block rounded-full px-2 py-[1px] text-[11px] font-bold " + ZONE_PILL[l.zone]}>{HC_ZONE_LABEL[l.zone]}</span>
        </span>
        <span className={"flex-none text-[14px] text-v3-text-muted transition-transform " + (open ? "rotate-180" : "")}>⌄</span>
      </button>
      {open ? (
        <div className="mt-3 flex flex-col gap-3 border-t border-dashed border-v3-border-card pt-3">
          {l.digitMeaning ? (
            <div className="rounded-[12px] bg-[#EDF7EE] p-3">
              <p className="text-[13px] font-black text-[#2F7A46]">ยอดปิรามิด · เลข {l.digitMeaning.digit}</p>
              <p className="mt-0.5 text-[13px] leading-6 text-v3-text-body">{l.digitMeaning.keyword} · {l.digitMeaning.planet} · ธาตุ{l.digitMeaning.element}</p>
            </div>
          ) : null}
          {l.pairs.map((p, pi) => (
            <div key={pi} className="flex flex-col gap-2">
              <p className="text-[13px] font-black text-v3-sapphire">คำทำนายรายคู่ {p.pair}</p>
              {fields(p.meaning).map((f) => (
                <div key={f.label}>
                  <p className="flex items-center gap-1.5 text-[13px] font-black text-v3-navy"><span>{f.icon}</span>{f.label}</p>
                  <p className="mt-0.5 text-[13px] leading-6 text-v3-text-body">{f.text}</p>
                </div>
              ))}
            </div>
          ))}
          {!l.digitMeaning && !l.pairs.length ? <p className="text-[13px] text-v3-text-muted">—</p> : null}
        </div>
      ) : null}
    </div>
  )
}
