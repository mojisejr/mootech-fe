// features/v2-service/components/CompatibilityScreen.tsx — ดวงสมพงศ์ Slice 1.
// ⚠️ LOGIC SKELETON (goo). This is the buildable, testable wiring of `useCompatibility` — the contract made
// visible: header title, person-1 (real "คุณ"), person-2 slot, and the 2-state "ดูผลลัพธ์เลย" button gated on
// canViewResult. μุน's follow-up PR COMPOSES the real V3 presentation (Figma 480:4549 / 636:18451) over this
// same hook — the state, types, and enable-condition here are the locked seam; the pixels are hers.
// data-* markers exist so the harness anchor can assert the CONTRACT (title, matching_type, button gate)
// without depending on final styling.
import { useCompatibility } from '../hooks/useCompatibility'
import type { CompatibilityConfig } from '../compatibility'

export function CompatibilityScreen({ config }: { config: CompatibilityConfig }) {
  const c = useCompatibility(config)

  return (
    <main data-testid="compat-screen" data-matching-type={c.matchingType}>
      {/* header — μุน swaps in the shared TopBar (#146) + Figma hero */}
      <h1 data-testid="compat-title">{c.title}</h1>

      {/* row 1 — คุณ (real user, done-cond #3) */}
      <section data-testid="compat-person1">
        {c.loadingPerson1 ? (
          <span data-testid="compat-person1-loading">…</span>
        ) : (
          <span data-testid="compat-person1-name">{c.person1?.name ?? ''}</span>
        )}
        <span data-testid="compat-person1-dob">{c.person1?.dob ?? ''}</span>
        <span data-testid="compat-person1-time">{c.person1?.time ?? ''}</span>
      </section>

      {/* row 2 — เลือกเพื่อน/คู่รัก (μุน wires her wrapped v1 modal → c.selectFriend) */}
      <section data-testid="compat-person2">
        {c.person2 ? (
          <span data-testid="compat-person2-name">{c.person2.name}</span>
        ) : (
          <span data-testid="compat-person2-empty">เลือกเพื่อน / คู่รัก</span>
        )}
      </section>

      {/* button — gray until BOTH people (done-cond #5); result flow is the next slice (placeholder) */}
      <button
        type="button"
        data-testid="compat-view-result"
        disabled={!c.canViewResult}
        aria-disabled={!c.canViewResult}
      >
        ดูผลลัพธ์เลย
      </button>

      {/* placeholder — honest, not a dead button (done-cond #8) */}
      <p data-testid="compat-result-placeholder">ผลลัพธ์กำลังมา เร็วๆ นี้</p>
    </main>
  )
}
