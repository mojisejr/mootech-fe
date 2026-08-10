// 🔴 TEMPORARY (#249) — team-preview only. **#248 deletes this whole folder before launch.**
// If you are reading this after the preview gate is gone, it should not exist. Delete it.
//
// The team's way back to the start of first-run: POST /api/v2/first-run-reset (บอง's route, same
// branch) puts the CALLER's row back to "never onboarded", then we reload /v2 so the onboarding gate
// in useV2Home routes them into the three screens again. Nobody hand-runs SQL against prod.
//
// FOUR THINGS THIS FILE IS DELIBERATELY DOING, none of them decoration:
//
//  1. IT LOOKS FOREIGN ON PURPOSE. Dashed border, monospace, amber-on-black, an issue number in the
//     label. It uses NONE of the v3 tokens (no v3-sapphire / v3-lime / rounded-full pill) because a
//     control that reads as a normal feature is a trap: it deletes real rows on prod. "Ugly" here is
//     the requirement, not a shortcut — the day it stops looking out of place is the day someone
//     taps it thinking it is part of the product.
//
//  2. IT ASKS FIRST. One tap can never write. The confirm card spells out exactly what disappears
//     (onboarded_at · onboarding_goal · that user's consent rows) and what does not (the account,
//     the chart), so the person tapping knows the blast radius BEFORE the request goes out.
//
//  3. EVERY PHASE IS ON SCREEN. idle → confirm → กำลังรีเซ็ต… → สำเร็จ / ล้มเหลว. A control that
//     goes quiet after a tap is the #240 class ("กดแล้วเงียบ") and it is the one บอง explicitly
//     asked not to repeat here.
//
//  4. IT NEVER RENAMES A FAILURE. Anything that is not `ok` is shown as the SERVER's own status +
//     error string. The contract handed over in the issue listed 200/401/500, but the route as
//     merged also answers 404 ("signed in, in the preview, but never completed register-login on
//     this deployment" — first-run-reset.ts:54) and 405. Mapping statuses to pretty Thai copy would
//     have turned the one state a team member actually hits on their first prod tap into the wrong
//     sentence. Unknown states arrive as themselves.
//
// REMOVAL (#248): delete this folder + scripts/first-run-reset-ui.test.tsx, drop its line from
// vitest.config.mts, and drop the import + <TeamPreviewResetBadge /> from pages/v2/index.tsx.
// Nothing else imports it — it is mounted, never composed into a component that has to survive.
import { useState } from 'react'

/** How long "✅ สำเร็จ" stays on screen before the reload takes it away.
 *
 *  🔴 This constant is the whole reason the success state is VISIBLE rather than merely *rendered*.
 *  Without the hold, setPhase('done') and window.location.assign('/v2') land in the same tick: React
 *  paints the success frame at most once before the browser tears the document down, so a human sees
 *  the spinner jump straight to a reloaded page. A unit test asserting "the success text is in the
 *  DOM" passes either way — which is exactly the class where the rendered pixels lie about what the
 *  code claims — a unit test cannot tell the two apart, so this one is settled in a real browser
 *  (capture recipe + the four phase shots are in issue #249), never from reading this file. */
export const SUCCESS_HOLD_MS = 900

type Phase =
  | { name: 'idle' }
  | { name: 'confirm' }
  | { name: 'pending' }
  | { name: 'done' }
  | { name: 'error'; status: number; message: string }

/** The reset is a write, so the request carries NO caller-supplied subject — no body, no query, no
 *  id. The server derives whose row it is from the NextAuth session (lib/v2/first-run-reset.ts).
 *  Anything added here that names a user re-opens mootech-be#16 from the client side. */
async function postReset(): Promise<Phase> {
  try {
    const r = await fetch('/api/v2/first-run-reset', { method: 'POST' })
    const body = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (r.ok && body?.ok === true) return { name: 'done' }
    return { name: 'error', status: r.status, message: body?.error ?? 'ไม่มีข้อความจากเซิร์ฟเวอร์' }
  } catch {
    // network / abort — there is no status to show, and 0 reads as "never reached the server"
    return { name: 'error', status: 0, message: 'ต่อเซิร์ฟเวอร์ไม่ได้' }
  }
}

