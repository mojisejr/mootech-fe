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
import type { QrDeadlineState } from '@/lib/payment/qr-deadline'

export type ResultState =
  | 'PAYING' // in flight — we have not heard back yet
  | 'APPROVED' // settled: /payment/status says APPROVED for THIS chargeId
  | 'CARD_DECLINED' // the bank said no. Trying the same card again is unlikely to help; another one might.
  | 'PAYMENT_SETUP_BROKEN' // OUR side failed before any card left the browser — a bad key, a missing SDK,
  //                          a reason Omise gave that we do not recognise. Never the buyer's fault (#492).
  | 'OFFLINE' // WE could not reach our own status endpoint. Says nothing about the money.
  | 'ALREADY_PAID' // this charge is already settled — the user pressed again, or came back to a done screen
  | 'RECONCILING' // past our POLL deadline, but the repair cron's window is still open (#423)
  | 'QR_MAYBE_EXPIRED' // past our own deadline with no settle. NOT "expired" — we are not told that.
  // ── #455 slice 2 — the gateway DID tell us. Separate state, not a reworded QR_MAYBE_EXPIRED ─────
  // The word "อาจ" in the row above was never hedging: it was accurate, because our own clock was the
  // only thing that had spoken. /api/v2/payment/status now carries `qrDeadline` (#476), so for some
  // rows we are told. Sharpening the existing words would have taken the honest "อาจ" away from the
  // rows where we are still NOT told, which are the majority — 124 of 184 charges have no deadline at
  // all (lib/payment/qr-deadline.ts:6). Two states, two audiences, one honest sentence each.
  | 'QR_EXPIRED' //     the gateway's own deadline has passed. Certain about the QR, still unsure about the money.
  // ── #484 — money moved, then moved back. Not a failure: it worked, and was undone ────────────────
  // The only row where the user HELD the thing and then stopped holding it. Every other row here is
  // about a purchase that did or did not complete; this one is about one that completed and was
  // reversed, taking the entitlement with it (repo.ts — one transaction, so the screen can never see
  // this code while the subscription is still ACTIVE).
  | 'PAYMENT_REVERSED' //  paid, then the money went back — and the membership from THAT payment went with it
  // ── #466 — the server REFUSED before any money moved (mootech-fe#456's gate) ──────────────────────
  // These two are not failures of a payment. Nothing was charged, nothing was declined, nothing is
  // pending: the purchase was never allowed to start. Before #466 they fell into CARD_DECLINED and
  // OFFLINE, which told a paying member that their BANK had refused them — about a card the bank never
  // saw, because charge-flow.ts:66 answers 409 long before Omise is called.
  | 'ALREADY_ON_THIS_TIER' // they hold this exact plan and it has not expired
  | 'CANNOT_DOWNGRADE' //     they hold a HIGHER plan; selling them a lower one would take something away

