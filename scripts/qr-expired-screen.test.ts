// #455 slice 2 — จอพูดเรื่อง QR หมดอายุ **จากคำตอบของ server** ❌ ไม่ใช่จากนาฬิกาตัวเอง
//
// ก่อน slice นี้ จอตัดสินเรื่องนี้ที่ result-state.ts:198 ด้วย `phase` ล้วน ๆ ซึ่งมาจาก
// useChargeStatus (นาฬิกาของเครื่องผู้ใช้) ⇒ คำว่า "อาจ" ใน QR_MAYBE_EXPIRED ถูกต้องมาตลอด เพราะไม่มีใครบอกเรา
// slice 1 (#476) ทำให้ /api/v2/payment/status ตอบ qrDeadline มาแล้ว ⇒ บางเคสเรา **ถูกบอกแล้ว**
//
// 🔴 MUTANT CONTRACT — ทุกตัวต้องลงบน "โค้ดที่ ship" ❌ ไม่ใช่คอมเมนต์ และต้องพิมพ์บรรทัดที่มันลงออกมา
//   MU1  ให้ qrDeadline 'live' ตกลงไปเป็น QR_EXPIRED     → "live ไม่เคยแปลว่าหมดอายุ" แดง
//   MU2  ให้ qrDeadline 'unknown' ตกลงไปเป็น QR_EXPIRED  → "ไม่รู้ ไม่ใช่ หมดอายุ" แดง
//   MU3  ให้ 'expired' ชนะ RECONCILING                   → "หน้าต่างซ่อมฟรียังเปิดอยู่" แดง
//   MU4  ยุบ QR_EXPIRED กลับไปเป็น QR_MAYBE_EXPIRED       → "สองสถานะ พูดกับคนละคน" แดง
//   MU5  ให้ QR_EXPIRED ใช้คำของ QR_MAYBE_EXPIRED         → "ถูกบอกแล้ว จึงไม่ต้องพูดว่า อาจ" แดง
//   MU6  ให้ QR_EXPIRED ตั้ง paid: true                   → "ไม่มีเงินออก" แดง
//
// 🔑 ฟันสองตัวที่ตกลงกับตู๋ไว้ตั้งแต่ #476 อยู่ที่ ①  และ ②  ข้างล่าง — ตัวที่ ② คือการ **เข้ารหัสจุดบอด**
import { describe, it, expect } from 'vitest'
import {
  resolveResultState,
  RESULT_COPY,
  type ResultInputs,
  type ResultState,
} from '@/features/v2-shop/result-state'
import type { QrDeadlineState } from '@/lib/payment/qr-deadline'

const ALL_DEADLINES: QrDeadlineState[] = ['expired', 'live', 'unknown']

/**
 * จุดตั้งต้น: คนที่ **อ้างว่าจ่ายแล้ว** server ยังไม่ยืนยัน และเลยเส้นตายของนาฬิกาเราแล้ว
 *
 * 🔴 `claimed` ต้องเป็นสถานะที่ `paid: true` ไม่งั้นไม่มีวันเดินเข้ากิ่งที่ไฟล์นี้ทดสอบเลย
 * (result-state.ts:197 `if (RESULT_COPY[claimed].paid)`) — ฉบับแรกของไฟล์นี้ใช้ 'PAYING' ซึ่ง `paid: false`
 * ⇒ ทุกเคสตกไปที่ `return claimed` แล้วฟันสี่ตัวเขียวโดยไม่ได้ตรวจอะไรเลย จับได้ตอนรันแดงครั้งแรก
 */
const base: ResultInputs = {
  status: 'PENDING',
  method: 'promptpay',
  claimed: 'APPROVED',
  phase: 'exhausted',
  failureCode: null,
}

describe('#455 ตัวคุม fixture — ถ้า fixture ไม่เดินเข้ากิ่ง ฟันทั้งไฟล์เป็นเขียวปลอม', () => {
  it('claimed ของ fixture ต้องเป็นสถานะที่ paid: true', () => {
    expect(RESULT_COPY[base.claimed].paid, `claimed=${base.claimed}`).toBe(true)
  })

  it('fixture เดินไปถึงกิ่งที่ผูกกับ phase จริง — สาม phase ต้องให้ผลต่างกันสามแบบ', () => {
    // ถ้าวันหนึ่งกิ่งนี้ถูกย้าย/ลบ สามค่านี้จะยุบเหลือค่าเดียว แล้วเทสต์ข้างล่างจะกลายเป็นเขียวปลอมเงียบ ๆ
    const got = (['waiting', 'reconciling', 'exhausted'] as const).map((phase) =>
      resolveResultState({ ...base, phase, qrDeadline: 'unknown' }),
    )
    expect(new Set(got).size, `ได้ ${got.join(' / ')}`).toBe(3)
  })
})

