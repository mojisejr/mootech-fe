// features/v2-destiny/components/DestinyScreen.tsx — จอ "ดวงของฉัน" (/v2/destiny).
//
// Design: Figma "Mumate app_ final" → page "ดวงฉัน" → frame node 55349-3070 (393×8028,
// FIXED + SCROLLS). Full element inventory: docs/duang-chan-spec.md. Data: POST /api/destiny
// (BFF) — birth resolved server-side from cookie-mumate-id; engine = bazi pdf-dev:
//   element-summary {dayMaster,dayGanzhi,elementTh,tagline,traits,advice}
//   life-timeline    {currentAge,favorableElementsTh,stages,current,years,cautionYears,note}
//   strength-score   {dayMaster,strengthScore,explainable}
//   domain-power     {domainPower:{career|learning|friends|wealth:{score,band}}}
//   calculate        {calculatedState:{fourPillars{year,month,day,hour},mingGong,elementAnalysis}}
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { SHOP_HREF } from "@/features/v2-shop/upgrade-cta"

type ElementSummary = {
  dayMaster: string
  dayGanzhi: string
  elementTh: string
  tagline: string
  traits: string[]
  advice: string[]
}
type LifeTimeline = {
  currentAge: number
  favorableElementsTh?: string[]
  current?: { startAge: number; endAge: number; ganzhi: string; upperState?: string; lowerState?: string }
  years?: Array<Record<string, unknown>>
  cautionYears?: Array<Record<string, unknown>>
  note?: string
}
type DestinyData = {
  elementSummary: ElementSummary | null
  lifeTimeline: LifeTimeline | null
  strengthScore: { dayMaster: string; strengthScore: number } | null
  domainPower: { domainPower: Record<string, { score: number; band?: string }> } | null
  calculatedState: {
    fourPillars?: Record<string, { stem: string; branch: string }>
    mingGong?: { stem: string; branch: string }
    elementAnalysis?: {
      totalCounts?: Record<string, number>
      dominantElements?: string[]
      missingElements?: string[]
    }
  } | null
}

const DOMAIN_TH: Record<string, string> = {
  career: "การงาน",
  learning: "การเรียนรู้",
  friends: "เพื่อน",
  wealth: "การเงิน",
}
const ELEMENT_TH: Record<string, string> = {
  wood: "ไม้",
  fire: "ไฟ",
  earth: "ดิน",
  metal: "ทอง",
  water: "น้ำ",
}
const PILLAR_LABEL: Record<string, string> = {
  year: "ปี",
  month: "เดือน",
  day: "วัน",
  hour: "เวลา",
  mingGong: "ลัคนา",
}

function gradeOf(score: number): string {
  if (score >= 90) return "A"
  if (score >= 70) return "B"
  if (score >= 50) return "C+"
  return "C"
}

function num(row: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === "number" && Number.isFinite(v)) return v
  }
  return null
}

function LifePathChart({ years }: { years: Array<Record<string, unknown>> }) {
  const points = years
    .map((row, i) => ({
      x: num(row, ["age", "year", "index"]) ?? i,
      y: num(row, ["score", "value", "strength", "power"]) ?? i,
    }))
    .slice(0, 40)
  if (points.length < 2) return null
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys, 0)
  const maxY = Math.max(...ys, 100)
  const W = 320
  const H = 96
  const px = (x: number) => ((x - minX) / (maxX - minX || 1)) * (W - 8) + 4
  const py = (y: number) => H - 6 - ((y - minY) / (maxY - minY || 1)) * (H - 12)
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ")
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" data-testid="destiny-life-chart" aria-hidden>
      <path d={d} fill="none" stroke="#1455A4" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={px(points[points.length - 1].x)} cy={py(points[points.length - 1].y)} r="3.5" fill="#1455A4" />
    </svg>
  )
}

