// #363 — the per-line audit of the post-payment states. MAIN lane.
// #423 — a SEVENTH state (RECONCILING) joined them; the count below is the tripwire that made adding it a
// deliberate act instead of a silent one.
// #466 — an EIGHTH and NINTH (ALREADY_ON_THIS_TIER, CANNOT_DOWNGRADE). The tripwire did its job: adding
// them turned this file red and forced the words to be written here, in the audited table, rather than
// invented at a call site. They are a different KIND of row from the other seven — nothing was charged,
// nothing was declined, nothing is in flight; the purchase was refused before it began — so they get
// their own assertions below rather than being folded into the failure vocabulary.
//
// 🔴 MUTANT CONTRACT:
//   MU1  mark a non-paid state `paid: true`                  → "only two states mean money moved" reddens
//   MU2  give OFFLINE the words of a failed payment          → "our network is not their money" reddens
//   MU3  give CARD_DECLINED retry:'same'                     → "retry advice matches reality" reddens
//   MU4  replace a body with a generic "เกิดข้อผิดพลาด"       → "every failure says if retrying helps" reddens
//   MU5  drop a state from RESULT_COPY                       → the closed-union test reddens
//   MU6  let a refusal blame the bank or the network         → "a refusal is not a failure" reddens
//   MU7  give a refusal retry:'same'/'different'             → "nothing to retry" reddens
//   MU8  resultCopyFor stops naming the plan                 → "the plan is named when known" reddens
//   MU9  refusedHref stops recognising 409 + purchaseError   → "a refusal is routed to its own screen" reddens
//   MU10 refusedHref accepts ANY 409, or any purchaseError   → "only a known refusal is routed" reddens
//
// 🔑 THIS FILE IS THE AUDIT THE TICKET ASKS FOR, and it is a TABLE rather than an eyeball pass because the
// ticket's own warning is that these lines exist nowhere in Figma: nobody will diff them against a frame,
// so the only reader they will ever get is this one. "ครบ" becomes answerable — there are exactly eleven, and
// here is the verdict on all eleven.
// #455 — a TENTH (QR_EXPIRED). The tripwire fired again and this is the deliberate act it forces: the words
// for the row where the gateway DID tell us are written here, in the audited table, not at a call site.
import { describe, it, expect } from 'vitest'
import {
  RESULT_COPY,
  isPaidState,
  isRefusedState,
  resultCopyFor,
  refusedHref,
  REFUSED_STATES,
  type ResultState,
} from '@/features/v2-shop/result-state'

const STATES: ResultState[] = [
  'PAYING', 'APPROVED', 'CARD_DECLINED', 'OFFLINE', 'ALREADY_PAID', 'RECONCILING', 'QR_MAYBE_EXPIRED',
  'QR_EXPIRED', 'PAYMENT_REVERSED', 'ALREADY_ON_THIS_TIER', 'CANNOT_DOWNGRADE',
]

