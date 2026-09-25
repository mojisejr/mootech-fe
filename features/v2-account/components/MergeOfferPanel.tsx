// features/v2-account/components/MergeOfferPanel.tsx — the confirmation DoD 4 requires
// (mumate-login-identity-001 slice 4).
//
// §WHY THIS IS ITS OWN COMPONENT AND ITS OWN PRESS. DoD 4: the member "is told this in
// their own language, naming what stays behind, before anything is written", and the
// flow "refuses to proceed without an explicit confirmation that is separate from
// pressing link". A confirm button living inside the provider row would be one press
// away from the link press; a panel with its own two choices cannot be reached by
// accident.
//
// §IT IS PRESENTATIONAL ON PURPOSE. It receives a preview the server computed and
// calls back; it decides nothing about who survives. Every input to that decision is
// server-side — the paid verdict, both accounts' provider rows, owner decision 8 — and
// a screen that re-derived any of it would eventually contradict the server. That is
// the defect summariseConnections was written to end for the linked/unlinked badges.
//
// §WHAT THE COPY MUST SAY, AND WHY EACH PART IS THERE.
//   • Which account is kept. The member has two and must know which one survives.
//   • That the other one is left with no way to sign in. That is the one thing this
//     workstream otherwise forbids, so it is stated plainly rather than softened.
//   • That data on the account that is not kept does NOT come across. Slice 4 moves a
//     credential and nothing else — charts, QI, payments and birth data stay where
//     they are, and a member who expects a full merge would be misled by silence.
//   • That no new sign-in is needed. Identity is resolved from the provider ROW
//     (lib/v2/resolve-user.ts looks a member up by id_token + provider), so when the
//     row moves, this same session resolves to the surviving account on its very next
//     request. Saying so prevents a member abandoning the flow half-done because they
//     think they have been logged out.
import { useState } from "react"

export interface MergePreview {
  /** which account remains usable, as the server decided it */
  survivor: "this-account" | "other-account"
  /** whether the account that loses is left with no way to sign in */
  loserKeepsNothing: boolean
}

const PROVIDER_NAME: Record<string, string> = { line: "LINE", google: "Google", dev: "Dev Login" }

export function MergeOfferPanel({
  provider,
  preview,
  busy = false,
  onConfirm,
  onCancel,
}: {
  provider: string
  preview: MergePreview
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  // A second, local gate. The panel explains first and only then shows the button
  // that acts, so the acting press is never the first press in this panel either.
  const [ready, setReady] = useState(false)
  const name = PROVIDER_NAME[provider] ?? provider
  const keepsThis = preview.survivor === "this-account"

  return (
    <section
      className="flex flex-col gap-3 rounded-[18px] border border-v3-border-card bg-white p-4"
      data-testid="merge-offer"
    >
      <p className="text-[15px] font-black text-v3-navy">รวมสองบัญชีเป็นบัญชีเดียว</p>

      <p className="text-[13px] leading-5 text-v3-text-body" data-testid="merge-offer-what">
        {`ช่องทาง ${name} ที่คุณเพิ่งยืนยัน เป็นของอีกบัญชีหนึ่ง และคุณได้พิสูจน์แล้วว่าทั้งสองบัญชีเป็นของคุณ`}
      </p>

      <p className="text-[13px] leading-5 text-v3-text-body" data-testid="merge-offer-which">
        {keepsThis
          ? "ถ้ายืนยัน เราจะเก็บบัญชีที่คุณใช้อยู่ตอนนี้ไว้ แล้วย้ายช่องทางเข้าสู่ระบบจากอีกบัญชีมาที่บัญชีนี้"
          : "ถ้ายืนยัน เราจะเก็บอีกบัญชีหนึ่งไว้ แล้วย้ายช่องทางเข้าสู่ระบบของบัญชีที่คุณใช้อยู่ตอนนี้ไปที่บัญชีนั้น คุณจะอยู่ในบัญชีที่เก็บไว้ต่อทันที ไม่ต้องเข้าสู่ระบบใหม่"}
      </p>

      {preview.loserKeepsNothing ? (
        <p
          className="rounded-[14px] bg-v3-grade-a-bg px-3 py-2 text-[12px] leading-5 text-v3-text-body"
          data-testid="merge-offer-cost"
        >
          {keepsThis
            ? "หลังจากนี้ อีกบัญชีหนึ่งจะไม่มีวิธีเข้าสู่ระบบเหลืออยู่ และข้อมูลที่อยู่ในบัญชีนั้น เช่น ดวงที่คำนวณไว้ QI หรือประวัติการสั่งซื้อ จะไม่ถูกย้ายมาด้วย"
            : "หลังจากนี้ บัญชีที่คุณใช้อยู่ตอนนี้จะไม่มีวิธีเข้าสู่ระบบเหลืออยู่ และข้อมูลที่อยู่ในบัญชีนั้น เช่น ดวงที่คำนวณไว้ QI หรือประวัติการสั่งซื้อ จะไม่ถูกย้ายไปด้วย"}
        </p>
      ) : null}

      {!ready ? (
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-full bg-v3-navy px-4 py-2.5 text-[13px] font-black text-white disabled:opacity-50"
            onClick={() => setReady(true)}
            disabled={busy}
            data-testid="merge-offer-continue"
          >
            เข้าใจแล้ว ดำเนินการต่อ
          </button>
          <button
            type="button"
            className="flex-none rounded-full border border-v3-border-card px-4 py-2.5 text-[13px] font-bold text-v3-text-body disabled:opacity-50"
            onClick={onCancel}
            disabled={busy}
            data-testid="merge-offer-cancel"
          >
            ไม่รวม
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-bold text-v3-navy" data-testid="merge-offer-final">
            ยืนยันการรวมบัญชี? การย้อนกลับต้องติดต่อทีมงาน
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-full bg-v3-navy px-4 py-2.5 text-[13px] font-black text-white disabled:opacity-50"
              onClick={onConfirm}
              disabled={busy}
              data-testid="merge-offer-confirm"
            >
              {busy ? "กำลังรวมบัญชี…" : "ยืนยันรวมบัญชี"}
            </button>
            <button
              type="button"
              className="flex-none rounded-full border border-v3-border-card px-4 py-2.5 text-[13px] font-bold text-v3-text-body disabled:opacity-50"
              onClick={onCancel}
              disabled={busy}
              data-testid="merge-offer-cancel"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
