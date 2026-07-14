export function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-ops_text_muted">{label}</span>
      <span className="tabular-nums text-ops_text">{value}</span>
    </div>
  )
}
