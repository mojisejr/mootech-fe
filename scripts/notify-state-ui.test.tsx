// #286 phase 2 → #298 reframe — ฟันของ "การบอกสถานะแจ้งเตือนตามจริง"
//
// ชั้นที่ 1/0 (notifyStateFrom · capabilityFromEnv) = ตรรกะ 6 สถานะ ไม่เปลี่ยน — ฟันเดิมทั้งชุด.
// ชั้นที่ 2 = จอจริง: #298 ถอด toggle ปลายทางออก ⇒ ความจริง 6 สถานะที่เคยอยู่บน toggle **ย้ายมาบน
// "ปุ่มบันทึก"** (ข้อความปุ่มตาม notify + บรรทัดเหตุใต้ปุ่ม). บั๊กที่ยังต้องกัน:
//   ② "ยังไม่รู้" ถูกปฏิบัติเหมือน "ปิด/ปฏิเสธ" ⇒ ผู้ใช้เห็นเหตุ "ยังไม่ดัง" ทั้งที่ยังไม่ได้อ่านค่า
//
// 🔴 NEGATIVE CONTROL ย้ายมาที่ปุ่ม: unknown → ❌ ไม่มี save-notify-reason · denied → มี · สองค่านี้
// ต้องต่างกันจริง (assert !== ) ไม่ใช่แค่ assert ทางบวกอันเดียว
import { describe, it, expect, vi } from 'vitest'
import { render, renderHook, screen, cleanup, fireEvent } from '@testing-library/react'
import { afterEach } from 'vitest'
import {
  notifyStateFrom,
  canToggleMumate,
  guideVariantFor,
  NOTIFY_REASON,
  type NotifyState,
} from '@/features/v2-calendar/notify-state'
import type { PwaCapability } from '@/lib/pwa/capability'
import { SaveSheet } from '@/features/v2-calendar/components/day-detail/SaveSheet'
import { useReminderDraft, type UseReminderDraft } from '@/features/v2-calendar/hooks/useReminderDraft'
import { NotifyStatusBar } from '@/features/v2-calendar/components/NotifyStatusBar'
import type { YamSlot } from '@/features/v2-calendar/types'

// #343 — SaveSheet มี prop `statusFor` เพิ่ม (required) ⇒ ทุก render ในไฟล์นี้ต้องส่ง
// 🔴 และมันพังตอน **รัน** ไม่ใช่ตอนคอมไพล์ เพราะ `tsconfig.json:32` exclude `scripts` ทั้งโฟลเดอร์
//    ⇒ ท่า "ทำ prop เป็น required เพื่อย้ายด่านไปที่คอมไพเลอร์" (#324) **ครอบไม่ถึงไฟล์เทสต์**
afterEach(cleanup)

// ── ชั้นที่ 1 · การแปล capability → สถานะ (ฟังก์ชันบริสุทธิ์) ─────────────────────────────────

const cap = (over: Partial<PwaCapability>): PwaCapability => ({
  canReceivePush: true,
  needsInstall: false,
  permission: 'granted',
  ...over,
})

const CASES: Array<{ name: string; cap: PwaCapability; expect: NotifyState }> = [
  { name: 'SSR / ยังอ่านไม่เสร็จ', cap: cap({ canReceivePush: null, needsInstall: null, permission: 'unknown' }), expect: 'unknown' },
  { name: 'อนุญาตแล้ว', cap: cap({}), expect: 'granted' },
  { name: 'ยังไม่เคยถาม', cap: cap({ permission: 'default' }), expect: 'default' },
  { name: 'ปฏิเสธไปแล้ว', cap: cap({ permission: 'denied' }), expect: 'denied' },
  { name: 'iOS Safari ยังไม่ติดตั้ง', cap: cap({ canReceivePush: false, needsInstall: true, permission: 'default' }), expect: 'needs-install' },
  // ⚠️ ชื่อเดิมของเคสนี้คือ "webview ในแอป LINE" ซึ่ง **ผิด** — LINE ไม่มี Notification API ⇒ capabilityFromEnv
  // จะให้ permission:'unknown' ไม่ใช่ 'default' · ชุดค่านี้ผลิตได้จริงจาก webview ที่ *มี* Notification แต่ไม่มี
  // PushManager ⇒ เปลี่ยนชื่อให้ตรงของจริง · เคส LINE ตัวจริงเดินผ่าน env ในบล็อกล่างสุดของไฟล์
  { name: 'webview ที่มี Notification แต่ไม่มี PushManager', cap: cap({ canReceivePush: false, needsInstall: false, permission: 'default' }), expect: 'unsupported' },
]

