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
import { useCallback, useState } from 'react'
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

export default function CalculatorPage() {
  const [phase, setPhase] = useState<Phase>('form')
  const [result, setResult] = useState<ComputeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRepeat, setIsRepeat] = useState(false)
  const [pendingInput, setPendingInput] = useState<BirthFormValue | null>(null)

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

  return (
    <>
      <Head>
        <title>ผังชะตากำเนิดของคุณ — MuMate</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main className="min-h-screen" style={{ background: TEAL_CANVAS }}>
        <HeaderMuMate isShowMenu={false} isLogin={false} isShowProfile={false} image={HEADER_LOGO} />

        <div className="pt-[60px]">
          {phase === 'form' && (
            <div className="px-4 pb-16 pt-8">
              <div className="mb-5 text-center text-white">
                <p className="inline-flex items-center gap-1.5 font-ibm text-[13px] text-white/90">
                  <Image src="/images/mumate/ic_sparkles.svg" width={16} height={16} alt="" aria-hidden="true" />
                  ผังดวงจีนของคุณ · ฟรี ไม่ต้องล็อกอิน
                </p>
              </div>
              {error && <p className="mx-auto mb-4 max-w-md text-center font-ibm text-sm text-[#FFE1DE]">{error}</p>}
              <BirthForm onSubmit={handleSubmit} />
            </div>
          )}

          {phase === 'ritual' && (
            <div className="flex min-h-[70vh] items-center justify-center px-4">
              <div className="w-full max-w-md rounded-[26px] bg-moumate_white p-8 shadow-custom">
                <RitualLoader onComplete={handleRitualComplete} isRepeat={isRepeat} />
              </div>
            </div>
          )}

          {phase === 'result' && result && (
            <div className="mx-auto max-w-2xl px-4 pb-20 pt-4">
              {/* hero — ดิถี circle IS the answer ("คุณเป็นคนธาตุ…"), on the teal canvas (no white card) */}
              <div className="text-center text-white">
                <p className="inline-flex items-center gap-1.5 font-ibm text-[13px] text-white/90">
                  <Image src="/images/mumate/ic_sparkles.svg" width={16} height={16} alt="" aria-hidden="true" />
                  ผังดวงจีนของคุณ · ฟรี ไม่ต้องล็อกอิน
                </p>
                <h1 className="mb-6 mt-2 font-prompt text-[24px] font-semibold leading-snug">
                  คุณเป็นคน
                  {ditiElement ? <span className="text-[#F3FCA2]">ธาตุ{ELEMENT_LABEL_TH[ditiElement]}</span> : 'ธาตุ…'}
                </h1>
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