describe('#455 ① live + liveUntil ที่เป็นอดีต — เกิดทุกวัน และห้ามอ่านว่าหมดอายุ', () => {
  // slow poll ห่างกัน 30 วิ (useChargeStatus.ts:113) ⇒ ระหว่างสองรอบ liveUntil < now บนเครื่องผู้ใช้
  // เป็นจริง**ทุกวัน** — พิสูจน์ไว้แล้วที่ scripts/qr-expiry-reaches-row.test.ts:121-134
  // กติกา: นั่นแปลว่า "คำตอบที่เราถืออยู่เก่าแล้ว ⇒ ไปถามใหม่" ❌ ไม่ใช่คำตัดสินว่าหมดอายุ
  it('qrDeadline live ไม่เคยให้ผลเป็น QR_EXPIRED ไม่ว่า phase หรือ claimed จะเป็นอะไร', () => {
    const phases: ResultInputs['phase'][] = ['waiting', 'reconciling', 'exhausted']
    const claims: ResultState[] = ['PAYING', 'APPROVED', 'QR_MAYBE_EXPIRED', 'RECONCILING']
    let checked = 0
    for (const phase of phases) {
      for (const claimed of claims) {
        const got = resolveResultState({ ...base, phase, claimed, qrDeadline: 'live' })
        expect(got, `phase=${phase} claimed=${claimed}`).not.toBe('QR_EXPIRED')
        checked++
      }
    }
    // ประกาศขนาดพื้นผิวออกมาดัง ๆ — ถ้ารายการหด เทสต์นี้จะผ่านโดยตรวจของน้อยลงเงียบ ๆ
    expect(checked, 'จำนวนช่องที่ตรวจจริง').toBe(12)
  })

  it('resolveResultState ไม่มีทางเห็น liveUntil เลย ⇒ เขียน now > liveUntil ตรงนี้ไม่ได้ตั้งแต่ต้น', () => {
    // เอาความเป็นไปได้ออก ❌ ไม่ใช่เฝ้ามัน — หลักเดียวกับที่ qr-deadline.ts เลือกไว้
    const keys = Object.keys({ ...base, qrDeadline: 'live' } as ResultInputs)
    expect(keys).not.toContain('liveUntil')
  })
})

describe('#455 ② unknown — จุดบอดที่ type ปิดไว้แล้ว เขียนเป็นเทสต์ที่ผ่านเพื่อให้มันส่งเสียงถ้าถูกเปิด', () => {
  // วันนี้ qrStatusFields สร้าง { qrDeadline: 'unknown', liveUntil: <ค่า> } ไม่ได้ เพราะ type ปฏิเสธ
  // (lib/payment/qr-deadline.ts:56-58 · discriminated union)
  // ⇒ เทสต์นี้ **ผ่านตั้งแต่วันแรก** และนั่นคือประเด็นของมัน: ถ้าวันหนึ่งมีคนแยกสองช่องออกจากกันอีกครั้ง
  //   จอจะเริ่มเห็น unknown คู่กับ timestamp และตัวที่ต้องส่งเสียงคือบรรทัดนี้
  it('unknown ไม่เคยให้ผลเป็น QR_EXPIRED — ไม่รู้ ไม่ใช่ หมดอายุ', () => {
    const phases: ResultInputs['phase'][] = ['waiting', 'reconciling', 'exhausted']
    for (const phase of phases) {
      expect(resolveResultState({ ...base, phase, qrDeadline: 'unknown' }), `phase=${phase}`)
        .not.toBe('QR_EXPIRED')
    }
  })

  it('unknown ที่เลยนาฬิกาเราแล้ว ยังได้คำที่มีคำว่า อาจ อยู่ — เพราะเรายังไม่ถูกบอก', () => {
    expect(resolveResultState({ ...base, qrDeadline: 'unknown' })).toBe('QR_MAYBE_EXPIRED')
    expect(RESULT_COPY.QR_MAYBE_EXPIRED.title).toContain('อาจ')
  })
})