export function DestinyScreen() {
  const [data, setData] = useState<DestinyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [guard, setGuard] = useState<"not_authenticated" | "profile_incomplete" | null>(null)
  const [showDomains, setShowDomains] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch("/api/destiny", { method: "POST" })
        if (res.status === 401) return setGuard("not_authenticated")
        if (res.status === 409) return setGuard("profile_incomplete")
        if (!res.ok) throw new Error(String(res.status))
        const j = (await res.json()) as DestinyData
        if (alive) setData(j)
      } catch {
        if (alive) setGuard("profile_incomplete") // ไม่รู้สถานะ → ไม่เดาสิทธิ์ (#384 class)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const summary = data?.elementSummary ?? null
  const pillars = data?.calculatedState?.fourPillars ?? null
  const mingGong = data?.calculatedState?.mingGong ?? null
  const analysis = data?.calculatedState?.elementAnalysis ?? null
  const timeline = data?.lifeTimeline ?? null
  const domains = Object.entries(data?.domainPower?.domainPower ?? {})
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const topDomains = domains.slice(0, 3)
  const mascotUrl = summary ? `/api/bazi-mascot?ganzhi=${encodeURIComponent(summary.dayGanzhi)}` : null

  const shareToday = async () => {
    const payload = {
      title: "Mumate — ดวงของฉันวันนี้",
      text: "ดูดวงของฉันด้วย Mumate",
      url: typeof window !== "undefined" ? window.location.origin : "",
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(payload)
      } catch {
        // ผู้ใช้ยกเลิกแชร์ — ไม่เป็นอะไร
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(payload.url).catch(() => {})
    }
  }

  return (
    <div className="font-ibm min-h-[100dvh] w-full bg-v3-bg-cream pb-10">
      <Head>
        <title>ดวงของฉัน — Mumate</title>
      </Head>

      {/* header — ← · ดวงของฉัน (แบบ FIXED ใน Figma; bell/avatar ใช้ cluster เดิมของ /v2) */}
      <header className="flex w-full items-center gap-2 px-4 pt-4">
        <Link
          href="/v2"
          aria-label="ย้อนกลับ"
          data-testid="destiny-back"
          className="grid h-9 w-9 flex-none place-items-center rounded-full text-v3-navy hover:bg-black/5"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="text-lg font-black leading-6 text-v3-navy">ดวงของฉัน</h1>
      </header>

      {loading && (
        <div className="px-4 pt-4" data-testid="destiny-loading">
          <div className="h-[260px] w-full animate-pulse rounded-[20px] bg-v3-sapphire/20" />
          <div className="mt-3 h-[120px] w-full animate-pulse rounded-[20px] bg-white" />
          <div className="mt-3 h-[160px] w-full animate-pulse rounded-[20px] bg-white" />
        </div>
      )}

      {!loading && guard === "not_authenticated" && (
        <div className="mx-4 mt-4 rounded-[20px] bg-white p-5 text-center shadow-[0_4px_15px_rgba(26,38,77,0.12)]" data-testid="destiny-guard-auth">
          <p className="text-sm font-bold text-v3-navy">ไม่พบข้อมูลผู้ใช้</p>
          <Link href="/v2/login" className="mt-3 grid h-11 place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
            เข้าสู่ระบบ
          </Link>
        </div>
      )}
      {!loading && guard === "profile_incomplete" && (
        <div className="mx-4 mt-4 rounded-[20px] bg-white p-5 text-center shadow-[0_4px_15px_rgba(26,38,77,0.12)]" data-testid="destiny-guard-profile">
          <p className="text-sm font-bold text-v3-navy">ข้อมูลวันเกิดยังไม่ครบ</p>
          <p className="mt-1 text-[12px] leading-4 text-v3-text-body">กรอกวัน เวลา และที่เกิดให้ครบ เพื่อให้ระบบคำนวณดวงของคุณได้</p>
          <Link href="/v2/register" className="mt-3 grid h-11 place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
            กรอกข้อมูลวันเกิด
          </Link>
        </div>
      )}

      {!loading && data && (
        <>
          {/* FIXED — การ์ดน้ำเงิน: มาสคอต + ชื่อ + 3 แถบคะแนน A/B/C+ */}
          <section className="mx-4 mt-3 overflow-hidden rounded-[20px] bg-v3-sapphire p-5 text-white" data-testid="destiny-hero">
            {mascotUrl && (
              <span className="mx-auto block h-[170px] w-[170px] overflow-hidden rounded-[16px] bg-white/10">
                <Image src={mascotUrl} alt="มาสคอตประจำวันเกิด" width={340} height={340} unoptimized className="h-full w-full object-contain" />
              </span>
            )}
            <p className="mt-3 text-center text-lg font-black leading-6">
              {summary ? `ดวงของคุณ ธาตุ${summary.elementTh}` : "ดวงของฉัน"}
            </p>
            <p className="mx-auto mt-1 max-w-[300px] text-center text-[12px] leading-[18px] text-white/80">
              {summary?.tagline ?? "ครบทุกเรื่องที่ต้องรู้ วิเคราะห์ลึกถึงรายด้าน จบในแพ็กเกจเดียว"}
            </p>

            <div className="mt-4 flex flex-col gap-3">
              {topDomains.map((d) => (
                <div key={d.key} className="flex items-center gap-3">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-white/15 text-[16px]">
                    {d.key === "career" ? "💼" : d.key === "wealth" ? "💰" : d.key === "friends" ? "🤝" : "📚"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-[12px] font-medium">
                      <span>{DOMAIN_TH[d.key] ?? d.key}</span>
                      <span>{Math.round(d.score ?? 0)}%</span>
                    </div>
                    <div className="mt-1 h-[6px] w-full rounded-full bg-white/20">
                      <div className="h-[6px] rounded-full bg-v3-lime" style={{ width: `${Math.round(d.score ?? 0)}%` }} />
                    </div>
                  </div>
                  <span className="grid h-7 w-9 flex-none place-items-center rounded-full bg-emerald-400 text-[12px] font-black text-emerald-950">
                    {gradeOf(d.score ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ป้ายปักหมุด: แชร์วันนี้รับ +10 QI + ปุ่ม Mate AI */}
          <div className="mx-4 mt-3 flex items-center gap-2" data-testid="destiny-share-pill">
            <button
              onClick={shareToday}
              data-testid="destiny-share"
              className="flex h-[56px] min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-white text-[13px] font-bold text-v3-navy shadow-[0_4px_15px_rgba(26,38,77,0.12)] transition active:scale-[0.99]"
            >
              <span aria-hidden>🪙</span> แชร์สะสมวันนี้ รับ +10 QI
            </button>
            <Link
              href="/v2/chat"
              aria-label="Mate AI"
              data-testid="destiny-mate-ai"
              className="grid h-[56px] w-[64px] flex-none place-items-center rounded-full bg-v3-lime text-[11px] font-black text-v3-sapphire shadow-[0_4px_15px_rgba(26,38,77,0.12)]"
            >
              Mate AI
            </Link>
          </div>

          <div className="mx-4 mt-4 flex flex-col gap-4">
            {/* ดวงจะส่งผล 8 ด้าน — ชิปเสา + จุดอ่อน 4 ด้าน */}
            <section className="rounded-[20px] bg-white p-5 shadow-[0_4px_15px_rgba(26,38,77,0.12)]" data-testid="destiny-pillars">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-v3-navy">ดวงจะส่งผล 8 ด้าน</h2>
                <button
                  onClick={() => setShowDomains((v) => !v)}
                  aria-expanded={showDomains}
                  data-testid="destiny-domains-toggle"
                  className="text-v3-text-muted"
                  aria-label="แสดงจุดอ่อนของ 5 ด้าน"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={{ transform: showDomains ? "rotate(180deg)" : undefined }}>
                    <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {pillars
                  ? Object.entries(pillars)
                      .slice(0, 4)
                      .concat(mingGong ? [["mingGong", mingGong]] : [])
                      .map(([key, p]) => (
                        <div key={key} className="flex flex-col items-center rounded-[12px] border border-v3-border-card py-2">
                          <span className="text-[10px] text-v3-text-muted">{PILLAR_LABEL[key] ?? key}</span>
                          <span className="text-[15px] font-bold leading-5 text-v3-navy">{p.stem}</span>
                          <span className="text-[12px] leading-4 text-v3-text-body">{p.branch}</span>
                        </div>
                      ))
                  : null}
              </div>
              <button
                onClick={() => setShowDomains((v) => !v)}
                data-testid="destiny-weakness-toggle"
                className="mt-3 grid h-9 w-full place-items-center rounded-full border border-v3-sapphire/30 text-[12px] font-medium text-v3-sapphire"
              >
                {showDomains ? "ซ่อนจุดอ่อนของ 5 ด้าน ↑" : "โชว์จุดอ่อนของ 5 ด้าน ↓"}
              </button>
              {showDomains && (
                <div className="mt-3 flex flex-col gap-2" data-testid="destiny-domains">
                  {domains.map((d) => (
                    <div key={d.key} className="flex items-center justify-between rounded-[12px] bg-v3-ghost-white px-3 py-2 text-[12px]">
                      <span className="font-medium text-v3-navy">{DOMAIN_TH[d.key] ?? d.key}</span>
                      <span className="text-v3-text-body">
                        {Math.round(d.score ?? 0)}% · {gradeOf(d.score ?? 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ธาตุของคุณ */}
            {summary && (
              <section className="rounded-[20px] bg-white p-5 shadow-[0_4px_15px_rgba(26,38,77,0.12)]" data-testid="destiny-element">
                <h2 className="text-base font-bold text-v3-navy">ธาตุของคุณ</h2>
                <p className="mt-1 text-[13px] font-bold text-v3-sapphire">
                  ธาตุ{summary.elementTh} · {summary.dayMaster} ({summary.dayGanzhi})
                </p>
                <p className="mt-1 text-[13px] leading-[20px] text-v3-text-body">{summary.tagline}</p>
                {summary.traits?.length > 0 && (
                  <>
                    <p className="mt-3 text-[12px] font-bold text-v3-navy">ลักษณะเด่น</p>
                    <ul className="mt-1 list-disc pl-5 text-[13px] leading-[20px] text-v3-text-body">
                      {summary.traits.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </>
                )}
                {summary.advice?.length > 0 && (
                  <>
                    <p className="mt-3 text-[12px] font-bold text-v3-navy">คำแนะนำ</p>
                    <ul className="mt-1 list-disc pl-5 text-[13px] leading-[20px] text-v3-text-body">
                      {summary.advice.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </>
                )}
                {timeline?.favorableElementsTh && timeline.favorableElementsTh.length > 0 && (
                  <p className="mt-3 text-[12px] text-v3-text-body">
                    ธาตุที่ช่วยสมดุล:{" "}
                    <span className="font-bold text-v3-sapphire">{timeline.favorableElementsTh.join(" · ")}</span>
                  </p>
                )}
              </section>
            )}

            {/* ธาตุสมดุล */}
            {analysis?.totalCounts && (
              <section className="rounded-[20px] bg-white p-5 shadow-[0_4px_15px_rgba(26,38,77,0.12)]" data-testid="destiny-balance">
                <h2 className="text-base font-bold text-v3-navy">ธาตุสมดุล</h2>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {Object.entries(analysis.totalCounts).map(([k, count]) => (
                    <div key={k} className="flex flex-col items-center rounded-[12px] border border-v3-border-card py-2">
                      <span className="text-[11px] text-v3-text-muted">{ELEMENT_TH[k] ?? k}</span>
                      <span className="text-[15px] font-bold text-v3-navy">{count}</span>
                    </div>
                  ))}
                </div>
                {analysis.dominantElements && analysis.dominantElements.length > 0 && (
                  <p className="mt-2 text-[12px] text-v3-text-body">
                    ธาตุเด่น: <span className="font-bold text-v3-sapphire">{analysis.dominantElements.map((e) => ELEMENT_TH[e] ?? e).join(" · ")}</span>
                  </p>
                )}
                {analysis.missingElements && analysis.missingElements.length > 0 && (
                  <p className="mt-1 text-[12px] text-v3-text-body">
                    ธาตุที่ควรเสริม: <span className="font-bold text-v3-pumpkin">{analysis.missingElements.map((e) => ELEMENT_TH[e] ?? e).join(" · ")}</span>
                  </p>
                )}
              </section>
            )}

            {/* อนาคตของคุณ (Life Path) */}
            {timeline && (
              <section className="rounded-[20px] bg-white p-5 shadow-[0_4px_15px_rgba(26,38,77,0.12)]" data-testid="destiny-lifepath">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-v3-navy">อนาคตของคุณ (Life Path)</h2>
                  {typeof timeline.currentAge === "number" && (
                    <span className="rounded-full bg-v3-sapphire/10 px-3 py-1 text-[12px] font-bold text-v3-sapphire">
                      ตอนนี้อายุ {timeline.currentAge}
                    </span>
                  )}
                </div>
                {timeline.current && (
                  <p className="mt-2 text-[13px] leading-[20px] text-v3-text-body">
                    วัยจรปัจจุบัน {timeline.current.startAge}–{timeline.current.endAge} ({timeline.current.ganzhi})
                    {timeline.current.upperState ? ` · ${timeline.current.upperState}` : ""}
                  </p>
                )}
                {timeline.years && timeline.years.length > 1 && <LifePathChart years={timeline.years} />}
                {timeline.cautionYears && timeline.cautionYears.length > 0 && (
                  <p className="mt-2 text-[12px] text-v3-text-body">
                    ปีที่ควรระวัง:{" "}
                    <span className="font-bold text-v3-pumpkin">
                      {timeline.cautionYears
                        .map((y) => String(y.year ?? y.age ?? ""))
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </p>
                )}
              </section>
            )}

            {/* จองไว้ล่วงหน้า — ปลดล็อกรายบทด้วย 30 QI (วางบิล Day 3) */}
            <section className="rounded-[20px] bg-white p-5 shadow-[0_4px_15px_rgba(26,38,77,0.12)]" data-testid="destiny-preorder">
              <h2 className="text-base font-bold text-v3-navy">จองไว้ล่วงหน้า</h2>
              {["อ่านดวงสุขภาพเจาะลึก", "อ่านดวงการเงินเจาะลึก"].map((title) => (
                <Link
                  key={title}
                  href={SHOP_HREF}
                  data-testid="destiny-preorder-row"
                  className="mt-3 flex items-center justify-between rounded-[14px] border border-v3-border-card px-4 py-3"
                >
                  <span className="text-[13px] font-medium text-v3-navy">{title}</span>
                  <span className="rounded-full bg-v3-lime px-2 py-[2px] text-[11px] font-black text-v3-navy">30 QI</span>
                </Link>
              ))}
              <p className="mt-2 text-[11px] leading-4 text-v3-text-muted">
                TODO(figma-copy): ชื่อบทต้องมาจากรายการบทจริงของ engine — ยืนยันกับ design ตอนทำระบบ QI (Day 3)
              </p>
            </section>

            {/* การ์ดชวนเพื่อน */}
            <Link
              href="/v2/service/coming-soon?service=%E0%B8%8A%E0%B8%A7%E0%B8%99%E0%B9%80%E0%B8%9E%E0%B8%B7%E0%B9%88%E0%B8%AD%E0%B8%99"
              data-testid="destiny-referral"
              className="flex items-center justify-between rounded-[20px] bg-v3-sapphire/10 p-4"
            >
              <div>
                <p className="text-[13px] font-bold text-v3-sapphire">ชวนเพื่อนมารับ รับคนละ 50 QI</p>
                <p className="mt-1 text-[12px] leading-4 text-v3-text-body">เพื่อนสมัครรับฟรี คุณได้ 30 QI ใช้ซื้ออะไรก็ได้</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-v3-sapphire">
                <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

export default DestinyScreen