export function TeamPreviewResetBadge({
  /** Injected only so the spec can watch it. The default is what ships: a FULL page load, not
   *  router.push. Two reasons, both real — (a) summary-cache.ts keeps the first-run reading in an
   *  in-memory Map that a client-side navigation does not clear, so a replay could show the previous
   *  run's reading; (b) /v2's getServerSideProps has to run again for the gate + fresh user row. */
  navigate = () => window.location.assign('/v2'),
}: {
  navigate?: () => void
} = {}) {
  const [phase, setPhase] = useState<Phase>({ name: 'idle' })

  async function run() {
    setPhase({ name: 'pending' })
    const next = await postReset()
    setPhase(next)
    // Only a real 200 { ok: true } leaves this screen. A failure stays put, visible, retryable —
    // navigating on !ok would show the team a fresh first-run they did not actually get.
    // The hold is what makes "สำเร็จ" something a person SEES; see SUCCESS_HOLD_MS.
    if (next.name === 'done') setTimeout(navigate, SUCCESS_HOLD_MS)
  }

  if (phase.name === 'idle') {
    return (
      <button
        type="button"
        data-testid="team-reset-open"
        onClick={() => setPhase({ name: 'confirm' })}
        // min-h-[44px]: this is a real <button>, so design.contract.ts's `tap-target` anchor
        // (selector `button, a[href]`, min(width,height) ≥ 44px, WCAG 2.5.5) applies to it exactly
        // as it does to a product control. It shipped at 41px and the CI gate caught it on PR #254
        // — "temporary" buys a foreign LOOK, never a smaller touch target, and this one sits a
        // thumb's width above the primary CTA where a mis-tap lands on something that writes to prod.
        className="fixed right-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 flex min-h-[44px] flex-col justify-center rounded border-2 border-dashed border-amber-400 bg-black/85 px-2.5 py-1.5 font-mono text-[11px] font-bold leading-tight text-amber-300 shadow-lg"
      >
        🔧 รีเซ็ต first-run
        <span className="block text-[9px] font-normal text-amber-200/80">ชั่วคราว · #249</span>
      </button>
    )
  }

  // 'done' is busy too. The success frame is deliberately held on screen for SUCCESS_HOLD_MS, and for
  // that whole beat the buttons were still live and still read "ยืนยันรีเซ็ต" — so a second tap fired
  // a second reset against prod on a card that had just said it succeeded. Only visible in the
  // capture; every unit test was green through it, because "the button exists" was never the question.
  const busy = phase.name === 'pending' || phase.name === 'done'

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label="รีเซ็ต first-run (เครื่องมือทดสอบชั่วคราว)"
    >
      <button
        type="button"
        aria-label="ปิด"
        disabled={busy}
        onClick={() => setPhase({ name: 'idle' })}
        className="absolute inset-0 bg-black/60"
      />
      <div className="relative w-full max-w-xs rounded border-2 border-dashed border-amber-400 bg-black/95 p-5 font-mono text-amber-100">
        <p className="text-[11px] font-bold text-amber-300">🔧 เครื่องมือทดสอบชั่วคราว · #249</p>
        <p className="mt-2 text-sm font-bold leading-6">พาตัวเองกลับไปเริ่ม first-run ใหม่?</p>

        {/* The blast radius, spelled out before the write — not after it. */}
        <ul className="mt-2 space-y-0.5 text-[11px] leading-5 text-amber-200/90">
          <li>· ล้าง onboarded_at · onboarding_goal</li>
          <li>· ลบ consent ของคุณ</li>
          <li>· ❌ ไม่ลบบัญชี ไม่ลบดวง</li>
          <li>· แตะเฉพาะข้อมูลของคนที่กด</li>
        </ul>

        {/* aria-live so the phase is announced, not just repainted. */}
        <p data-testid="team-reset-status" aria-live="polite" className="mt-3 min-h-[2.5rem] text-[11px] leading-5">
          {phase.name === 'pending' && <span className="text-amber-300">⏳ กำลังรีเซ็ต…</span>}
          {phase.name === 'done' && <span className="text-lime-300">✅ สำเร็จ — กำลังพากลับไป /v2</span>}
          {phase.name === 'error' && (
            <span className="text-red-300">
              ❌ ล้มเหลว · HTTP {phase.status}
              <span className="block break-words">{phase.message}</span>
            </span>
          )}
        </p>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            data-testid="team-reset-cancel"
            disabled={busy}
            onClick={() => setPhase({ name: 'idle' })}
            className="min-h-[44px] flex-1 rounded border border-amber-400/60 px-3 py-2 text-xs font-bold text-amber-200 disabled:opacity-50"
          >
            ปิด
          </button>
          <button
            type="button"
            data-testid="team-reset-confirm"
            disabled={busy}
            onClick={run}
            className="min-h-[44px] flex-1 rounded bg-amber-400 px-3 py-2 text-xs font-bold text-black disabled:opacity-50"
          >
            {phase.name === 'error' ? 'ลองใหม่' : 'ยืนยันรีเซ็ต'}
          </button>
        </div>
      </div>
    </div>
  )
}
