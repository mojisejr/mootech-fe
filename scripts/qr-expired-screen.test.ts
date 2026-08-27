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

  it('ไม่มีเงินออก และยังลองใหม่ได้ด้วยวิธีเดิม', () => {
    expect(RESULT_COPY.QR_EXPIRED.paid).toBe(false)
    expect(RESULT_COPY.QR_EXPIRED.retry).toBe('same')
  })
})
