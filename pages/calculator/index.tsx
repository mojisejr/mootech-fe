// Public Bazi Calculator (#public-bazi-calculator). No login, free, unlimited.
// getServerSideProps issues the compute nonce cookie on every page load (lib/calculator/nonce.ts)
// — the compute API rejects requests without a valid one, which blocks direct scripted POSTs
// that never loaded this page, invisibly (no captcha).
//
// Re-theme Phase 1 (#calculator-reframe-v2, ฟีม froze 2026-07-15): the surface now wears the
// index.tsx brand mood — teal front-page canvas + top menu (HeaderMuMate) — with the result
// floating on a white card so the verified glow-on-light + 5-element contrast (≥4.5:1 on white)
// stay intact. The ดิถี hero is kept and bridges the teal→white seam; กำลังดิถี (strengthScore, real
// data) sits under it. Per-pillar 12-เชี่ยงแซ + pillar tap-sheet land in Phase 2 (needs goo's
// public-calc `pillars`/`strengthBand` fields — see FROZEN note).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import { issueNonce, NONCE_COOKIE } from '@/lib/calculator/nonce'
import { ELEMENT_LABEL_TH, type BaziElement } from '@/lib/calculator/elements'
import { mapPillarColumns } from '@/lib/calculator/map-pillars'
import { mapDecadeLuck, mapAnnualLuck } from '@/lib/calculator/map-timeline'
import { thaiToBaziElement } from '@/lib/calculator/map-enrichment'
import HeaderMuMate from '@/components/header-v2'
import { BirthForm, type BirthFormValue } from '@/components/calculator/BirthForm'
import { RitualLoader } from '@/components/calculator/RitualLoader'
import { DitiHero } from '@/components/calculator/DitiHero'
import { PillarGrid } from '@/components/calculator/PillarGrid'
import { LuckTimeline } from '@/components/calculator/LuckTimeline'
import { StrengthMeter } from '@/components/calculator/StrengthMeter'
import { CtaEarned } from '@/components/calculator/CtaEarned'
import type { Enrichment } from '@/pages/api/calculator/compute'

const TEAL_CANVAS = 'linear-gradient(180deg, #1B9AAF 0%, #3A78A9 62%, #325F86 100%)'
const HEADER_LOGO = '/images/mumate/ic_logo.svg'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const nonce = issueNonce()
  ctx.res.setHeader('Set-Cookie', `${NONCE_COOKIE}=${nonce}; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=600`)
  return { props: {} }
}

type ComputeResult = {
  dobThai: string
  yearOfZodiac: any
  summary: any
  detail: Record<string, any>
  cycleLife: any
  cycleYearLife: any[]
  enrichment: Enrichment | null
}

type Phase = 'form' | 'ritual' | 'result'

// อายุจีน = อายุไทย + 1 — computed frontend from the entered dob (no backend; goo confirmed the
// table is FE-only). Thai age = years since birth, minus one if this year's birthday hasn't passed.
function computeAges(dob?: string): { thaiAge: number; chineseAge: number } | null {
  if (!dob) return null
  const [y, m, d] = dob.split('-').map(Number)
  if (!y || !m || !d) return null
  const now = new Date()
  const reached = now.getMonth() + 1 > m || (now.getMonth() + 1 === m && now.getDate() >= d)
  const thaiAge = Math.max(now.getFullYear() - y - (reached ? 0 : 1), 0)
  return { thaiAge, chineseAge: thaiAge + 1 }
}

