import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

// In-place inline expand (fade/height), never a modal/route change (Layer Contract, มุน).
// Reduced-motion: `motion-reduce:transition-none` collapses the animation to an instant swap.
// Collapsed by default always — no auto-expand, and Revenue's per-plan amounts stay hidden
// (over-the-shoulder privacy) until explicitly opened.
export function Disclosure({ label = 'ดูย่อย', children }: { label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="mt-2 flex min-h-[40px] w-full items-center justify-end gap-1 text-xs text-ops_text_muted hover:text-ops_text"
      >
        {label}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        id={panelId}
        className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  )
}
