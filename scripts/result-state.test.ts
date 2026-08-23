// #363 — the per-line audit of the six post-payment states. MAIN lane.
//
// 🔴 MUTANT CONTRACT:
//   MU1  mark a non-paid state `paid: true`                  → "only two states mean money moved" reddens
//   MU2  give OFFLINE the words of a failed payment          → "our network is not their money" reddens
//   MU3  give CARD_DECLINED retry:'same'                     → "retry advice matches reality" reddens
//   MU4  replace a body with a generic "เกิดข้อผิดพลาด"       → "every failure says if retrying helps" reddens
//   MU5  drop a state from RESULT_COPY                       → the closed-union test reddens
//
// 🔑 THIS FILE IS THE AUDIT THE TICKET ASKS FOR, and it is a TABLE rather than an eyeball pass because the
// ticket's own warning is that these six lines exist nowhere in Figma: nobody will diff them against a frame,
// so the only reader they will ever get is this one. "ครบ" becomes answerable — there are exactly six, and
// here is the verdict on all six.
import { describe, it, expect } from 'vitest'
import { RESULT_COPY, isPaidState, type ResultState } from '@/features/v2-shop/result-state'

const STATES: ResultState[] = ['PAYING', 'APPROVED', 'CARD_DECLINED', 'OFFLINE', 'ALREADY_PAID', 'QR_MAYBE_EXPIRED']

describe('#363 the six states, enumerated', () => {
  it('there are exactly six, and the table covers all of them', () => {
    // Surface size out loud: the assertions below iterate this list, so a shrunken list would quietly pass.
    expect(STATES).toHaveLength(6)
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
      expect(['same', 'different', 'none']).toContain(c.retry)
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

  it('the QR state says อาจ — we are never told when a QR dies', () => {
    expect(RESULT_COPY.QR_MAYBE_EXPIRED.title).toContain('อาจ')
  })
})
