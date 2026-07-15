// F5 — earned-invitation, not a wall. Shown after the chart+timeline are already fully visible
// and playable — never blocks access to the free calculation itself.
export function CtaEarned({ onTryAnother }: { onTryAnother: () => void }) {
  return (
    <div className="mx-auto mt-10 w-full max-w-md rounded-2xl border border-border_gray bg-moumate_white p-6 text-center shadow-custom">
      <p className="font-ibm text-moumate_black">ผังนี้คือจุดเริ่มต้นของคุณ</p>
      <p className="mt-1 font-ibm text-sm text-calc_muted">อยากรู้ว่ามันแปลว่าอะไร?</p>

      <a
        href="/my-destiny"
        className="mt-4 block w-full rounded-2xl bg-moumate_blue py-3 font-ibm font-medium text-moumate_black"
      >
        ดูคำทำนายเชิงลึก · สมัครฟรี
      </a>

      <button
        type="button"
        onClick={onTryAnother}
        className="mt-3 block w-full rounded-2xl border border-border_gray py-3 font-ibm text-moumate_black"
      >
        ลองวันเกิดคนอื่น
      </button>
    </div>
  )
}