describe('#363/#423/#466/#455 the eleven states, enumerated', () => {
  it('there are exactly eleven, and the table covers all of them', () => {
    // Surface size out loud: the assertions below iterate this list, so a shrunken list would quietly pass.
    expect(STATES).toHaveLength(11)
    expect(Object.keys(RESULT_COPY).sort()).toEqual([...STATES].sort())
  })

  it('🔴 exactly two states mean the money moved — and they are the two that really did', () => {
    const paid = STATES.filter(isPaidState)
    expect(paid.sort()).toEqual(['ALREADY_PAID', 'APPROVED'])
    // Everything else must be unambiguous that nothing was taken.
    for (const s of STATES.filter((x) => !isPaidState(x))) {
      expect(RESULT_COPY[s].paid, `${s} must not claim payment`).toBe(false)
    }
  })

  it('every line tells the reader whether trying again could work', () => {
    for (const s of STATES) {
      const c = RESULT_COPY[s]
      expect(['same', 'different', 'new-qr', 'none']).toContain(c.retry)
      // The generic sentence that is true of all six and useful in none (#347/#263).
      expect(c.body, `${s} falls back to a non-answer`).not.toMatch(/เกิดข้อผิดพลาด|ผิดพลาดบางอย่าง|ลองใหม่อีกครั้งภายหลัง/)
      expect(c.title.length).toBeGreaterThan(0)
      expect(c.body.length).toBeGreaterThan(0)
    }
  })

  it('the retry advice matches what is actually true of each state', () => {
    // A declined card: the SAME card will most likely be declined again — offering "try again" would send
    // the user in a circle. A different instrument is the real way forward.
    expect(RESULT_COPY.CARD_DECLINED.retry).toBe('different')
    // Our own connectivity: the same action genuinely can work on the next press.
    expect(RESULT_COPY.OFFLINE.retry).toBe('same')
    expect(RESULT_COPY.QR_MAYBE_EXPIRED.retry).toBe('same')
    // Nothing to retry once it is settled or in flight.
    expect(RESULT_COPY.APPROVED.retry).toBe('none')
    expect(RESULT_COPY.ALREADY_PAID.retry).toBe('none')
    expect(RESULT_COPY.PAYING.retry).toBe('none')
  })

  it('🔴 OUR failure is never worded as THEIR payment failing', () => {
    const c = RESULT_COPY.OFFLINE
    for (const forbidden of ['ล้มเหลว', 'ไม่สำเร็จ', 'ถูกปฏิเสธ']) {
      expect(`${c.title} ${c.body}`, `OFFLINE blames the user's payment with "${forbidden}"`).not.toContain(forbidden)
    }
    // ...and it says the money is safe, which is the thing the reader is actually frightened about.
    expect(c.body).toContain('เงินไม่หาย')
  })

  it('a declined card says nothing was taken — the fear this screen must answer', () => {
    expect(RESULT_COPY.CARD_DECLINED.body).toContain('ยังไม่มีการตัดเงิน')
  })

  it('the double-press state does not read as a SECOND payment going through', () => {
    const c = RESULT_COPY.ALREADY_PAID
    expect(c.body).toContain('ไม่มีการตัดเงินซ้ำ')
    expect(c.title).not.toContain('สำเร็จ') // "ชำระเงินสำเร็จ" here reads as "your second one worked"
  })

  // 🔴 #455 CHANGED THE SENTENCE THIS TEST USED TO CARRY. It read "we are never told when a QR dies",
  // which was true of the whole system until /payment/status started carrying `qrDeadline` (#476). The
  // assertion never broke — only the reason under it did, which is the failure mode where a green test
  // teaches the next reader something that stopped being true. Both rows are now named, side by side.
  it('อาจ belongs to the row where nobody told us, and ONLY to that row', () => {
    expect(RESULT_COPY.QR_MAYBE_EXPIRED.title).toContain('อาจ')
    expect(RESULT_COPY.QR_EXPIRED.title).not.toContain('อาจ')
  })

  it('#484 — the reversed row speaks about THIS purchase, and never promises a chase', () => {
    const c = RESULT_COPY.PAYMENT_REVERSED
    // พูดถึงการซื้อครั้งนี้ ❌ ไม่ใช่สถานะสมาชิกโดยรวม — แถวก่อน migration 0012 อาจยังใช้เลนเก่าได้ชั่วคราว
    expect(c.body).toContain('การชำระเงินครั้งนี้')
    // ประโยคที่ #484 สั่งให้เลิกพูด
    expect(c.body).not.toContain('ระบบยังตามให้')
    // ❌ ไม่ใช่ความล้มเหลว มันเคยสำเร็จ · ❌ ไม่โทษธนาคาร
    expect(c.title).not.toContain('ล้มเหลว')
    expect(c.body + c.title).not.toContain('ธนาคาร')
    // 🔴 เงินไม่ได้อยู่กับเราแล้ว ⇒ ห้ามขึ้นเครื่องหมายว่าเงินขยับ
    expect(c.paid).toBe(false)
  })

  it('the told row is certain about the QR and still careful about the money', () => {
    const c = RESULT_COPY.QR_EXPIRED
    // certain: no hedge about the QR itself — the gateway's own deadline said so.
    expect(c.title).toContain('หมดอายุแล้ว')
    // careful: a dead QR says NOTHING about whether money moved. The second audience must survive here,
    // or someone who paid at the last second and lost the webhook is told to go and pay again.
    expect(c.body).toContain('ไม่ต้องจ่ายซ้ำ')
    expect(c.paid).toBe(false)
  })
})

