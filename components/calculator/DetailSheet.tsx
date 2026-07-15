import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

// Bottom-sheet modal — replaces the old inline "ดูรายละเอียด" toggle (removed per ฟีม). A timeline
// card (or, in Phase 2, a pillar card) opens this to reveal its 12-เชี่ยงแซ / role detail.
//
// z-[60] sits above HeaderMuMate's fixed z-50 bar. Closes on backdrop click + Escape. Focus moves
// to the close button on open (lightweight focus management — no full trap library). Honors
// prefers-reduced-motion by dropping the slide/scale animation.
export function DetailSheet({
  open,
  onClose,
  kicker,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  kicker?: string
  title: string
  children: ReactNode
}) {
  const prefersReducedMotion = useReducedMotion()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    // lock background scroll while the sheet is open
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="absolute inset-0 bg-moumate_black/45"
            aria-hidden="true"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative z-10 max-h-[86vh] w-full max-w-md overflow-y-auto rounded-t-[26px] bg-moumate_white p-5 pb-8 shadow-custom"
            initial={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
            animate={prefersReducedMotion ? { opacity: 1 } : { y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <span aria-hidden="true" className="mx-auto mb-4 block h-[5px] w-11 rounded-full bg-border_gray" />
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                {kicker && <p className="font-ibm text-[11px] text-calc_muted">{kicker}</p>}
                <h3 className="mt-0.5 font-prompt text-lg text-moumate_black">{title}</h3>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="ปิด"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg_gray text-calc_muted"
              >
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
