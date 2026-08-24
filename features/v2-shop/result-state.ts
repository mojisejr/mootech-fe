// features/v2-shop/result-state.ts — the six things that can be true after someone tries to pay (#363).
//
// 🔴 NONE OF THESE SIX EXIST IN FIGMA. The design has a checkout frame and nothing after it, so every word
// below is authored, not translated — which the ticket names as the riskiest copy in the whole job, because
// no reviewer can diff it against a frame. Two consequences, both deliberate:
//   1. the states are a CLOSED UNION, so "did we cover them all?" is a question the compiler answers;
//   2. every string lives here, so the per-line audit enumerates one file instead of hunting a screen.
//
// 🔑 THE RULE EVERY LINE IS WRITTEN AGAINST (from #347 / #263): a failure message must let the reader tell
// whether TRYING AGAIN COULD WORK. "เกิดข้อผิดพลาด" fails that test — it is true of every row here and
// useful in none of them. So each state carries `retry`, and the copy matches it rather than decorating it.
export type ResultState =
  | 'PAYING' // in flight — we have not heard back yet
  | 'APPROVED' // settled: /payment/status says APPROVED for THIS chargeId
  | 'CARD_DECLINED' // the bank said no. Trying the same card again is unlikely to help; another one might.
  | 'OFFLINE' // WE could not reach our own status endpoint. Says nothing about the money.
  | 'ALREADY_PAID' // this charge is already settled — the user pressed again, or came back to a done screen
  | 'RECONCILING' // past our POLL deadline, but the repair cron's window is still open (#423)
  | 'QR_MAYBE_EXPIRED' // past our own deadline with no settle. NOT "expired" — we are not told that.

export type ResultCopy = {
  /** the headline. */
  title: string
  /** one line under it, in the user's terms. */
  body: string
  /** 🔴 can pressing again plausibly change the outcome? Drives which action the screen offers. */
  retry: 'same' | 'different' | 'none'
  /** true only when the user's money has actually moved. Exactly ONE state may set this. */
  paid: boolean
}

export const RESULT_COPY: Record<ResultState, ResultCopy> = {
  PAYING: {
    title: 'กำลังดำเนินการ',
    body: 'กำลังตรวจสอบการชำระเงิน อย่าเพิ่งปิดหน้านี้',
    retry: 'none',
    paid: false,
  },
  APPROVED: {
    title: 'ชำระเงินสำเร็จ',
    body: 'สิทธิ์ของคุณเปิดใช้งานแล้ว',
    retry: 'none',
    paid: true,
  },
  CARD_DECLINED: {
    // Names WHO said no, because "ล้มเหลว" leaves the user wondering whether we lost their money.
    title: 'ธนาคารปฏิเสธการชำระเงิน',
    body: 'ยังไม่มีการตัดเงินจากบัตรใบนี้ ลองใช้บัตรใบอื่นหรือชำระด้วยพร้อมเพย์',
    retry: 'different',
    paid: false,
  },
  OFFLINE: {
    // ❌ never "การชำระเงินล้มเหลว": our network is not their payment.
    title: 'เช็คสถานะไม่ได้ตอนนี้',
    body: 'การเชื่อมต่อมีปัญหา ถ้าคุณจ่ายไปแล้วเงินไม่หาย กดตรวจสอบอีกครั้งได้เลย',
    retry: 'same',
    paid: false,
  },
  ALREADY_PAID: {
    // The double-press case. Saying "สำเร็จ" here would be true but would also read as "your SECOND payment
    // went through", so it says plainly that there is only one.
    title: 'รายการนี้ชำระเงินแล้ว',
    body: 'ไม่มีการตัดเงินซ้ำ สิทธิ์ของคุณเปิดใช้งานอยู่แล้ว',
    retry: 'none',
    paid: true,
  },
  RECONCILING: {
    // 🔴 THE STATE THAT DID NOT EXIST, AND WHOSE ABSENCE WAS THE BUG (#423).
    // Between minute 15 (fast polling stops) and minute 30 (the reconcile cron's window closes) the screen
    // used to show QR_MAYBE_EXPIRED — i.e. it told the ONE user whose payment the reconciler exists to
    // rescue that they should pay again, before the rescue was even permitted to run.
    // `retry: 'same'` and never 'different': asking again is free, paying again is not.
    title: 'กำลังตรวจสอบกับธนาคาร',
    body: 'ยังไม่ได้รับการยืนยัน ระบบกำลังตรวจสอบให้อัตโนมัติ ไม่ต้องจ่ายซ้ำ',
    retry: 'same',
    paid: false,
  },
  QR_MAYBE_EXPIRED: {
    // อาจ — the gateway never tells us when a QR dies (useChargeStatus.POLL_UNTIL_MS).
    //
    // 🔴 IT SPEAKS TO TWO PEOPLE AT ONCE, ON PURPOSE (ฟีม เคาะทาง C, 2026-08-24). At this point the screen
    // does not know which of them is reading it: someone who never paid and needs a fresh QR, or someone
    // whose money already left and whose row the cron is still working on for another seven days. Address
    // only the first and the second pays twice; address only the second and the first is stuck. So the
    // sentence carries both, in that order — the unpaid case first because it is the common one.
    title: 'QR นี้อาจหมดอายุแล้ว',
    body: 'ถ้ายังไม่ได้จ่าย ขอ QR ใหม่ได้เลย · ถ้าจ่ายไปแล้ว ไม่ต้องจ่ายซ้ำ ระบบยังตามให้อยู่ กดตรวจสอบอีกครั้งได้',
    retry: 'same',
    paid: false,
  },
}

/** The one place that answers "has their money moved?" — so no screen can decide it locally. */
export function isPaidState(s: ResultState): boolean {
  return RESULT_COPY[s].paid
}