export type ResultCopy = {
  /** the headline. */
  title: string
  /** one line under it, in the user's terms. */
  body: string
  /** 🔴 can pressing again plausibly change the outcome? Drives which action the screen offers. */
  retry: 'same' | 'different' | 'new-qr' | 'buy-again' | 'none'
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
  PAYMENT_SETUP_BROKEN: {
    // 🔴 NEVER blame the card here. This state exists for the cases where OUR key is wrong, omise.js did
    // not load, or Omise gave a reason we have no mapping for — and in every one of them the buyer's card
    // is fine and nothing was charged. Telling them their bank refused would be blaming a stranger for
    // our own outage, which is the worst sentence this screen was capable of producing (#492).
    title: 'ระบบชำระเงินมีปัญหา',
    body: 'ยังไม่มีการตัดเงิน ไม่ใช่เพราะบัตรของคุณ ลองอีกครั้งในอีกสักครู่ ถ้ายังไม่ได้ติดต่อเราได้เลย',
    retry: 'same',
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
  PAYMENT_REVERSED: {
    // 🔴 พูดถึง **การซื้อครั้งนี้** ❌ ไม่ใช่สถานะสมาชิกโดยรวม
    // 🔴 เส้นแบ่งคือ **โค้ดที่เขียนคอลัมน์** ❌ ไม่ใช่ migration ที่เพิ่มคอลัมน์ — คนละนาที
    //   migration 0012 ลงคอลัมน์ไปแล้ว · ตัวเขียนตัวแรกอยู่ที่ mojisejr/mootech-fe#487 ซึ่งยังไม่ merge
    //   ⇒ แถวที่เกิด **หลัง** 0012 แต่ **ก่อน** #487 ก็เป็น NULL เหมือนกัน
    //   ฉบับแรกของคอมเมนต์นี้เขียนว่า "ก่อน migration 0012" ⇒ คนอ่านจะไปหาแถวที่เก่ากว่า migration แล้วไม่เจอสักแถว
    // แถวเหล่านั้นถูกถอนเลน v2 แต่ member_payment ถูกจงใจไม่แตะ (เดาวันไม่ได้)
    // ⇒ ผู้ใช้บางคนอาจยังเข้าใช้ได้ผ่านเลนเก่าชั่วคราว · ประโยคที่พูดถึงการซื้อครั้งนี้เป็นจริงทั้งสองเส้นทาง
    // เพราะแถว member_subscription ของการซื้อครั้งนี้ออกจาก ACTIVE เสมอ
    //
    // ❌ ไม่ใช้คำว่า ล้มเหลว — มันเคยสำเร็จ · ❌ ไม่โทษธนาคาร — ธนาคารไม่ได้ปฏิเสธ มันผ่านไปแล้ว
    // ❌ ไม่มีคำว่า ระบบยังตามให้ — ไม่มีใครตามให้ และนั่นคือประโยคที่ #484 สั่งให้เลิกพูด
    title: 'เงินถูกคืนกลับไปแล้ว',
    // ประโยคเดียว ปุ่มเป็นคนเสนอทางต่อเอง — ฉบับแรกต่อท้ายว่า "ถ้ายังต้องการ ซื้อใหม่ได้เลย"
    // แล้วที่ 393 คำว่า "ถ้ายัง / ต้องการ" ตกคนละบรรทัด
    body: 'การเป็นสมาชิกจากการชำระเงินครั้งนี้ถูกยกเลิกแล้ว',
    // 🔴 'buy-again' ❌ ไม่ใช่ 'new-qr' — ฉบับแรกใช้ 'new-qr' เพราะ **ปลายทางถูก** (checkout ของแพ็กเกจ)
    // แล้วปุ่มก็พิมพ์ว่า "ขอ QR ใหม่" ให้คนที่จ่ายด้วยบัตรและไม่เคยเห็น QR เลย
    // เป็นคลาสเดียวกับที่ 'new-qr' ถูกสร้างขึ้นมาแก้ — หยิบค่ามาใช้เพราะปลายทาง แล้วได้คำของเรื่องอื่นติดมา
    retry: 'buy-again',
    // 🔴 false — เงินไม่ได้อยู่กับเราแล้ว และผู้ใช้ไม่ได้ถือของ
    // ป้ายนี้ตอบคำถาม "เงินขยับไหม" ❌ ไม่ใช่ "เงินขยับแล้วอยู่ที่ไหน" ⇒ true ตรงนี้จะติ๊กถูกทางเทคนิค
    // แล้วขึ้นเครื่องหมายสำเร็จให้คนที่เพิ่งเสียสิทธิ์ไป
    paid: false,
  },
  QR_EXPIRED: {
    // 🔴 NO 'อาจ' HERE, ON PURPOSE. The row above hedges because nobody told us; this row exists only
    // when `qrDeadline === 'expired'` — the gateway's own deadline, read off the row (#476). Hedging
    // when we DO know sends a user who could simply ask for a new QR into another round of waiting.
    //
    // 🔴 BUT IT STILL SPEAKS TO TWO PEOPLE. A dead QR says nothing about whether money moved: someone
    // who scanned at the last second and lost the webhook is reading this too. So the second sentence
    // is kept word-for-word from QR_MAYBE_EXPIRED. What changed is our certainty about the QR — not
    // our certainty about their money.
    // 🔴 'new-qr' — A THIRD ACTION, ADDED BECAUSE THE WORDS ALREADY PROMISED IT (#455, caught in the photo).
    // The first version of this row said "ขอ QR ใหม่ได้เลย" while `retry: 'same'` rendered the only button
    // the vocabulary had: "ตรวจสอบอีกครั้ง". Every unit test was green — none of them can see that a
    // sentence names an action the screen does not offer. The screenshot could, on the first look.
    //
    // 'same' is WRONG here specifically because we were told. Asking again is the honest move when we do
    // not know (QR_MAYBE_EXPIRED keeps it); once the gateway's own deadline has passed, checking again
    // cannot revive the QR, and the person who never paid needs a fresh one.
    // This is mootech-fe#471's class — copy that promises a button that is not there.
    title: 'QR หมดอายุแล้ว',
    // 🔴 ประโยคจบที่ 'ระบบยังตามให้' ❌ ไม่ใช่ 'ระบบยังตามให้อยู่' — ตัดคำท้ายทิ้งเพราะการวางบรรทัด
    // ที่ 393 (ความกว้างจอหลัก) 'อยู่' ตกไปอยู่บรรทัดสองตัวเดียว ส่วนที่ 320 ตัดสวยอยู่แล้ว
    // ไทยไม่มีช่องว่างระหว่างคำ ⇒ เบราว์เซอร์ตัดด้วยพจนานุกรม และ assertion บน textContent มองไม่เห็น
    // ว่าบรรทัดถูกตัดตรงไหน ⇒ เห็นได้จากภาพเท่านั้น (mojisejr/mootech-fe#414 เป็นคลาสเดียวกัน)
    body: 'ขอ QR ใหม่ได้เลย · ถ้าจ่ายไปแล้ว ไม่ต้องจ่ายซ้ำ ระบบยังตามให้',
    retry: 'new-qr',
    paid: false,
  },
  ALREADY_ON_THIS_TIER: {
    // 🔴 THE FIRST WORD IS NOT "ล้มเหลว" AND MUST NEVER BECOME IT. Nothing went wrong here — the user
    // already owns what they were about to buy, which is good news wearing the clothes of an error.
    // The tier-less wording is the FALLBACK; resultCopyFor names the plan when the screen knows it.
    title: 'คุณเป็นสมาชิกอยู่แล้ว',
    body: 'ไม่มีการตัดเงิน แพ็กเกจนี้เปิดใช้งานอยู่แล้ว ดูวันหมดอายุได้ที่หน้าสิทธิ์ของฉัน',
    // 'none' — pressing anything here cannot change the outcome, and offering "ลองอีกครั้ง" would invite
    // them to walk back into the same refusal. The screen's single button becomes กลับหน้าแพ็กเกจ.
    retry: 'none',
    paid: false,
  },
  CANNOT_DOWNGRADE: {
    // Says what they HAVE, not what they may not do — the answer to "why can't I?" is that they are
    // already above it, which is not a punishment.
    title: 'คุณถือแพ็กเกจที่สูงกว่านี้อยู่',
    body: 'ไม่มีการตัดเงิน การซื้อแพ็กเกจที่เล็กกว่าจะทำให้สิทธิ์ที่คุณมีอยู่ลดลง ระบบจึงไม่ให้ทำ',
    retry: 'none',
    paid: false,
  },
}

/** The two #466 states, kept as a set so callers can ask "was this a refusal, not a failure?" without
 *  string-matching. Used by the copy refiner below and by the checkout page's 409 branch. */
export const REFUSED_STATES = ['ALREADY_ON_THIS_TIER', 'CANNOT_DOWNGRADE'] as const
export type RefusedState = (typeof REFUSED_STATES)[number]
export function isRefusedState(s: string): s is RefusedState {
  return (REFUSED_STATES as readonly string[]).includes(s)
}

/**
 * #466 — the copy, with the plan NAMED when the screen knows which one.
 *
 * 🔴 Why not just put the name in RESULT_COPY: every other string in this file is a constant, and the file
 * says so at the top ("every string lives here, so the per-line audit enumerates one file"). These two are
 * the only ones that depend on runtime data. Rather than turn the whole table into functions — which would
 * make the audit read thirteen call sites instead of one table — the table keeps a truthful tier-less
 * sentence, and this refines it. Both versions are correct; one is more specific.
 *
 * `planName` null (tier not resolved yet, or a plan we cannot name) ⇒ the fallback, never a code like
 * "PLUS" printed at a user.
 */
export function resultCopyFor(state: ResultState, planName?: string | null): ResultCopy {
  const base = RESULT_COPY[state]
  if (!planName) return base
  if (state === 'ALREADY_ON_THIS_TIER') {
    return { ...base, title: `คุณเป็นสมาชิก ${planName} อยู่แล้ว` }
  }
  if (state === 'CANNOT_DOWNGRADE') {
    return { ...base, title: `คุณเป็นสมาชิก ${planName} อยู่แล้ว`, body: `ไม่มีการตัดเงิน ${planName} ให้สิทธิ์มากกว่าแพ็กเกจที่เลือก ระบบจึงไม่ให้ลดระดับ` }
  }
  return base
}

/** The one place that answers "has their money moved?" — so no screen can decide it locally. */
export function isPaidState(s: ResultState): boolean {
  return RESULT_COPY[s].paid
}


// ─────────────────────────────────────────────────────────────────────────────
// #438 — THE RULE THAT PICKS THE STATE, moved next to the words it picks between.
//
// It used to be a nested ternary inside pages/v2/shop/result.tsx, which meant the only way to test it was
// to render a page and drive a router. So nobody did, and the branch that was missing (a refused charge)
// went unnoticed for as long as it existed. Pure function, four inputs, one answer.

export type WaitPhaseLike = 'waiting' | 'reconciling' | 'exhausted'

export type ResultInputs = {
  /** what /api/v2/payment/status says about THIS charge. */
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'UNKNOWN'
  /** 'card' | 'promptpay' | null — how the row was paid. Null until a row for this charge is seen. */
  method: string | null
  /** what the URL claims. Anyone can type a URL, so this never decides on its own. */
  claimed: ResultState
  /** how long we have been waiting, bucketed (useChargeStatus). */
  phase: WaitPhaseLike
  /**
   * #455 — what the SERVER says about the gateway's own deadline for this charge (`/payment/status`).
   *
   * 🔴 `liveUntil` is deliberately NOT here. It exists for a countdown, and `now > liveUntil` on the
   * user's device is true every day between two slow polls (30s — useChargeStatus.ts:113) without the QR
   * being dead. A comparison that reads as a verdict but is only a staleness signal is exactly how the
   * screen would start lying again, so this function is never given the material to make it.
   */
  qrDeadline: QrDeadlineState
  /**
   * #455 slice 3 — เหตุผลที่แถวจบแบบไม่ได้จ่าย (`/payment/status`, mojisejr/mootech-fe#481)
   * `null` = ไม่ถูกบอกเหตุ ❌ ไม่ใช่ "ไม่มีเหตุ" — และเป็นค่าที่ได้ตอน server ยังไม่ deploy ฟิลด์นี้ด้วย
   */
  failureCode: string | null
}

export function resolveResultState({ status, method, claimed, phase, qrDeadline, failureCode }: ResultInputs): ResultState {
  // 🔴 THE SERVER DECIDES WHETHER MONEY MOVED. A claimed APPROVED (or PAYING) only becomes a success once
  // /payment/status agrees about this charge — otherwise /v2/shop/result?state=APPROVED would be a page
  // that tells anyone their payment succeeded.
  // ── #484 — ต้องอยู่ **ก่อน** กิ่ง APPROVED ข้างล่าง ────────────────────────────────────────────────
  // แถวที่ถูกตีกลับ **คงสถานะ APPROVED ไว้** โดยตั้งใจ เพราะการจ่ายเกิดขึ้นจริงในอดีต
  // ⇒ ถ้ากิ่งนี้อยู่หลัง กิ่ง APPROVED จะตอบก่อน แล้วจอจะขึ้น "ชำระเงินสำเร็จ" พร้อม paid: true
  //   ในวินาทีที่เงินถูกคืนไปแล้วและสิทธิ์ถูกถอนไปแล้ว (ยิงยืนยันด้วยอินพุตตามสัญญาก่อนเขียนบรรทัดนี้)
  //
  // 🔴 ต้องดู `status` ด้วย ❌ ไม่ใช่ `failureCode` อย่างเดียว — ค่านี้มีผู้ผลิต **2 ราย**
  //   REJECT   + gateway_reversed   ตัวกระทบยอดเขียน (reconcile-run.ts) — ถูกตีกลับโดยไม่เคยมีใครได้สิทธิ์
  //   APPROVED + gateway_reversed   เส้นของ #484 — ให้สิทธิ์ไปแล้ว แล้วเอาคืน
  // เคสแรกไม่เคยมีสิทธิ์ให้ถอน ⇒ ห้ามได้คำว่า "การเป็นสมาชิก...ถูกยกเลิกแล้ว"
  // เคสแรกวันนี้ยังตกถัง QR_MAYBE_EXPIRED และยังพูดว่า "ระบบยังตามให้" ซึ่งผิดเหมือนกัน
  // ⇒ mojisejr/mootech-fe#488 ถือเรื่องนั้น (เลขนี้ยืนยันหลังเปิดใบจริงแล้ว ❌ ไม่ได้เดา)
  if (status === 'APPROVED' && failureCode === 'gateway_reversed') return 'PAYMENT_REVERSED'

  if (status === 'APPROVED') {
    return claimed === 'PAYING' || claimed === 'APPROVED' ? 'APPROVED' : 'ALREADY_PAID'
  }

  // 🔴 AND THE SERVER ALSO DECIDES WHEN IT DID NOT (#438). This arm did not exist; without it a refused
  // charge fell through to the clock-based branch below, where PAYING has paid:false, so it landed on
  // `claimed` — the literal string 'PAYING' — and stayed there no matter how much time passed.
  //
  // Card ONLY, deliberately: v2_payment has one 'REJECT' but two causes, and CARD_DECLINED's words
  // ("ลองใช้บัตรใบอื่น") are wrong for a PromptPay QR that expired. PromptPay keeps its old behaviour
  // here until mootech-fe#443 gives it words of its own — a known gap, not a forgotten one.
  if (status === 'REJECTED' && method === 'card') return 'CARD_DECLINED'

  // ── #455 slice 3 — พร้อมเพย์ที่จบแล้ว ต้องไม่ตกไปที่กิ่งนาฬิกาข้างล่าง ─────────────────────────────
  //
  // 🔴 บั๊กที่กิ่งนี้แก้ ไม่ใช่ "คำไม่สวย" แต่คือ **จอค้างตลอดกาล**
  // useChargeStatus.ts:83 นับ REJECTED เป็น settled ⇒ :208 ออกจาก loop ⇒ บรรทัดที่ setPhase (:218-219)
  // ไม่เคยถูกเดินอีกเลย ⇒ phase แช่ที่ 'waiting' ถาวร ⇒ แถวพร้อมเพย์ที่ REJECT ตกลงมาที่กิ่งข้างล่าง
  // แล้วอ่าน phase ที่แช่อยู่ ⇒ ผู้ใช้เห็น "กำลังดำเนินการ" ไปตลอด ไม่ใช่ 30 นาทีแล้วหาย
  // (ยิงจอจริงยืนยันแล้ว 3 phase × 3 เคส ก่อนเขียนกิ่งนี้)
  //
  // ก่อน slice 3 ช่องนี้แคบมากเพราะพร้อมเพย์แทบไม่เคยเป็น REJECT · slice 3 ทำให้มันเป็นทางหลัก
  // (พร้อมเพย์ 74 จาก 74 ใบจบที่ expired) ⇒ งานจอคืออีกครึ่งของการเปลี่ยนแปลงเดียวกัน ❌ ไม่ใช่งานตามหลัง
  if (status === 'REJECTED' && method === 'promptpay') {
    // 🔴 สองคำนี้คือคำที่ slice 3 เขียนลงคอลัมน์เมื่อ "แถวจบแล้วและไม่มีใครจ่าย" (reconcile-run.ts)
    // ⇒ ตรงนี้เราถูกบอกทั้งสองอย่าง: server จบแล้ว และเหตุคือหมดอายุ ⇒ พูดตรง ๆ ได้
    // ชุดค่าที่ฝั่ง server ผลิตได้ มีสามตัวเท่านั้น (reconcile-run.ts · ยืนยันกับบอง 2026-08-27)
    //   gateway_expired    QR ตาย ไม่มีใครจ่าย ไม่มีใครปฏิเสธ   ← ตัวเดียวที่แปลว่าหมดอายุ
    //   gateway_failed     gateway จบให้ แต่ไม่ได้ให้รหัสของตัวเอง
    //   gateway_reversed   เคยจ่ายแล้ว แล้วเงินถูกตีกลับ
    // นอกจากสามตัวนี้ = รหัสจาก Omise ตรง ๆ = ถูกปฏิเสธจริง
    //
    // 🔴 เทียบด้วย === ❌ ไม่ใช่ startsWith — ผู้ผลิตสร้างค่านี้เต็มพอดี ไม่มีส่วนต่อท้าย
    // คอมเมนต์ฝั่ง server เคยเขียนว่า "starts" ⇒ คนอ่านคำอธิบายจะเขียน startsWith คนอ่านโค้ดจะเขียน ===
    // แล้วทั้งคู่เชื่อว่าทำตามสัญญา · บองแก้คำนั้นแล้วและเขียนกำกับไว้ว่าเคยทำให้เกิดเรื่องนี้
    //
    // 🔴 `mootech_expired` ถูกยกเลิกถาวร ❌ ห้ามเติมกลับ — ไม่ใช่แค่ "วันนี้ไม่มีผู้ผลิต"
    // isRefusedCharge เป็นจริงเฉพาะเมื่อ status อยู่ใน TERMINAL_FAILURE_STATUSES ⇒ ไม่มีเคสที่ gateway
    // ไม่บอก status ให้ fallback รับ ⇒ กิ่งนั้นเดินไปไม่ถึงเชิงโครงสร้าง
    // ฉบับก่อนของบรรทัดนี้เขียน `|| failureCode === 'mootech_expired'` เพราะคอมเมนต์ฝั่ง server บอกให้จับคู่
    if (failureCode === 'gateway_expired') return 'QR_EXPIRED'

    // server ยังไม่ส่ง failureCode ออกมา (deploy ไม่พร้อมกัน) ⇒ ถอยไปใช้สัญญาณที่มีอยู่บน wire แล้ว
    // สองสัญญาณต้องตรงกันถึงจะพูดว่าหมดอายุ: แถวจบแล้ว **และ** QR ตายแล้ว
    if (failureCode === null && qrDeadline === 'expired') return 'QR_EXPIRED'

    // เหลือ: แถวจบแล้ว แต่เราอธิบายไม่ได้ว่าทำไม
    // ⚠️ ยังไม่มีคำที่ถูกสำหรับเคสนี้ — นั่นคือ mojisejr/mootech-fe#443 (พร้อมเพย์ที่ล้มเหลวต้องมีคำของตัวเอง)
    // QR_MAYBE_EXPIRED เป็นแถวที่ผิดน้อยที่สุดที่มีอยู่: หัวข้อฮedge ด้วยคำว่า "อาจ" และเนื้อของมัน
    // (ยังไม่จ่าย → ขอ QR ใหม่ · จ่ายแล้ว → ไม่ต้องจ่ายซ้ำ) ถูกต้องกับพร้อมเพย์ที่จบแบบไม่ได้จ่ายทุกกรณี
    // 🔴 มันยัง**ไม่ถูก**เพราะหัวข้อชี้สาเหตุที่เราอาจรู้อยู่แล้วว่าไม่ใช่ — แต่ค้างตลอดกาลแย่กว่า
    return 'QR_MAYBE_EXPIRED'
  }

  // An unverified claim of success is 'PAYING' while we poll fast, 'RECONCILING' while the repair cron may
  // still settle it, and only then 'QR_MAYBE_EXPIRED' (#423). The middle one exists so the screen never
  // suggests paying again during the window that fixes it for free.
  if (RESULT_COPY[claimed].paid) {
    if (phase === 'waiting') return 'PAYING'
    // 🔴 `expired` DOES NOT BEAT RECONCILING (#423). The QR being dead says nothing about whether money
    // moved, and while the repair cron's window is open it may still settle for free. Offering "ขอ QR ใหม่"
    // in that window is how a user pays twice — the exact thing RECONCILING was added to prevent.
    if (phase === 'reconciling') return 'RECONCILING'
    // Only PromptPay has a QR to expire. The card lane's charge_expires_at is null for the whole lane
    // (lib/payment/qr-deadline.ts:6) so it answers 'unknown' today — but if that ever changes, a card
    // holder must not be handed words about a QR they never saw.
    return qrDeadline === 'expired' && method === 'promptpay' ? 'QR_EXPIRED' : 'QR_MAYBE_EXPIRED'
  }

  // Claims that do not assert payment (a declined card, our own offline) are shown as-is — they cost the
  // user nothing if wrong, and the alternative is a blank screen after a failure.
  return claimed
}

/**
 * #438 — where "เลือกวิธีชำระเงินอื่น" goes.
 *
 * 🔴 A bare '/v2/shop/checkout' is a DEAD END, not a neutral fallback: checkout reads package_code from the
 * query, gets '', and /api/v2/payment/preview answers 400. The user who was just declined would press the
 * one button offered and land on a second broken screen. With no package to return to, the package list is
 * the honest destination.
 */
export function tryAnotherHref(packageCode: string): string {
  return packageCode ? `/v2/shop/checkout?package_code=${encodeURIComponent(packageCode)}` : '/v2/shop'
}

/**
 * #466 — where a REFUSED purchase goes, or null when this was not a refusal.
 *
 * Lives here, not in pages/v2/shop/checkout.tsx, for the reason that file states about itself at line 5:
 * "a page is the one place nobody writes unit tests for, so it should hold as few decisions as possible".
 * The decision this makes is which words a paying member sees about their own money — exactly the kind that
 * must not sit somewhere untestable. That is not hypothetical: the branch it replaces (`!r.ok` ⇒
 * CARD_DECLINED) was wrong from the moment mootech-fe#456 shipped, and no test could see it.
 *
 * 🔴 BOTH halves of the guard are required.
 *   status 409 alone is not proof — a quote whose price moved also answers 409 (charge-flow.ts:86) and
 *   belongs on a different screen.
 *   A `purchaseError` we do not recognise must never be pasted in as a state name — result.tsx falls back
 *   to PAYING for anything not in RESULT_COPY, which would park the reader on a spinner for a payment that
 *   never started. isRefusedState is the closed-union check that keeps the URL honest.
 *
 * `planName` is a display name ('Mumate +'), never a tier code, and it is optional: unknown ⇒ omitted ⇒
 * the screen uses its truthful tier-less wording rather than printing PLUS at a human.
 */
export function refusedHref(args: {
  status: number
  purchaseError?: string | null
  packageCode: string
  planName?: string | null
}): string | null {
  const { status, purchaseError, packageCode, planName } = args
  if (status !== 409 || !purchaseError || !isRefusedState(purchaseError)) return null
  const q = new URLSearchParams({ state: purchaseError, package_code: packageCode })
  if (planName) q.set('plan', planName)
  return `/v2/shop/result?${q.toString()}`
}