describe('notifyStateFrom — 6 สถานะ ต้องแยกออกจากกันจริง', () => {
  for (const c of CASES) {
    it(`${c.name} → ${c.expect}`, () => {
      expect(notifyStateFrom(c.cap)).toBe(c.expect)
    })
  }

  it('ทั้ง 6 เคสให้ผลไม่ซ้ำกันเลย — ไม่ใช่บังเอิญเท่ากันสองอัน', () => {
    const seen = CASES.map((c) => notifyStateFrom(c.cap))
    expect(new Set(seen).size).toBe(CASES.length)
  })

  it('🔴 "ยังไม่รู้" ต้องไม่ถูกยุบไปเป็น denied หรือ unsupported', () => {
    // นี่คือรูปที่พังเงียบที่สุด: null ถูกอ่านว่า false แล้วจอบอกว่าเครื่องใช้ไม่ได้ ทั้งที่ยังไม่ได้อ่านค่า
    const unknown = notifyStateFrom(cap({ canReceivePush: null, needsInstall: null, permission: 'unknown' }))
    expect(unknown).not.toBe('denied')
    expect(unknown).not.toBe('unsupported')
    expect(unknown).toBe('unknown')
  })

  it('ลำดับการถาม: iOS ที่ยังไม่ติดตั้ง ต้องได้ needs-install ไม่ใช่ unsupported', () => {
    // ทั้งสองเคสมี canReceivePush=false เหมือนกัน — ถ้าเช็ค unsupported ก่อน ผู้ใช้ iPhone จะถูกบอกว่า
    // "เครื่องนี้ใช้ไม่ได้" ทั้งที่แค่ต้องกด Add to Home Screen ⇒ คำแนะนำที่ทำตามแล้วไม่ได้ผล
    expect(notifyStateFrom(cap({ canReceivePush: false, needsInstall: true, permission: 'default' }))).toBe('needs-install')
  })

  it('ติ๊กได้เฉพาะ granted กับ default · ที่เหลือติ๊กไม่ได้', () => {
    expect(CASES.filter((c) => canToggleMumate(c.expect)).map((c) => c.expect)).toEqual(['granted', 'default'])
  })

  it('unsupported ต้องไม่มีปุ่ม "ดูวิธี" — ไม่มีวิธีให้สอน', () => {
    expect(guideVariantFor('unsupported')).toBeNull()
    expect(guideVariantFor('needs-install')).toBe('install')
    expect(guideVariantFor('denied')).toBe('permission')
  })

  it('ทุกสถานะที่ติ๊กไม่ได้ ต้องมีเหตุผลเป็นข้อความ ❌ ไม่ปล่อยให้เทาเฉยๆ', () => {
    for (const s of ['denied', 'needs-install', 'unsupported'] as NotifyState[]) {
      expect(NOTIFY_REASON[s]).toBeTruthy()
    }
  })
})

// ── ชั้นที่ 2 · จอจริง (SaveSheet) — หลัง #298 reframe: สวิตช์ปลายทางหายไป ⇒ ความจริง 6 สถานะ
//    ย้ายมาอยู่บน "ปุ่มบันทึก" (ข้อความปุ่ม + บรรทัดเหตุใต้ปุ่ม + ปุ่มดูวิธี) ─────────────────────────

const YAMS: YamSlot[] = [{ id: 'y1', window: '09:00-10:59', label: 'ยามมงคล' } as YamSlot]

function draftWith(destinations: string[]): UseReminderDraft {
  return {
    state: 'editing',
    draft: { date: '2026-08-16', selectedYamIds: ['y1'], destinations: destinations as never, note: '' },
    canCommit: true,
    menuState: 4,
    open: () => {}, toggleYam: () => {}, toggleDest: () => {}, setNote: () => {},
    commit: () => {}, cancel: () => {}, dismiss: () => {},
  } as unknown as UseReminderDraft
}

