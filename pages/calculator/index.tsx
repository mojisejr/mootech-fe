// Public Bazi Calculator (#public-bazi-calculator). No login, free, unlimited.
// getServerSideProps issues the compute nonce cookie on every page load (lib/calculator/nonce.ts)
// — the compute API rejects requests without a valid one, which blocks direct scripted POSTs
// that never loaded this page, invisibly (no captcha).
import { useCallback, useState } from 'react'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { issueNonce, NONCE_COOKIE } from '@/lib/calculator/nonce'
import { hexToRgba } from '@/lib/calculator/color'
import { elementColor } from '@/lib/calculator/elements'
import { mapPillarColumns } from '@/lib/calculator/map-pillars'
import { mapDecadeLuck, mapAnnualLuck } from '@/lib/calculator/map-timeline'
import { BirthForm, type BirthFormValue } from '@/components/calculator/BirthForm'
import { RitualLoader } from '@/components/calculator/RitualLoader'
import { DitiHero } from '@/components/calculator/DitiHero'
import { PillarGrid } from '@/components/calculator/PillarGrid'
import { LuckTimeline } from '@/components/calculator/LuckTimeline'
import { CtaEarned } from '@/components/calculator/CtaEarned'
import type { Enrichment } from '@/pages/api/calculator/compute'

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
  const ditiGlyph = dayColumn?.above?.chinese_symbol ?? ''
  const ditiElement = dayColumn?.above?.element
  const decades = result ? mapDecadeLuck(result.cycleLife) : []
  const annual = result ? mapAnnualLuck(result.cycleYearLife) : []

  return (
    <>
      <Head>
        <title>ผังชะตากำเนิดของคุณ — MuMate</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main
        className="min-h-screen bg-white px-4 py-10"
        style={
          phase === 'result' && ditiElement
            ? {
                background: `radial-gradient(120% 80% at 50% 30%, ${hexToRgba(elementColor(ditiElement), 0.08)} 0%, transparent 60%)`,
              }
            : undefined
        }
      >
        {phase === 'form' && (
          <div className="pt-10">
            {error && <p className="mx-auto mb-4 max-w-md text-center font-ibm text-sm text-red-600">{error}</p>}
            <BirthForm onSubmit={handleSubmit} />
          </div>
        )}

        {phase === 'ritual' && (
          <div className="flex min-h-[60vh] items-center justify-center">
            <RitualLoader onComplete={handleRitualComplete} isRepeat={isRepeat} />
          </div>
        )}

        {phase === 'result' && result && (
          <div className="mx-auto max-w-3xl space-y-10">
            <h1 className="sr-only">ผังชะตากำเนิดของคุณ</h1>
            <div className="text-center">
              <p className="mb-6 font-ibm text-sm text-calc_muted">ดิถีประจำตัวของคุณ</p>
              <DitiHero glyph={ditiGlyph} element={ditiElement} reveal />
            </div>

            {/* connecting line from the day pillar up to the hero (both centered on the page) —
                per มุน's frame sheet ("↑เชื่อมขึ้น hero") — composition link, hero already dominant
                on its own so this is a subtle assist, not a competing focal point. */}
            <div
              aria-hidden="true"
              className="mx-auto -mt-8 h-8 w-px"
              style={{
                background: ditiElement
                  ? `linear-gradient(to bottom, ${hexToRgba(elementColor(ditiElement), 0.35)}, ${hexToRgba(elementColor(ditiElement), 0)})`
                  : undefined,
              }}
            />

            <div className="relative">
              <PillarGrid
                columns={columns}
                reveal
                badges={(result?.enrichment?.badges ?? []).filter((b) => b.point.startsWith('pillar-'))}
              />
            </div>

            <LuckTimeline decades={decades} annual={annual} enrichment={result?.enrichment ?? null} />

            <CtaEarned onTryAnother={handleTryAnother} />
          </div>
        )}
      </main>
    </>
  )
}
