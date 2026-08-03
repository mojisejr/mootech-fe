// §4 — the "เปิดโหมดแอดวานซ์" switch (Figma pill). Bound to goo's useAdvancedMode (real 2-way toggle);
// its ON-state content (§5 pillars + §9/§12/§13) lands in 3b. In 3a the switch flips state but the
// advanced-only sections are not built yet, so the view is unchanged — noted in the PR (interim).
export function AdvancedToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      data-testid="day-advanced-toggle"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex w-full items-center justify-center gap-3 rounded-2xl bg-v3-pastel-blue/50 px-5 py-3.5"
    >
      <span className="text-sm font-bold text-v3-navy">เปิดโหมดแอดวานซ์</span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-none ${on ? 'bg-v3-sapphire' : 'bg-neutral-300'}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow ${on ? 'right-0.5' : 'left-0.5'}`} />
      </span>
    </button>
  )
}
