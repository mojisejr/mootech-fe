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
// §THE COPY WAS REWRITTEN AFTER A MEMBER READ IT AND STILL DID NOT KNOW WHAT WOULD HAPPEN
// (the owner, walking the collision on the rehearsal database, 2026-09-26). He pressed
// through both gates deliberately, found the Thai readable, and afterwards could not say
// that the LINE credential he was signed in with was the one about to move — he had guessed
// the direction correctly from his own knowledge of which account holds his purchases, not
// from anything on the page. Three defects, all in the words rather than the logic:
//   ① The ONLY provider named was the one he had just verified — which is the side that
//      STAYS. So the single concrete noun on the screen pointed at the wrong half.
//   ② Both accounts were abstractions, "this account" and "the other one", while the
//      member thinks in "my LINE" and "my Google". Nothing translated between them.
//   ③ "will have no way to sign in" is true of the losing ROW SET and false of the member's
//      experience: after the move the surviving account holds BOTH credentials, so no login
//      method is lost at all. Verified on real data — the survivor ended up holding
//      google(21) and LINE(33) together. The sentence frightened the member about the one
//      thing that does not happen, and by doing so it buried the thing that does: the data
//      in the account left behind becomes unreachable.
// So the panel is now handed movingProvider and reason, and it names both sides, states
// what the member can still log in with, and puts the loss where the loss actually is.
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
  /** the provider of the credential that would change hands, AS STORED. This is the side
   *  that MOVES, which is not always the provider the member just verified — and confusing
   *  the two is exactly what made the previous copy unreadable. */
  movingProvider?: string
  /** the survivor rule's own verdict, so the screen can say WHY this side is kept rather
   *  than leaving a member to wonder whether it was arbitrary (owner decision, 2026-09-26). */
  reason?: string
}

const PROVIDER_NAME: Record<string, string> = { line: "LINE", google: "Google", dev: "Dev Login", LINE: "LINE", GOOGLE: "Google" }

/** WHY this account is the one kept, in the member's language. Every SurvivorReason has a
 *  sentence: 'only-one-may-lose' is the paid/never-paid case the owner asked to protect,
 *  and the two tiebreaks only happen when NEITHER side has ever paid — in which case saying
 *  "the older one" is honest and says, correctly, that money was not the deciding factor. */
const WHY_KEPT: Record<string, string> = {
  "only-one-may-lose": "เพราะเป็นบัญชีที่มีประวัติการสั่งซื้อหรือการเป็นสมาชิกอยู่",
  "older-account-survives": "เพราะทั้งสองบัญชีไม่มีประวัติการสั่งซื้อ จึงเก็บบัญชีที่สร้างไว้ก่อน",
  "user-id-order": "เพราะทั้งสองบัญชีไม่มีประวัติการสั่งซื้อ และสร้างขึ้นในเวลาเดียวกัน",
}

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
  // The credential that MOVES. Falls back to the verified provider's name only when the
  // server did not say — an older server, never a guess dressed as a fact.
  const moving = preview.movingProvider ? (PROVIDER_NAME[preview.movingProvider] ?? preview.movingProvider) : null
  const why = preview.reason ? WHY_KEPT[preview.reason] : undefined
  // Which side is kept, named by its provider where that is knowable. When THIS account is
  // kept, the credential that moves belongs to the other one, so the kept side is the one
  // the member is signed into; when the OTHER is kept, the moving credential is this
  // account's own, so the kept side is named by the provider just verified.
  const keptName = keepsThis ? null : name

  return (
    <section
      className="flex flex-col gap-3 rounded-[18px] border border-v3-border-card bg-white p-4"
      data-testid="merge-offer"
    >
      <p className="text-[15px] font-black text-v3-navy">รวมสองบัญชีเป็นบัญชีเดียว</p>

      <p className="text-[13px] leading-5 text-v3-text-body" data-testid="merge-offer-what">
        {`บัญชี ${name} ที่คุณเพิ่งยืนยัน เป็นอีกบัญชีหนึ่งของคุณ ตอนนี้พิสูจน์แล้วว่าทั้งสองบัญชีเป็นของคุณจริง`}
      </p>

      <p className="text-[13px] leading-5 text-v3-text-body" data-testid="merge-offer-which">
        {keepsThis
          ? `ถ้ายืนยัน เราจะเก็บบัญชีที่คุณใช้อยู่ตอนนี้ไว้${why ? ` ${why}` : ""} แล้วย้ายการเข้าสู่ระบบด้วย ${moving ?? name} จากอีกบัญชีมาไว้กับบัญชีนี้`
          : `ถ้ายืนยัน เราจะเก็บบัญชีฝั่ง ${keptName} ไว้${why ? ` ${why}` : ""} แล้วย้ายการเข้าสู่ระบบด้วย ${moving ?? "ช่องทางที่คุณใช้อยู่"} — อันที่คุณกำลังใช้อยู่ตอนนี้ — ไปไว้กับบัญชีนั้น`}
      </p>

      <p className="text-[13px] leading-5 text-v3-text-body" data-testid="merge-offer-after">
        {moving
          ? `หลังรวม คุณยังเข้าได้ทั้ง ${moving} และ ${name} และทั้งสองทางจะพาไปที่บัญชีเดียวกัน ไม่ต้องเข้าสู่ระบบใหม่`
          : "หลังรวม ช่องทางเข้าสู่ระบบทั้งสองทางจะพาไปที่บัญชีเดียวกัน ไม่ต้องเข้าสู่ระบบใหม่"}
      </p>

      {preview.loserKeepsNothing ? (
        <p
          className="rounded-[14px] bg-v3-grade-a-bg px-3 py-2 text-[12px] leading-5 text-v3-text-body"
          data-testid="merge-offer-cost"
        >
          {keepsThis
            ? "สิ่งที่จะไม่ย้ายมาด้วย คือข้อมูลที่อยู่ในอีกบัญชีหนึ่ง — ดวงที่คำนวณไว้ QI และประวัติการสั่งซื้อ — และหลังรวมจะเข้าถึงข้อมูลชุดนั้นไม่ได้อีก ถ้ามีอะไรในนั้นที่คุณต้องการ ให้ติดต่อทีมงานก่อนกดยืนยัน"
            : "สิ่งที่จะไม่ย้ายไปด้วย คือข้อมูลที่อยู่ในบัญชีที่คุณใช้อยู่ตอนนี้ — ดวงที่คำนวณไว้ QI และประวัติการสั่งซื้อ — และหลังรวมจะเข้าถึงข้อมูลชุดนั้นไม่ได้อีก ถ้ามีอะไรในนั้นที่คุณต้องการ ให้ติดต่อทีมงานก่อนกดยืนยัน"}
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
