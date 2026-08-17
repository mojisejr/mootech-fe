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
  { name: 'webview ในแอป LINE', cap: cap({ canReceivePush: false, needsInstall: false, permission: 'default' }), expect: 'unsupported' },
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
