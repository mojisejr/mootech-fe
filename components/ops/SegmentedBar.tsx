// Neutral/teal-tint only — never status_ok/warn/bad (Guardrails #2). Alternating opacity of the
// same brand hue distinguishes segments without introducing new colors.
export function SegmentedBar({ segments }: { segments: Array<{ label: string; amount: number }> }) {
  const total = segments.reduce((sum, s) => sum + s.amount, 0)
  if (total <= 0) return null

  return (
    <div className="mb-2 flex h-2 w-full overflow-hidden rounded-full bg-ops_border">
      {segments.map((s, i) => {
        const pct = (s.amount / total) * 100
        if (pct <= 0) return null
        return (
          <div
            key={s.label}
            className={`h-full ${i % 2 === 0 ? 'bg-moumate_blue/60' : 'bg-moumate_blue/30'}`}
            style={{ width: `${pct}%` }}
          />
        )
      })}
    </div>
  )
}
