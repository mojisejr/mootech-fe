import { elementColor, type BaziElement } from '@/lib/calculator/elements'
import { hexToRgba } from '@/lib/calculator/color'
import { CALCULATOR_STRENGTH_BANDS, resolveStrengthBand } from '@/lib/calculator/strength-bands'

// กำลังดิถี — the day-master strength meter, attached directly under the ดิถี hero (it is the
// self's power, not a free-floating stat). Tinted with the day-master element color so it reads
// as "how strong is YOUR element", 5 bands from อ่อนเกินไป → แข็งเกินไป.
//
// score is REAL (enrichment.strengthScore); band label is derived via strength-bands.ts (Phase-1
// port) or, once shipped, goo's enrichment.strengthBand.id passed as `bandId`.
export function StrengthMeter({
  score,
  element,
  bandId,
}: {
  score: number
  element: BaziElement | undefined
  bandId?: string
}) {
  const color = elementColor(element)
  const { band, index } = resolveStrengthBand(score, bandId)

  return (
    <section
      className="rounded-2xl border border-white/50 bg-white/90 p-4 shadow-custom backdrop-blur-md lg:p-5"
      data-testid="strength-meter"
      data-strength-band={band.id}
      aria-label={`กำลังดิถี ${band.displayLabel}`}
    >
      <p className="font-ibm text-xs text-calc_muted">กำลังดิถี</p>
      <div className="mt-1 flex items-baseline gap-2.5">
        <span
          className="font-prompt text-[32px] font-bold leading-none tabular-nums lg:text-[38px]"
          style={{ color }}
          data-testid="strength-score"
        >
          {score.toFixed(1)}
        </span>
        <span className="font-prompt text-base font-semibold text-moumate_black lg:text-lg" data-testid="strength-band-label">
          {band.displayLabel}
        </span>
      </div>

      <ol className="mt-3.5 grid grid-cols-5 gap-1.5" aria-hidden="true">
        {CALCULATOR_STRENGTH_BANDS.map((b, i) => {
          const isActive = i === index
          const isPast = i < index
          return (
            <li key={b.id} className="text-center">
              <span
                className="block h-2 rounded-full"
                style={{
                  background: isActive ? color : isPast ? hexToRgba(color, 0.3) : '#E6E9EA',
                  boxShadow: isActive ? `0 0 0 3px ${hexToRgba(color, 0.16)}` : undefined,
                }}
              />
              <span
                className="mt-1.5 block font-ibm text-[9.5px] leading-tight lg:text-[10px]"
                style={{ color: isActive ? color : '#8A9AA0', fontWeight: isActive ? 700 : 400 }}
              >
                {b.label}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