describe('#455 expired — ถูกบอกแล้ว จอจึงพูดตรง ๆ ได้', () => {
  it('expired + เลยหน้าต่างซ่อมฟรีแล้ว → QR_EXPIRED', () => {
    expect(resolveResultState({ ...base, qrDeadline: 'expired' })).toBe('QR_EXPIRED')
  })

  it('🔴 expired ไม่ชนะ RECONCILING — หน้าต่างซ่อมฟรียังเปิด ห้ามชวนให้จ่ายซ้ำ', () => {
    // #423 สร้าง RECONCILING ขึ้นมาเพื่อไม่ให้จอชวนจ่ายรอบสองระหว่างที่ cron ยังซ่อมให้ฟรีได้
    // QR ตายแล้วก็จริง แต่เงินของคนที่จ่ายวินาทีสุดท้ายอาจกำลังเดินอยู่ ⇒ คำว่า "ขอ QR ใหม่" ตรงนี้ = เสี่ยงจ่ายซ้ำ
    expect(resolveResultState({ ...base, phase: 'reconciling', qrDeadline: 'expired' })).toBe('RECONCILING')
  })

  it('expired ไม่แตะเลนบัตร — บัตรไม่มีเส้นตายแบบ QR', () => {
    // เลนบัตร charge_expires_at เป็น null ทั้งเลน (qr-deadline.ts:6) ⇒ ได้ unknown เสมอ
    // แต่ถ้าวันหนึ่งมันไม่ null ขึ้นมา จอต้องไม่เอาคำของ QR ไปพูดกับคนถือบัตร
    const got = resolveResultState({ ...base, method: 'card', qrDeadline: 'expired' })
    expect(got).not.toBe('QR_EXPIRED')
  })

  it('ทุกค่าของ qrDeadline ถูกเดินจริงในเทสต์ชุดนี้ — ไม่มีกิ่งไหนไม่เคยถูกแตะ', () => {
    const seen = new Set(ALL_DEADLINES.map((d) => resolveResultState({ ...base, qrDeadline: d })))
    expect(ALL_DEADLINES).toHaveLength(3)
    expect(seen.size, 'สามค่าต้องให้ผลไม่เหมือนกันทั้งหมด ไม่งั้นแปลว่ามีค่าที่ไม่มีผล').toBeGreaterThan(1)
  })
})