// ── #466 — a REFUSAL is not a FAILURE ────────────────────────────────────────────────────────────────
//
// ฟีม hit this on the live site the day #456 shipped: a PLUS member pressing pay was told
// "ธนาคารปฏิเสธการชำระเงิน" about a card the bank had never seen. The server was right; the screen
// translated a 409 it did not recognise into the nearest failure it knew.
describe('#466 the two refusal states', () => {
  it('MU6 — a refusal never blames the bank, the card, or the network', () => {
    for (const s of REFUSED_STATES) {
      const c = RESULT_COPY[s]
      const text = `${c.title} ${c.body}`
      for (const forbidden of ['ธนาคาร', 'บัตร', 'การเชื่อมต่อ', 'ล้มเหลว', 'ไม่สำเร็จ']) {
        expect(text, `${s} blames the wrong thing with "${forbidden}"`).not.toContain(forbidden)
      }
    }
  })

  it('🔴 both say plainly that no money was taken — the fear this screen must answer', () => {
    for (const s of REFUSED_STATES) {
      expect(RESULT_COPY[s].body, `${s} must say nothing was charged`).toContain('ไม่มีการตัดเงิน')
    }
  })

  it('MU7 — nothing to retry: pressing again cannot change a refusal', () => {
    for (const s of REFUSED_STATES) {
      expect(RESULT_COPY[s].retry, `${s} must not invite another attempt`).toBe('none')
      expect(RESULT_COPY[s].paid, `${s} must not claim payment`).toBe(false)
    }
    // retry:'none' + paid:false is what makes ResultScreen offer ONE button, กลับหน้าแพ็กเกจ, which is
    // where ฟีม asked these users to land (2026-08-26).
  })

  it('isRefusedState answers for the two, and for nothing else', () => {
    for (const s of STATES) {
      expect(isRefusedState(s), s).toBe(REFUSED_STATES.includes(s as never))
    }
    expect(isRefusedState('CARD_DECLINED')).toBe(false)
    expect(isRefusedState('nonsense')).toBe(false)
  })

  it('MU8 — the plan is NAMED when the screen knows it', () => {
    const named = resultCopyFor('ALREADY_ON_THIS_TIER', 'Mumate +')
    expect(named.title).toContain('Mumate +')
    expect(named.title).not.toBe(RESULT_COPY.ALREADY_ON_THIS_TIER.title)

    const down = resultCopyFor('CANNOT_DOWNGRADE', 'Mumate Pro')
    expect(down.title).toContain('Mumate Pro')
    expect(down.body).toContain('Mumate Pro')
  })

  it('🔴 and it NEVER prints a raw tier code at the user when the name is unknown', () => {
    for (const bad of [null, undefined, '']) {
      const c = resultCopyFor('ALREADY_ON_THIS_TIER', bad)
      expect(c).toEqual(RESULT_COPY.ALREADY_ON_THIS_TIER) // the truthful tier-less fallback
      expect(`${c.title} ${c.body}`).not.toMatch(/PLUS|PRO|FREE/)
    }
  })

  it('resultCopyFor leaves the other seven exactly as they are', () => {
    for (const s of STATES.filter((x) => !isRefusedState(x))) {
      expect(resultCopyFor(s, 'Mumate Pro'), s).toEqual(RESULT_COPY[s])
    }
  })

  // ── the routing decision, moved OUT of the page so it can be watched ─────────────────────────────
  //
  // Before #466 this branch was `if (!r.ok) → CARD_DECLINED` inside pages/v2/shop/checkout.tsx. It was
  // wrong from the moment mootech-fe#456 shipped and nothing could see it, because a page is the one place
  // nobody unit-tests — a fact that file states about itself at line 5. So the decision moved here.
  it('MU9 — a recognised refusal is routed to its own screen, carrying the package and the plan', () => {
    expect(
      refusedHref({ status: 409, purchaseError: 'ALREADY_ON_THIS_TIER', packageCode: 'V2_PLUS_YEARLY', planName: 'Mumate +' }),
    ).toBe('/v2/shop/result?state=ALREADY_ON_THIS_TIER&package_code=V2_PLUS_YEARLY&plan=Mumate+%2B')

    expect(refusedHref({ status: 409, purchaseError: 'CANNOT_DOWNGRADE', packageCode: 'V2_PLUS_YEARLY' })).toBe(
      '/v2/shop/result?state=CANNOT_DOWNGRADE&package_code=V2_PLUS_YEARLY',
    )
  })

  it('🔴 MU10 — everything else stays null, so the old failure screens keep their cases', () => {
    // a 409 that is NOT a refusal: the quote's price moved (charge-flow.ts:86) — a different screen
    expect(refusedHref({ status: 409, purchaseError: undefined, packageCode: 'P' })).toBeNull()
    expect(refusedHref({ status: 409, purchaseError: 'QUOTE_REQUIRED', packageCode: 'P' })).toBeNull()
    // a refusal-shaped string on a NON-409 answer proves nothing — do not take the client's word for it
    expect(refusedHref({ status: 200, purchaseError: 'ALREADY_ON_THIS_TIER', packageCode: 'P' })).toBeNull()
    expect(refusedHref({ status: 500, purchaseError: 'ALREADY_ON_THIS_TIER', packageCode: 'P' })).toBeNull()
    // and a string that is not a state at all must never reach the URL: result.tsx would fall back to
    // PAYING and park the reader on a spinner for a payment that never started
    expect(refusedHref({ status: 409, purchaseError: 'ANYTHING_ELSE', packageCode: 'P' })).toBeNull()
    expect(refusedHref({ status: 409, purchaseError: 'CARD_DECLINED', packageCode: 'P' })).toBeNull()
  })

  it('a plan name with spaces and + survives the trip through the URL', () => {
    const href = refusedHref({ status: 409, purchaseError: 'ALREADY_ON_THIS_TIER', packageCode: 'P', planName: 'Mumate +' })
    const plan = new URLSearchParams(href!.split('?')[1]).get('plan')
    expect(plan, 'a raw + in a query string decodes as a space').toBe('Mumate +')
  })
})