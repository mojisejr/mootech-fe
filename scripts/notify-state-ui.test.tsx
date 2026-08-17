// #286 phase 2 — ฟันของจอที่ต้องบอกสถานะแจ้งเตือนตามจริง
//
// บั๊กที่ด่านนี้กัน (เกิดจริงมาแล้วทั้งคู่):
//   ① toggle "มู่เมท" เปิดค้างเป็นค่าเริ่มต้น ⇒ ผู้ใช้ "เลือก" ปลายทางที่เขาไม่ได้เลือก และเป็น
//      ปลายทางที่ยังส่งไม่ได้ด้วย
//   ② "ยังไม่รู้" ถูกวาดเป็น "ปิด" ⇒ ปิดคือคำตอบ แต่ยังไม่รู้ไม่ใช่คำตอบ · ผู้ใช้จะสรุปว่าเขาปิดไว้เอง
//      แล้วไปหาที่เปิดในแอป ซึ่งไม่มี
//
// 🔴 เคส "ยังไม่รู้" ต้องมี NEGATIVE CONTROL ไม่ใช่แค่ assert ว่ามี skeleton — เทสต์ที่เช็คแค่
// "เจอ skeleton" จะเขียวได้ทั้งที่ toggle ปิดถูกวาดอยู่ข้างๆ ⇒ ต้อง assert ว่า **ไม่มี toggle ปกติ
// ปรากฏพร้อมกัน** ด้วย. มิวแทนต์ที่พิสูจน์ว่าฟันนี้กัด อยู่ในเทสต์ตัวสุดท้ายของไฟล์ — มันจำลอง
// "การแก้ที่ทำให้ unknown กลายเป็น off" แล้วยืนยันว่าเงื่อนไขที่เราตรวจ *เปลี่ยนขั้ว* จริง
// (ถ้าเขียนแต่ assert ทางบวก เราจะไม่มีวันรู้ว่ามันแยกสองกรณีนี้ออกจากกันได้จริงหรือเปล่า)
import { describe, it, expect } from 'vitest'
import { render, renderHook, screen, cleanup } from '@testing-library/react'
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

// ── ชั้นที่ 2 · จอจริง (SaveSheet) ─────────────────────────────────────────────────────────────

const YAMS: YamSlot[] = [{ id: 'y1', window: '09:00-10:59', label: 'ยามมงคล' } as YamSlot]

function draftWith(destinations: string[]): UseReminderDraft {
  return {
    state: 'editing',
    draft: { date: '2026-08-16', selectedYamIds: ['y1'], destinations: destinations as never, note: '' },
    canCommit: true,
    menuState: 4,
    open: () => {},
    toggleYam: () => {},
    toggleDest: () => {},
    setNote: () => {},
    commit: () => {},
    cancel: () => {},
    dismiss: () => {},
  } as unknown as UseReminderDraft
}

function renderSheet(notify: NotifyState, destinations: string[] = []) {
  return render(
    <SaveSheet
      date="2026-08-16"
      yams={YAMS}
      draft={draftWith(destinations)}
      onSave={() => {}}
      notify={notify}
      onShowGuide={() => {}}
      onRequestPermission={() => {}}
    />,
  )
}

describe('ค่าเริ่มต้นของ draft — ตรวจที่ของจริง ไม่ใช่ที่ prop ที่เทสต์ป้อนเอง', () => {
  it('🔴 เปิดแผ่นมาแล้วต้องไม่มีปลายทางไหนถูกเลือกไว้ให้', () => {
    // ต้อง assert ที่ EMPTY_DRAFT ของจริงผ่าน hook — ถ้า assert ผ่าน SaveSheet ที่เราป้อน
    // destinations=[] เอง มันจะเขียวตลอดไม่ว่าค่าเริ่มต้นจริงจะเป็นอะไร (assert ที่อ่านสิ่งที่ตัวเองเขียน)
    const { result } = renderHook(() => useReminderDraft())
    expect(result.current.draft.destinations).toEqual([])
  })
})