export default function CalculatorPage() {
  const [phase, setPhase] = useState<Phase>('form')
  const [result, setResult] = useState<ComputeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRepeat, setIsRepeat] = useState(false)
  const [pendingInput, setPendingInput] = useState<BirthFormValue | null>(null)
  const inputRef = useRef<HTMLElement>(null)
  const prefersReducedMotion = useReducedMotion()
  // Gate motion-dependent markup to after mount so SSR/first-client render is deterministic
  // (useReducedMotion resolves client-side only → animating className mismatches on hydration).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // ACT 1 → ACT 2 (#calculator-hero-flow): gentle smooth-scroll to the input, then move focus into
  // it. Motion doctrine = minimal — the hero doesn't move/scale, we only scroll and the input fades
  // in on arrival. reduced-motion: instant jump.
  const scrollToInput = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion ? 'auto' : 'smooth' })
    el.focus({ preventScroll: true })
  }, [prefersReducedMotion])

  const handleSubmit = useCallback((value: BirthFormValue) => {
    setError(null)
    setPendingInput(value)
    setPhase('ritual')
  }, [])

  const handleRitualComplete = useCallback(async () => {
    if (!pendingInput) return
    try {
      const res = await fetch('/api/calculator/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingInput),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body?.error?.message ?? 'คำนวณไม่สำเร็จ ลองใหม่อีกครั้ง')
        setPhase('form')
        return
      }
      setResult(body.data)
      setPhase('result')
    } catch {
      setError('เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง')
      setPhase('form')
    }
  }, [pendingInput])

  const handleTryAnother = useCallback(() => {
    setIsRepeat(true)
    setResult(null)
    setPhase('form')
  }, [])

  const columns = result ? mapPillarColumns(result.detail) : []
  const dayColumn = columns.find((c) => c.isDay)
  // ดิถี glyph/element: prefer bazi-sft's own day pillar (enrichment.pillars) so the hero glyph, its
  // strength, and the pillar เชี่ยงแซ all come from ONE engine (data-correctness rule). Fall back to
  // mootech-be's day column when enrichment is unavailable.
  const enrichmentPillars = result?.enrichment?.pillars
  const ditiEnrich = enrichmentPillars?.day
  const ditiGlyph = ditiEnrich?.stem ?? dayColumn?.above?.chinese_symbol ?? ''
  const ditiElement = (ditiEnrich ? thaiToBaziElement(ditiEnrich.stemElement) : dayColumn?.above?.element) as
    | BaziElement
    | undefined
  const decades = result ? mapDecadeLuck(result.cycleLife) : []
  const annual = result ? mapAnnualLuck(result.cycleYearLife) : []
  const strengthScore = result?.enrichment?.strengthScore
  const ages = computeAges(pendingInput?.dob)

  return (
    <>
      <Head>
        <title>ผังชะตากำเนิดของคุณ — MuMate</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main className="min-h-screen" style={{ background: TEAL_CANVAS }}>
        <HeaderMuMate isShowMenu={false} isLogin={false} isShowProfile={true} gateByLogin image={HEADER_LOGO} />

        <div className="pt-[60px]">
          {phase === 'form' && (
            <>
              {/* ACT 1 — HERO (index marketing tone; greets before the calculator so it never reads
                  as a bare tool). ข้อ③ copy lives here. */}
              <section className="flex min-h-[calc(100vh-60px)] flex-col text-white">
                {/* copy + CTA + cue centered in the flexible upper area */}
                <div className="flex flex-1 flex-col items-center justify-center px-6 pt-6 text-center">
                  <Image src="/images/mumate/ic_sparkles.svg" width={36} height={36} alt="" aria-hidden="true" />
                  <h1 className="mt-2 font-prompt text-[32px] font-semibold leading-tight">
                    Mumate ดูดวงแบบ
                    <br />
                    <span className="text-[#F3FCA2]">Personal Destiny</span>
                  </h1>
                  <p className="mt-3 max-w-sm font-ibm text-[15px] text-white/90">
                    AI อัจฉริยะ ดูดวงละเอียด การงาน เงิน ความรัก
                    <br />
                    รู้ลึก รู้จริง · ไม่ต้องรอคิว
                  </p>
                  <div className="relative mt-8">
                    <button
                      type="button"
                      onClick={scrollToInput}
                      className="flex items-center gap-2 rounded-[40px] bg-white px-8 py-3.5 font-prompt text-lg font-semibold text-[#1B9AAF] shadow-custom"
                    >
                      คำนวนฟรี
                      <Image src="/images/mumate/ic_arrow_next.svg" width={26} height={26} alt="" aria-hidden="true" />
                    </button>
                    <Image
                      src="/images/mumate/ic_sparkles.svg"
                      width={26}
                      height={26}
                      alt=""
                      aria-hidden="true"
                      className="pointer-events-none absolute -left-2 -top-2"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={scrollToInput}
                    aria-label="เลื่อนไปกรอกวันเกิด"
                    className={'mt-6 text-2xl text-white/80' + (mounted && !prefersReducedMotion ? ' animate-bounce' : '')}
                  >
                    ⌄
                  </button>
                </div>
                {/* mascot — full-width bottom anchor (edge-to-edge on mobile, capped on desktop),
                    shown complete so it never reads as a cropped card (layout A) */}
                <div className="mt-6 w-full">
                  <Image
                    src="/images/mumate/img_footer_login.png"
                    width={600}
                    height={240}
                    alt=""
                    aria-hidden="true"
                    className="mx-auto h-auto w-full max-w-md"
                    priority
                  />
                </div>
              </section>

              {/* ACT 2 — INPUT (same page, revealed by the smooth-scroll). No entrance animation:
                  the scroll IS the motion (minimal doctrine) + keeps this SSR'd section hydration-clean. */}
              <section ref={inputRef} tabIndex={-1} className="px-4 pb-20 pt-2 outline-none">
                <p className="mb-4 text-center font-prompt text-lg font-semibold text-white">กรอกวันเกิดเพื่อดูผัง</p>
                {error && <p className="mx-auto mb-4 max-w-md text-center font-ibm text-sm text-[#FFE1DE]">{error}</p>}
                <BirthForm onSubmit={handleSubmit} />
              </section>
            </>
          )}

          {phase === 'ritual' && <RitualLoader onComplete={handleRitualComplete} isRepeat={isRepeat} />}

          {phase === 'result' && result && (
            <div className="mx-auto max-w-2xl px-4 pb-20 pt-4">
              {/* hero — ดิถี circle IS the answer ("คุณเป็นคนธาตุ…"), on the teal canvas (no white card) */}
              <div className="text-center text-white">
                <p className="inline-flex items-center gap-1.5 font-ibm text-[13px] text-white/90">
                  <Image src="/images/mumate/ic_sparkles.svg" width={16} height={16} alt="" aria-hidden="true" />
                  ผังดวงจีนของคุณ · ฟรี ไม่ต้องล็อกอิน
                </p>
                <h1 className="mt-2 font-prompt text-[24px] font-semibold leading-snug">
                  คุณเป็นคน
                  {ditiElement ? <span className="text-[#F3FCA2]">ธาตุ{ELEMENT_LABEL_TH[ditiElement]}</span> : 'ธาตุ…'}
                </h1>
                {ages && (
                  <p className="mb-6 mt-1 font-ibm text-[13px] text-white/85">
                    อายุ {ages.thaiAge} ปี · อายุจีน {ages.chineseAge} ปี
                  </p>
                )}
                <DitiHero glyph={ditiGlyph} element={ditiElement} reveal />
              </div>

              {/* กำลังดิถี — real strengthScore, frosted pill under the hero (the self's power) */}
              {typeof strengthScore === 'number' && (
                <div className="mx-auto mt-6 max-w-md">
                  <StrengthMeter score={strengthScore} element={ditiElement} bandId={(result.enrichment as any)?.strengthBand?.id} />
                </div>
              )}

              {/* connector: hero → the ผัง below */}
              <div aria-hidden="true" className="mx-auto my-7 h-7 w-px bg-white/35" />

              <p className="mb-3 text-center font-ibm text-[13px] text-white/90">พื้นดวง · ลัคนา · ยาม · วัน · เดือน · ปี</p>
              <PillarGrid
                columns={columns}
                enrichmentPillars={enrichmentPillars}
                reveal
                badges={(result?.enrichment?.badges ?? []).filter((b) => b.point.startsWith('pillar-'))}
              />

              <div className="mt-9">
                <LuckTimeline decades={decades} annual={annual} enrichment={result?.enrichment ?? null} />
              </div>

              <CtaEarned onTryAnother={handleTryAnother} />
            </div>
          )}
        </div>
      </main>
    </>
  )
}