function renderSheet(notify: NotifyState) {
  return render(
    <SaveSheet date="2026-08-16" yams={YAMS} draft={draftWith([])} onSave={() => {}} notify={notify} onShowGuide={() => {}} statusFor={() => 'addable'} />,
  )
}

describe('ค่าเริ่มต้นของ draft — ตรวจที่ของจริง ไม่ใช่ที่ prop ที่เทสต์ป้อนเอง', () => {
  it('🔴 เปิดแผ่นมาแล้ว draft ต้องว่างจริง (ไม่มีปลายทางถูกยัดไว้ให้)', () => {
    const { result } = renderHook(() => useReminderDraft())
    expect(result.current.draft.destinations).toEqual([])
  })
})

describe('SaveSheet — ปุ่มบันทึกพูดความจริงของเครื่องครบ 6 สถานะ', () => {
  it('🔴 B3 — ปุ่มบันทึกต้องต่อสายกับ onSave จริง: กดแล้ว handler ถูกเรียก (ถอด onClick → แดง)', () => {
    // ตู๋ #303: `onClick={onSave}` → `() => {}` ผ่าน 35/35 เพราะไม่มีเทสต์ไหนกดปุ่มจริง — ปุ่มอยู่ครบ
    // แต่ไม่มีใครเฝ้าว่ามันยังต่อสาย (ตระกูล #299: ปุ่มอยู่ แต่กดไม่ติด). ฟันนี้กดปุ่มจริงแล้ว assert callback.
    const onSave = vi.fn()
    render(<SaveSheet date="2026-08-16" yams={YAMS} draft={draftWith([])} onSave={onSave} notify="granted" onShowGuide={() => {}} statusFor={() => 'addable'} />)
    fireEvent.click(screen.getByTestId('sheet-save'))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('default → ปุ่มเขียน "บันทึกและเปิดแจ้งเตือน" (กดครั้งเดียว = บันทึก + ขอสิทธิ์) · ยังไม่บ่นเหตุ', () => {
    renderSheet('default')
    expect(screen.getByTestId('sheet-save').textContent).toContain('บันทึกและเปิดแจ้งเตือน')
    expect(screen.queryByTestId('save-notify-reason')).toBeNull()
  })

  it('granted → ปุ่มเขียน "บันทึก" เฉยๆ (สิทธิ์มีแล้ว) · ไม่มีเหตุใต้ปุ่ม', () => {
    renderSheet('granted')
    const btn = screen.getByTestId('sheet-save')
    expect(btn.textContent).toContain('บันทึก')
    expect(btn.textContent).not.toContain('เปิดแจ้งเตือน')
    expect(screen.queryByTestId('save-notify-reason')).toBeNull()
  })

  for (const [state, guide] of [
    ['denied', true], ['needs-install', true], ['unsupported', false],
  ] as Array<[NotifyState, boolean]>) {
    it(`${state} → ปุ่ม "บันทึก" (ตั้งได้แม้ยังไม่ดัง) + บรรทัดเหตุใต้ปุ่ม ${guide ? '+ ปุ่มดูวิธี' : '❌ ไม่มีปุ่มดูวิธี'}`, () => {
      renderSheet(state)
      const btn = screen.getByTestId('sheet-save')
      expect(btn.textContent).toContain('บันทึก')
      expect(btn.textContent).not.toContain('เปิดแจ้งเตือน')
      // ปุ่มยังกดได้ (canCommit=มียาม) — ตั้งใบไว้ได้แม้เครื่องยังไม่พร้อม (ฟีมเคาะ)
      expect((btn as HTMLButtonElement).disabled).toBe(false)
      const reason = screen.getByTestId('save-notify-reason')
      expect(reason.textContent).toBeTruthy()
      expect(reason.textContent).toContain(NOTIFY_REASON[state] as string)
      expect(Boolean(screen.queryByTestId('save-notify-guide'))).toBe(guide)
    })
  }

  it('🔴 unknown (ยังไม่รู้) → ปุ่ม "บันทึก" และ ❌ ไม่โชว์เหตุ "ยังไม่ดัง" — ยังไม่รู้ ไม่ใช่ ปิด', () => {
    // negative control ย้ายมาที่นี่: ถ้าใครยุบ unknown → denied จะมี save-notify-reason โผล่ทั้งที่ยังไม่ได้อ่านค่า
    renderSheet('unknown')
    expect(screen.getByTestId('sheet-save').textContent).toContain('บันทึก')
    expect(screen.queryByTestId('save-notify-reason')).toBeNull()
  })

  it('สถานะที่ "บอกเหตุ" ต้องต่างจาก "ยังไม่รู้" จริง — ไม่ใช่แค่คนละคำ (negative control)', () => {
    renderSheet('denied')
    const deniedHasReason = Boolean(screen.queryByTestId('save-notify-reason'))
    cleanup()
    renderSheet('unknown')
    const unknownHasReason = Boolean(screen.queryByTestId('save-notify-reason'))
    expect(deniedHasReason).toBe(true)
    expect(unknownHasReason).toBe(false)
    expect(deniedHasReason).not.toBe(unknownHasReason)
  })
})

// ── ชั้นที่ 0 · เดินจาก env ที่ "เครื่องจริงผลิตได้" ไม่ใช่จาก capability ที่เราปั้นเอง ───────────
//
// 🔴 นี่คือชั้นที่ขาดไปตอนแรก และมันคือเหตุที่ B1 หลุด (ตู๋จับได้ที่ #292):
// ทุกเคสข้างบนประกอบ `PwaCapability` ด้วยมือ ⇒ เกณฑ์ "6 เคสไม่ซ้ำกันเลย" แข็งมาก แต่มันวัดแค่ว่า
// *ฟังก์ชันแยกแยะ input ที่คนเขียนเลือกเอง* — จับ "สถานะที่รันไทม์ไปไม่ถึง" ไม่ได้เลย
// เคส `webview ในแอป LINE` เดิมป้อน permission:'default' คู่กับ canReceivePush:false ซึ่ง
// `capabilityFromEnv` **ผลิตไม่ได้** (hasNotification=false ⇒ permission เป็น 'unknown' เสมอ)
// ⇒ เทสต์เขียวอยู่บนสถานะที่เครื่องไม่เคยสร้าง ขณะที่ของจริงตกไปช่อง unknown แล้วค้างถาวร
import { capabilityFromEnv, UNKNOWN_CAPABILITY, type CapabilityEnv } from '@/lib/pwa/capability'

const envOf = (o: Partial<CapabilityEnv>): CapabilityEnv => ({
  hasServiceWorker: true, hasPushManager: true, hasNotification: true,
  isStandalone: false, isIOSSafari: false, notificationPermission: 'granted', ...o,
})

describe('🔴 เดินจาก env จริง — capabilityFromEnv → notifyStateFrom', () => {
  it('Android LINE webview (ไม่มี Notification API) → unsupported ❌ ไม่ใช่ค้างที่ unknown', () => {
    // ของจริงที่ผู้ใช้เจอถ้าพลาดข้อนี้: โครง animate-pulse ค้างถาวร ไม่มีข้อความ ไม่มีปุ่มดูวิธี
    // และไม่หายเอง เพราะ hasNotification ไม่มีวันเปลี่ยนระหว่างที่หน้าเปิดอยู่
    const capability = capabilityFromEnv(envOf({ hasNotification: false, hasPushManager: false, hasServiceWorker: false }))
    expect(capability.permission).toBe('unknown') // ← ค่าที่หลอก: 'unknown' ตรงนี้แปลว่า "ไม่มี API" ไม่ใช่ "ยังไม่อ่าน"
    expect(notifyStateFrom(capability)).toBe('unsupported')
    expect(NOTIFY_REASON[notifyStateFrom(capability)]).toBeTruthy() // ต้องมีประโยคให้อ่าน ไม่ใช่โครงเปล่า
  })

  it('CONTROL — iOS Safari แท็บที่ยังไม่ติดตั้ง ต้องยังได้ needs-install (ตัวแก้ต้องไม่กลืนเคสนี้)', () => {
    const capability = capabilityFromEnv(envOf({ hasPushManager: false, isIOSSafari: true, notificationPermission: 'default' }))
    expect(notifyStateFrom(capability)).toBe('needs-install')
  })

  it('CONTROL — SSR/ยังไม่ได้อ่าน ต้องยังเป็น unknown (นี่คือเคสเดียวที่ควรเป็น unknown)', () => {
    expect(notifyStateFrom(capabilityFromEnv(null))).toBe('unknown')
    expect(notifyStateFrom(UNKNOWN_CAPABILITY)).toBe('unknown')
  })

  it('มิวแทนต์: เอา `permission === unknown` กลับเข้าด่านแรก แล้วเคส LINE ต้องพัง', () => {
    // ตัวแก้ B1 คือการ *ถอด* เงื่อนไข ⇒ ฟันของมันต้องเป็น "ใส่กลับแล้วแดง" ไม่ใช่ assert ทางบวกเฉยๆ
    const mutant = (c: PwaCapability): NotifyState =>
      c.canReceivePush === null || c.needsInstall === null || c.permission === 'unknown' ? 'unknown' : notifyStateFrom(c)
    const line = capabilityFromEnv(envOf({ hasNotification: false, hasPushManager: false, hasServiceWorker: false }))
    expect(mutant(line)).toBe('unknown')                    // มิวแทนต์ลงจริง
    expect(notifyStateFrom(line)).not.toBe(mutant(line))    // ของจริงไม่ทำแบบนั้นแล้ว
    // และมันต้องไม่ทำลาย SSR — ทั้งสองทางยังตอบเหมือนกันตรงนี้ (เคสที่ควร unknown จริงๆ)
    expect(mutant(UNKNOWN_CAPABILITY)).toBe(notifyStateFrom(UNKNOWN_CAPABILITY))
  })
})

// ── #307 · แถบสถานะบนหน้ากระดิ่ง (NotifyStatusBar) ────────────────────────────────────────────
//
// บั๊กที่ด่านนี้กัน: `default` บอกว่า "ยังไม่ได้เปิด" + "รายการข้างล่างจะไม่ดัง" แล้ว **ไม่มีปุ่มให้กด**
// เพราะปุ่มเดียวที่มีผูกกับ `guideVariantFor(state)` ซึ่งคืน null สำหรับ default.
//
// 🔴 รายชื่อสถานะมาจาก `Object.keys(NOTIFY_REASON)` ❌ ไม่ใช่ลิสต์ที่พิมพ์เองในไฟล์นี้ — `NOTIFY_REASON`
// เป็น Record<NotifyState, …> ⇒ ถ้าใครเพิ่มสถานะที่ 7 มันต้องเพิ่มคีย์ที่นั่น (ไม่งั้น tsc แดง) แล้ว
// ด่านนี้จะครอบมันเองทันที. ลิสต์ที่พิมพ์เองจะเงียบ: สถานะใหม่จะไม่ถูกตรวจ และไม่มีอะไรบอกเรา.
const ALL_STATES = Object.keys(NOTIFY_REASON) as NotifyState[]
const BOX = 'bg-v3-grade-yellow/40' // กล่องสีของสถานะที่มีปัญหา

function renderBar(state: NotifyState, onEnable: () => void = () => {}) {
  return render(<NotifyStatusBar state={state} onShowGuide={() => {}} onEnable={onEnable} />)
}

describe('#307 NotifyStatusBar — ครบ 6 สถานะ ไม่มีอันไหนหล่น', () => {
  it('ชุดสถานะที่ด่านนี้เดินจริง ต้องเป็น 6 ตัวตาม notify-state.ts', () => {
    // ถ้าบรรทัดนี้แดงเพราะมี 7 ตัว = ดี มันกำลังบอกว่ามีสถานะใหม่ที่ยังไม่มีใครออกแบบแถบให้
    expect(ALL_STATES.sort()).toEqual(['default', 'denied', 'granted', 'needs-install', 'unknown', 'unsupported'])
  })

  it('ทุกสถานะวาดออกมาเป็น *อย่างใดอย่างหนึ่ง* เท่านั้น: โครงว่าง | บรรทัดเนียน | กล่องสี', () => {
    for (const state of ALL_STATES) {
      cleanup()
      renderBar(state)
      const skeleton = screen.queryByTestId('notify-status-skeleton')
      const bar = screen.queryByTestId('notify-status')
      // ❌ ห้ามมีทั้งคู่ และห้ามไม่มีเลย — เคสที่หล่นจะเงียบมาก (แถบหายไปจากจอโดยไม่มี error)
      expect([skeleton, bar].filter(Boolean)).toHaveLength(1)
    }
  })

  it('🔴 default ต้องมีปุ่มลงมือ และกดแล้วขอสิทธิ์จริง (นี่คือบั๊กของใบนี้)', () => {
    const calls: string[] = []
    renderBar('default', () => calls.push('enable'))
    const button = screen.getByTestId('notify-status-enable')
    expect(button.textContent).toContain('เปิดการแจ้งเตือน')
    // assert ที่ "กดแล้วเกิดอะไร" ❌ ไม่ใช่ "ปุ่มมีอยู่" — ปุ่มมีอยู่ได้โดยไม่ต่อสายอะไรเลย (บทเรียน #299)
    button.click()
    expect(calls).toEqual(['enable'])
    // และมันต้องไม่ใช่ปุ่ม "ดูวิธี" ปลอมตัวมา: default ไม่มีวิธีให้สอน มีแต่การลงมือ
    expect(screen.queryByTestId('notify-status-guide')).toBeNull()
  })

  it('🔴 unsupported ต้องไม่มีปุ่มใดๆ — ทั้งลงมือและสอน (ขอสิทธิ์ก็ไม่ช่วย ติดตั้งก็ไม่ช่วย)', () => {
    renderBar('unsupported')
    expect(screen.queryByTestId('notify-status-enable')).toBeNull()
    expect(screen.queryByTestId('notify-status-guide')).toBeNull()
    expect(screen.getByTestId('notify-status').className).toContain(BOX) // แต่ยังต้องเด่น
  })

  it('เฉพาะ default ที่มีปุ่มลงมือ · เฉพาะ denied/needs-install ที่มีปุ่มสอน', () => {
    for (const state of ALL_STATES) {
      cleanup()
      renderBar(state)
      const hasEnable = screen.queryByTestId('notify-status-enable') !== null
      const hasGuide = screen.queryByTestId('notify-status-guide') !== null
      expect({ state, hasEnable }).toEqual({ state, hasEnable: state === 'default' })
      expect({ state, hasGuide }).toEqual({ state, hasGuide: state === 'denied' || state === 'needs-install' })
      // ปุ่มสองแบบต้องไม่เคยขึ้นพร้อมกัน — ผู้ใช้ต้องมีทางเดียวที่ชัด ไม่ใช่สองปุ่มให้เลือกเดา
      expect(hasEnable && hasGuide).toBe(false)
    }
  })

  it('🔴 granted เนียน: บรรทัดเดียว ไม่มีกล่องสี — และมันต้องเนียน *เฉพาะ* granted', () => {
    renderBar('granted')
    const quiet = screen.getByTestId('notify-status')
    expect(quiet.className).not.toContain(BOX)
    expect(quiet.className).not.toContain('bg-v3-pastel-mint') // กล่องเขียวเดิมต้องหายไปจริง
    expect(quiet.textContent).toContain('การแจ้งเตือนเปิดอยู่')
    // NEGATIVE CONTROL ของข้อนี้: อีกสี่สถานะต้อง **ยังมีกล่องสี** — ถ้าเนียนหมด = ซ่อนปัญหา
    for (const state of ALL_STATES.filter((s) => s !== 'granted' && s !== 'unknown')) {
      cleanup()
      renderBar(state)
      expect(screen.getByTestId('notify-status').className).toContain(BOX)
    }
  })

  it('ทุกสถานะที่ไม่ใช่ granted ต้องมีประโยคบอกผลลัพธ์ ❌ ไม่ปล่อยให้เดา', () => {
    for (const state of ALL_STATES.filter((s) => s !== 'granted' && s !== 'unknown')) {
      cleanup()
      renderBar(state)
      const text = screen.getByTestId('notify-status').textContent ?? ''
      expect(text.length).toBeGreaterThan(20)
      // ประโยคของแต่ละสถานะต้องมาจาก NOTIFY_REASON ที่แปลไว้ที่เดียว ❌ ไม่ใช่ข้อความที่หน้านี้แต่งเอง
      const reason = NOTIFY_REASON[state]
      if (reason) expect(text).toContain(reason)
    }
  })

  it('🔴 unknown ยังเป็นโครงว่าง ❌ ไม่ใช่ "ปิด" และไม่มีปุ่มหลุดออกมา', () => {
    renderBar('unknown')
    expect(screen.getByTestId('notify-status-skeleton')).toBeTruthy()
    // negative control เดียวกับที่ไฟล์นี้ตั้งไว้สำหรับชีท: ต้อง assert ว่า *ไม่มี* แถบสถานะปกติโผล่พร้อมกัน
    expect(screen.queryByTestId('notify-status')).toBeNull()
    expect(screen.queryByTestId('notify-status-enable')).toBeNull()
    expect(screen.queryByTestId('notify-status-guide')).toBeNull()
  })

  it('มิวแทนต์: ถ้าปุ่มลงมือถูกผูกกับ guideVariantFor เหมือนของเดิม default จะไม่มีปุ่มอีก', () => {
    // ของเดิมพังเพราะเงื่อนไขปุ่มเป็น `guideVariantFor(state)` ⇒ ด่านนี้ต้องพิสูจน์ว่าเงื่อนไขนั้น
    // *แยกขั้ว* กับสิ่งที่เราต้องการจริง ไม่ใช่แค่ assert ว่าวันนี้มีปุ่ม
    expect(guideVariantFor('default')).toBeNull() // ← สาเหตุของบั๊กเดิม ยังเป็นจริงอยู่
    renderBar('default')
    expect(screen.queryByTestId('notify-status-enable')).not.toBeNull() // ← แต่ปุ่มเรามาจากเงื่อนไขอื่น
  })
})

// ── #307 · ปิดมิวแทนต์ที่ตู๋ยิงแล้ว "รอด" ในรีวิว PR #308 (d6e59a0) ─────────────────────────────
//
// มิวแทนต์: `canReceivePush = hasServiceWorker && hasPushManager` (ถอด `&& hasNotification` ออก)
// → 37/37 ยังเขียว ⇒ **invariant ที่ไม่มียาม**
//
// 🔴 ทำไมมันสำคัญกับใบนี้โดยเฉพาะ (คำอธิบายของตู๋ ยกมาเพราะมันคือเหตุผลที่ทำให้เทสต์นี้มีค่า):
// `notifications.tsx` เรียก `Notification.requestPermission()` **ดิบ** เป็นคำสั่งแรก (ถูกแล้ว — gesture)
// ⇒ ความปลอดภัยของบรรทัดนั้นแขวนอยู่กับ *"state==='default' ⇒ Notification มีอยู่แน่นอน"*
// ซึ่งเป็นจริงเพราะ `&& hasNotification` ตัวนี้ตัวเดียว · ถอดมันออก ⇒ runtime ที่มี SW+PushManager
// แต่ไม่มี Notification จะตกเป็น `default` ⇒ ปุ่มโผล่ ⇒ กดแล้ว **TypeError ใน onClick** และไม่เข้า
// `.catch()` ด้วย เพราะมัน throw ก่อนจะมี promise
//
// ⚠️ ตู๋ไม่บล็อกเพราะเขาหา runtime จริงที่มี PushManager แต่ไม่มี Notification ไม่ได้ (push แบบ
// userVisibleOnly ต้องใช้ Notification) ⇒ นี่คือ invariant ที่ไม่มียาม ❌ ไม่ใช่บั๊กที่รอเกิด
// ⇒ ปิดที่นี่ด้วยบรรทัดเดียวตามที่เขาเสนอ ดีกว่าปล่อยให้ "รอด" ค้างไว้ในบันทึกรีวิว
describe('#307 · ยามของสมมติฐานที่ปุ่ม "เปิดการแจ้งเตือน" พึ่งอยู่', () => {
  it('🔴 ไม่มี Notification API = รับ push ไม่ได้ ต้องไม่ตกเป็น default (ไม่งั้นปุ่มโผล่แล้วกดพัง)', () => {
    const env = envOf({ hasServiceWorker: true, hasPushManager: true, hasNotification: false })
    expect(capabilityFromEnv(env).canReceivePush).toBe(false)
    // และผลปลายทางที่ผู้ใช้เห็น: ต้องเป็น unsupported (ไม่มีปุ่มใดๆ) ❌ ไม่ใช่ default (มีปุ่ม)
    expect(notifyStateFrom(capabilityFromEnv(env))).toBe('unsupported')
  })
})