describe('SaveSheet — แถวมู่เมทพูดความจริงของเครื่องครบ 6 สถานะ', () => {
  it('ค่าเริ่มต้นของแผ่นคือ "ยังไม่ได้เลือกปลายทาง" ❌ ไม่ใช่มู่เมทเปิดค้าง', () => {
    // ตรวจที่ผลลัพธ์ของ EMPTY_DRAFT ผ่านจอจริง: ไม่มีปลายทางไหนติ๊กอยู่ตอนเปิดแผ่น
    renderSheet('granted', [])
    const hint = screen.getByTestId('save-no-destination')
    expect(hint).toBeTruthy()
    // 🔴 assert ที่ "ประโยค" ไม่ใช่แค่ testid — ก่อน #287 merge ตรงนี้เขียนว่า "บันทึกได้ แต่จะไม่มีอะไร
    // เตือน" ซึ่งกลายเป็นเท็จเมื่อ planReminderCommit ตอบ 400 (บันทึกไม่ติดเลย) และฟันที่ดูแค่ testid
    // ยังเขียวสนิทตลอดทาง ⇒ ผูกฟันไว้กับ*สิ่งที่ผู้ใช้อ่าน* ไม่ใช่ hook ที่ render มัน
    expect(hint.textContent).toContain('ต้องเลือกปลายทางอย่างน้อย 1 อย่าง')
    // ⚠️ ห้ามด้วย *ประโยคเก่าเต็มๆ* ❌ ไม่ใช่ชิ้นส่วน 'บันทึกได้' — ประโยคใหม่ลงท้ายว่า "ถึงจะบันทึกได้"
    // ซึ่งมีชิ้นส่วนนั้นอยู่ ⇒ ฟันสองซี่บนสตริงเดียวจะกัดกันเอง (รอบแรกแดงเพราะเหตุนี้จริงๆ)
    expect(hint.textContent).not.toContain('บันทึกได้ แต่จะไม่มีอะไรเตือน')
  })

  it('granted → ติ๊กได้จริง (ปุ่มไม่ disabled)', () => {
    renderSheet('granted')
    expect((screen.getByTestId('dest-mumate') as HTMLButtonElement).disabled).toBe(false)
    expect(screen.queryByTestId('mumate-reason')).toBeNull()
  })

  it('default → ติ๊กได้ (การกดคือการขอสิทธิ์) และยังไม่มีเหตุผลให้บ่น', () => {
    renderSheet('default')
    expect((screen.getByTestId('dest-mumate') as HTMLButtonElement).disabled).toBe(false)
    expect(screen.queryByTestId('mumate-reason')).toBeNull()
  })

  for (const [state, guide] of [
    ['denied', true],
    ['needs-install', true],
    ['unsupported', false],
  ] as Array<[NotifyState, boolean]>) {
    it(`${state} → ติ๊กไม่ได้จริง + มีเหตุผล ${guide ? '+ ปุ่มดูวิธี' : '❌ ไม่มีปุ่มดูวิธี'}`, () => {
      renderSheet(state)
      expect((screen.getByTestId('dest-mumate') as HTMLButtonElement).disabled).toBe(true)
      expect(screen.getByTestId('mumate-reason').textContent).toBeTruthy()
      expect(Boolean(screen.queryByTestId('mumate-guide'))).toBe(guide)
    })
  }

  it('Google/Apple ติ๊กได้เสมอ แม้ push จะพัง — แผ่นไม่ล่มทั้งใบ', () => {
    renderSheet('unsupported')
    const buttons = screen.getAllByRole('button').filter((b) => b.textContent?.includes('ปฏิทิน'))
    expect(buttons.length).toBeGreaterThan(0)
    for (const b of buttons) expect((b as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('🔴 "ยังไม่รู้" — เคสที่พังเงียบที่สุด', () => {
  it('วาดเป็นโครงว่าง ❌ ไม่ใช่ toggle ปิด และปุ่มต้องกดไม่ได้ระหว่างยังไม่รู้', () => {
    renderSheet('unknown')
    expect(screen.getByTestId('mumate-skeleton')).toBeTruthy()
    expect((screen.getByTestId('dest-mumate') as HTMLButtonElement).disabled).toBe(true)
    // negative control ชั้นแรก: ไม่มีเหตุผลแบบ "คุณปิดไว้" โผล่ตอนที่เรายังไม่รู้ด้วยซ้ำ
    expect(screen.queryByTestId('mumate-reason')).toBeNull()
    // 🔴 ชั้นที่สอง — "ไม่มี toggle ปกติอยู่ข้างๆ โครงว่าง". ปุ่มของ *แถว* (`dest-mumate`) มีอยู่ทุกสถานะ
    // (แค่ disabled) ⇒ assert ที่ปุ่มแถวอย่างเดียวแยก "โครงว่าง" กับ "toggle ปิด" ไม่ออก. harness ที่ถ่าย
    // จอจริงชนกำแพงนี้ก่อน (มันฟ้อง 3 ใบผิดทั้งที่จอถูก) ⇒ ติด testid ให้ Toggle แล้วผูกฟันไว้ที่การ*ไม่มี*
    expect(screen.queryByTestId('mumate-toggle')).toBeNull()
  })

  it('สถานะที่รู้แล้วทุกอันต้องมี toggle จริง — กันไม่ให้ข้อบนกลายเป็นจริงตลอดเวลา', () => {
    // ถ้า `mumate-toggle` หายไปทั้งไฟล์ (พิมพ์ผิด/ถูกลบ) ข้อบนจะยังเขียว เพราะมันตรวจการ "ไม่มี"
    for (const s of ['granted', 'default', 'denied', 'needs-install', 'unsupported'] as NotifyState[]) {
      cleanup()
      renderSheet(s)
      expect(screen.queryByTestId('mumate-toggle'), `${s} ต้องมี toggle`).toBeTruthy()
    }
  })

  it('สถานะที่ "ปิด" จริงๆ ต้องดูต่างจาก "ยังไม่รู้" — ไม่ใช่แค่คนละคำ', () => {
    renderSheet('unknown')
    const unknownHasSkeleton = Boolean(screen.queryByTestId('mumate-skeleton'))
    cleanup()

    renderSheet('denied')
    const deniedHasSkeleton = Boolean(screen.queryByTestId('mumate-skeleton'))

    // 🔴 นี่คือ negative control จริงของเคสนี้: ถ้าใครแก้ให้ unknown เรนเดอร์เหมือน denied
    // (เช่นยุบ null → false ที่ notifyStateFrom หรือลบ ToggleSkeleton ทิ้ง) สองค่านี้จะเท่ากัน
    // แล้วบรรทัดนี้แดง · assert ทางบวกอย่างเดียวจะเขียวต่อไปโดยไม่มีใครรู้
    expect(unknownHasSkeleton).toBe(true)
    expect(deniedHasSkeleton).toBe(false)
    expect(unknownHasSkeleton).not.toBe(deniedHasSkeleton)
  })

  it('มิวแทนต์: ถ้า notifyStateFrom ยุบ unknown เป็น denied ด่านชั้นแรกต้องแดง', () => {
    // จำลอง "การแก้ที่ดูสมเหตุสมผล" — อ่าน null ว่า false แล้วตกไปช่อง denied
    const mutant = (c: PwaCapability): NotifyState => (c.permission === 'granted' ? 'granted' : 'denied')
    const unknownCap = cap({ canReceivePush: null, needsInstall: null, permission: 'unknown' })

    expect(mutant(unknownCap)).toBe('denied') // มิวแทนต์ลงจริง ไม่ใช่ no-op
    expect(notifyStateFrom(unknownCap)).not.toBe(mutant(unknownCap)) // ของจริงไม่ทำแบบนั้น
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