describe('#455 คำของ QR_EXPIRED — ถูกบอกแล้ว จึงไม่มีคำว่า อาจ', () => {
  it('มีที่อยู่ในตาราง และไม่ใช่คำชุดเดียวกับ QR_MAYBE_EXPIRED', () => {
    const a = RESULT_COPY.QR_EXPIRED
    const b = RESULT_COPY.QR_MAYBE_EXPIRED
    expect(a, 'QR_EXPIRED ต้องมีคำของตัวเองในตารางที่ถูกตรวจ').toBeTruthy()
    expect(a.title).not.toBe(b.title)
    expect(a.title).not.toContain('อาจ')
  })

  it('ไม่มีเงินออก และทางต่อคือ QR ใหม่ ❌ ไม่ใช่ ตรวจสอบอีกครั้ง', () => {
    expect(RESULT_COPY.QR_EXPIRED.paid).toBe(false)
    // 'same' เคยอยู่ตรงนี้ และเทสต์ก็เขียว — จนภาพจอเผยว่าคำสัญญาปุ่มที่จอไม่มี (mootech-fe#471)
    expect(RESULT_COPY.QR_EXPIRED.retry).toBe('new-qr')
  })

  it('🔴 คำที่สัญญา "ขอ QR ใหม่" ต้องมาคู่กับปุ่มที่ทำอย่างนั้นได้เสมอ — ทุกแถวในตาราง', () => {
    // ฟันของ **คลาส** ❌ ไม่ใช่ของแถวเดียว: ถ้าวันหนึ่งมีใครเขียนประโยคนี้ในแถวอื่นแล้วลืมปุ่ม บรรทัดนี้ต้องแดง
    const promises = (Object.keys(RESULT_COPY) as ResultState[]).filter((s) =>
      RESULT_COPY[s].body.includes('ขอ QR ใหม่'),
    )
    expect(promises.length, 'ต้องมีอย่างน้อยหนึ่งแถวที่พูดประโยคนี้ ไม่งั้นฟันนี้ตรวจศูนย์แถว').toBeGreaterThan(0)

    // 🔴 ช่องว่างที่รู้อยู่ ❌ ไม่ใช่ข้อยกเว้นเพื่อให้เขียว — QR_MAYBE_EXPIRED พูดประโยคนี้อยู่บน main
    // มาก่อน slice นี้ และมันสัญญา **สองปุ่ม** (ขอ QR ใหม่ + ตรวจสอบอีกครั้ง) โดยมีให้จริงปุ่มเดียว
    // การแก้มันคือการออกแบบปุ่มของจอที่ ship ไปแล้ว ซึ่งไม่ใช่ slice นี้ ⇒ แยกใบ
    const KNOWN_GAP: Partial<Record<ResultState, string>> = {
      // เลขนี้เขียนหลังเปิดใบจริงแล้ว — ฉบับแรกเขียน #479 จากการเดา ของจริงคือ #480
      QR_MAYBE_EXPIRED: 'mojisejr/mootech-fe#480',
    }

    for (const s of promises) {
      if (KNOWN_GAP[s]) continue
      expect(['new-qr', 'different'], `${s} สัญญา QR ใหม่ แต่ retry=${RESULT_COPY[s].retry}`)
        .toContain(RESULT_COPY[s].retry)
    }

    // 🔑 ทำให้รายการยกเว้น **หมดอายุเอง**: ถ้าใครซ่อมแถวที่อยู่ในรายการ บรรทัดนี้จะแดงทันที
    // และบังคับให้ลบชื่อออกจากรายการ ⇒ รายการยกเว้นเน่าค้างอยู่ไม่ได้
    for (const s of Object.keys(KNOWN_GAP) as ResultState[]) {
      expect(['new-qr', 'different'], `${s} ถูกซ่อมแล้ว (${KNOWN_GAP[s]}) — ลบออกจาก KNOWN_GAP ได้`)
        .not.toContain(RESULT_COPY[s].retry)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('#455 slice 3 — พร้อมเพย์ที่จบแล้ว ต้องไม่ค้างที่ "กำลังดำเนินการ" ตลอดกาล', () => {
  // 🔴 บั๊กที่ชุดนี้เฝ้า: useChargeStatus.ts:83 นับ REJECTED เป็น settled ⇒ :208 ออกจาก loop
  // ⇒ :218-219 ที่ setPhase ไม่ถูกเดินอีก ⇒ phase แช่ที่ 'waiting' ถาวร
  // ⇒ ถ้ากิ่ง REJECTED+promptpay หายไป แถวนั้นจะตกไปอ่าน phase ที่แช่ แล้วตอบ PAYING ตลอดกาล
  //
  // 🔴 MUTANT CONTRACT
  //   MU7  ลบกิ่ง REJECTED+promptpay ทิ้ง            → ทุกข้อในบล็อกนี้แดง (ได้ PAYING)
  //   MU8  ให้ failureCode อะไรก็ได้ตอบ QR_EXPIRED    → "อธิบายไม่ได้ ไม่ใช่ หมดอายุ" แดง
  //   MU9  ให้กิ่งนี้กิน method อื่นด้วย                → "บัตรไม่ได้รับคำของ QR" แดง
  //   MU10 ให้ REJECTED มาก่อน APPROVED               → "server ยืนยันว่าจ่ายแล้ว ชนะเสมอ" แดง
  const rejected: ResultInputs = { ...base, status: 'REJECTED', phase: 'waiting' }

  it('🔴 phase แช่ที่ waiting ก็ยังต้องไม่ใช่ PAYING — นี่คือเคสที่ผู้ใช้เจอจริง', () => {
    // phase: 'waiting' ตรงนี้ **ไม่ใช่การจัดฉาก** มันคือค่าที่ hook ค้างไว้จริงเมื่อสถานะ settled
    for (const fc of ['gateway_expired', 'gateway_failed', 'gateway_reversed', null, 'failed']) {
      const got = resolveResultState({ ...rejected, failureCode: fc })
      expect(got, `failureCode=${String(fc)}`).not.toBe('PAYING')
    }
  })

  it('คำเดียวที่แปลว่าหมดอายุ คือ gateway_expired', () => {
    expect(resolveResultState({ ...rejected, failureCode: 'gateway_expired' })).toBe('QR_EXPIRED')
  })

  it('🔴 ชุดค่าที่ server ผลิตได้มีสามตัว และสองตัวที่เหลือ ❌ ไม่ใช่หมดอายุ', () => {
    // ประกาศขนาดพื้นผิวออกมาดัง ๆ — ถ้าฝั่ง server เพิ่มค่าที่สี่ รายการนี้จะไม่รู้ และนั่นคือขีดจำกัดที่รู้ตัว
    const PRODUCED = ['gateway_expired', 'gateway_failed', 'gateway_reversed'] as const
    expect(PRODUCED).toHaveLength(3)
    expect(resolveResultState({ ...rejected, failureCode: 'gateway_failed' })).toBe('QR_MAYBE_EXPIRED')
    // ⚠️ `gateway_reversed` ไปถึงกิ่งพร้อมเพย์ได้เท่าที่ **โค้ดเรา** อนุญาต — TERMINAL_FAILURE_STATUSES
    // (lib/payment/gateway.ts:105) ไม่แยก method เลย · แต่ **ยังไม่มีใครยืนยันว่า Omise ส่งค่านี้กับพร้อมเพย์**
    // ⇒ บรรทัดนี้ตรึงพฤติกรรมของอินพุตที่ยังพิสูจน์ไม่ได้ว่าเกิดจริง ❌ ห้ามอ่านว่าเป็นเคสที่วัดมาแล้ว
    // 🔴 และคำที่ได้จากถังนี้ **ผิดกับเคสนี้** — mojisejr/mootech-fe#484 ถืออยู่ (สิทธิ์ไม่ถูกถอน เงินถูกตีกลับ)
    // ที่นี่ตรึงไว้แค่ว่า "ไม่ถูกอ่านว่าหมดอายุ" ❌ ไม่ได้แปลว่าคำที่ได้ถูกต้อง
    expect(resolveResultState({ ...rejected, failureCode: 'gateway_reversed' })).toBe('QR_MAYBE_EXPIRED')
  })

  it('🔴 mootech_expired ถูกยกเลิกถาวร — ถ้ามันโผล่มา ต้องไม่ถูกอ่านว่าหมดอายุ', () => {
    // เคยจับคู่ไว้ในฉบับก่อน เพราะคอมเมนต์ฝั่ง server บอกให้จับคู่ · ของจริงไม่มีผู้ผลิตและเดินไปไม่ถึงเชิงโครงสร้าง
    // เทสต์นี้ตรึงการถอดออก ⇒ ถ้าใครเติมกลับโดยไม่มีผู้ผลิต บรรทัดนี้แดง
    expect(resolveResultState({ ...rejected, failureCode: 'mootech_expired' })).toBe('QR_MAYBE_EXPIRED')
  })

  it('server ยังไม่ส่ง failureCode ⇒ ต้องมีสองสัญญาณตรงกันถึงจะพูดว่าหมดอายุ', () => {
    // ระหว่างที่ #481 ยังไม่ deploy จอต้องทำงานได้ ❌ ห้ามพังเพราะฟิลด์หาย
    expect(resolveResultState({ ...rejected, failureCode: null, qrDeadline: 'expired' })).toBe('QR_EXPIRED')
    expect(resolveResultState({ ...rejected, failureCode: null, qrDeadline: 'unknown' })).toBe('QR_MAYBE_EXPIRED')
    expect(resolveResultState({ ...rejected, failureCode: null, qrDeadline: 'live' })).toBe('QR_MAYBE_EXPIRED')
  })

  it('🔴 เหตุที่อธิบายไม่ได้ ❌ ไม่ใช่ หมดอายุ — แม้ QR จะตายแล้วก็ตาม', () => {
    // Omise บอกเหตุมาแล้วและมันไม่ใช่หมดอายุ ⇒ ห้ามพิมพ์ว่าหมดอายุ แม้ qrDeadline จะบอกว่า expired
    // เพราะสองอย่างนี้ตอบคนละคำถาม: QR ตายเมื่อไหร่ กับ แถวนี้จบเพราะอะไร
    expect(resolveResultState({ ...rejected, failureCode: 'failed', qrDeadline: 'expired' }))
      .toBe('QR_MAYBE_EXPIRED')
  })

  it('บัตรยังเป็นของกิ่งเดิม ไม่ถูกกิ่งใหม่แย่งไป', () => {
    expect(resolveResultState({ ...rejected, method: 'card', failureCode: 'gateway_expired' }))
      .toBe('CARD_DECLINED')
  })

  it('server ที่ยืนยันว่าจ่ายแล้ว ชนะทุกอย่าง — REJECTED ไม่แย่ง APPROVED', () => {
    expect(resolveResultState({ ...rejected, status: 'APPROVED' })).toBe('APPROVED')
  })

  it('ทุกค่าของ failureCode ที่ทดสอบ ให้ผลไม่เหมือนกันทั้งหมด — ไม่งั้นแปลว่ากิ่งไม่มีผล', () => {
    const seen = new Set(['gateway_expired', 'gateway_failed', 'gateway_reversed', null, 'failed'].map((fc) =>
      resolveResultState({ ...rejected, failureCode: fc }),
    ))
    expect(seen.size, `ได้ ${[...seen].join(' / ')}`).toBeGreaterThan(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('#484 จ่ายแล้วเงินถูกตีกลับ — จอต้องไม่พูดว่าสำเร็จ', () => {
  // 🔴 บั๊กที่ชุดนี้เฝ้า: แถวที่ถูกตีกลับ **คงสถานะ APPROVED ไว้โดยตั้งใจ** (การจ่ายเกิดขึ้นจริงในอดีต)
  // ⇒ ถ้ากิ่ง reversed อยู่หลังกิ่ง APPROVED จอจะขึ้น "ชำระเงินสำเร็จ" พร้อม paid: true
  //   ในวินาทีที่เงินถูกคืนไปแล้วและสิทธิ์ถูกถอนไปแล้ว
  //
  // 🔴 MUTANT CONTRACT
  //   MU11  ย้ายกิ่ง reversed ไปไว้หลังกิ่ง APPROVED   → "ไม่พูดว่าสำเร็จ" แดง
  //   MU12  ตัด `status === 'APPROVED'` ออกจากเงื่อนไข → "เคสที่ไม่เคยมีสิทธิ์" แดง
  //   MU13  ให้ PAYMENT_REVERSED ตั้ง paid: true       → ตารางที่ถูกตรวจแดง
  const base484: ResultInputs = {
    status: 'APPROVED', method: 'promptpay', claimed: 'APPROVED',
    phase: 'waiting', qrDeadline: 'unknown', failureCode: 'gateway_reversed',
  }

  it('🔴 ไม่แสดง APPROVED หรือ ALREADY_PAID — ยิงด้วยอินพุตตามสัญญาในใบ', () => {
    for (const claimed of ['PAYING', 'APPROVED'] as ResultState[]) {
      const got = resolveResultState({ ...base484, claimed })
      expect(got, `claimed=${claimed}`).toBe('PAYMENT_REVERSED')
      expect(RESULT_COPY[got].paid, 'ห้ามขึ้นเครื่องหมายว่าเงินขยับ').toBe(false)
    }
  })

  it('🔴 ผู้ผลิตอีกรายของค่านี้ — REJECT + reversed ไม่เคยมีสิทธิ์ให้ถอน ⇒ ห้ามได้คำเดียวกัน', () => {
    // reconcile-run.ts เขียน gateway_reversed ให้แถวที่ยังไม่เคยให้สิทธิ์ ซึ่งจบเป็น REJECT
    // ถ้ากิ่งดูแต่ failureCode เคสนี้จะได้ประโยค "การเป็นสมาชิก...ถูกยกเลิกแล้ว" ทั้งที่ไม่เคยมี
    const got = resolveResultState({ ...base484, status: 'REJECTED' })
    expect(got).not.toBe('PAYMENT_REVERSED')
  })

  it('phase ไม่มีผลกับเคสนี้ — คำตอบของ server เป็นคำตัดสิน', () => {
    for (const phase of ['waiting', 'reconciling', 'exhausted'] as ResultInputs['phase'][]) {
      expect(resolveResultState({ ...base484, phase }), `phase=${phase}`).toBe('PAYMENT_REVERSED')
    }
  })

  it('เลนบัตรที่ถูกตีกลับก็ได้คำเดียวกัน — การตีกลับไม่ใช่เรื่องของวิธีจ่าย', () => {
    expect(resolveResultState({ ...base484, method: 'card' })).toBe('PAYMENT_REVERSED')
  })

  it('APPROVED ปกติที่ไม่มี failureCode ยังเป็น APPROVED — กิ่งใหม่ไม่รั่วไปทับของเก่า', () => {
    expect(resolveResultState({ ...base484, failureCode: null })).toBe('APPROVED')
    expect(resolveResultState({ ...base484, failureCode: 'gateway_failed' })).toBe('APPROVED')
  })
})
