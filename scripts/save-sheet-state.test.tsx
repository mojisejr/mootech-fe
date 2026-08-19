// #342 — ฟันของ "ชีทบอกว่ากำลังบันทึกอยู่ และบอกเมื่อล้ม"
//
// อาการที่ฟีมเจอเอง 2026-08-19: กด "บันทึกและเปิดแจ้งเตือน" แล้ว **ไม่มีอะไรเปลี่ยนบนจอเลย** —
// state machine มี saving/error มาตั้งแต่ #287 (useReminderDraft.ts) แต่ SaveSheet.tsx ไม่เคยอ่าน
// `draft.state` เลยสักครั้ง (grep '.state' = 0) ⇒ ชีทเงียบทั้งตอนกำลังทำงานและตอนล้ม
//
// 🔴 เกณฑ์ที่ใบกำหนดไว้เอง: "DoD ข้อไหนที่เขียนว่า *มี state* ให้ถามก่อนว่า ถ้าเอา state จริงออก
//    สัญญาณนี้จะเปลี่ยนไหม" ⇒ ไฟล์นี้จึง **ไม่ assert ว่า 'มี element'** สักข้อ ทุกข้อ assert ว่า
//    **ข้อความ/ความกดได้ ต่างกันจริงระหว่างสถานะ** และมีข้อ negative-control ที่พังทันทีถ้าสองสถานะ
//    ดันพูดเหมือนกัน — เทสต์ที่เช็คแค่ว่าปุ่มอยู่ ผ่านได้ทั้งที่จอยังไม่บอกอะไรเลย
//
// ⚠️ `toContain('บันทึก')` ใช้ไม่ได้กับใบนี้ — 'บันทึก' · 'กำลังบันทึก…' · 'ลองบันทึกอีกครั้ง' มีคำนั้นทุกตัว
//    ⇒ assert ด้วย **ค่าเท่ากันเป๊ะ** ไม่ใช่ substring (ไม่งั้นฟันผ่านทั้งที่ป้ายไม่เคยเปลี่ยน)
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { SaveSheet } from '@/features/v2-calendar/components/day-detail/SaveSheet'
import type { UseReminderDraft } from '@/features/v2-calendar/hooks/useReminderDraft'
import type { SaveFlowState } from '@/features/v2-calendar/save-flow'
import type { NotifyState } from '@/features/v2-calendar/notify-state'
import type { YamSlot } from '@/features/v2-calendar/types'
import type { YamReminderStatus } from '@/features/v2-calendar/tier-lock'
import { SHEET_YAM_ADDED_NOTE, SHEET_YAM_PAST_NOTE } from '@/features/v2-calendar/components/day-detail/SaveSheet'
import { Menubar } from '@/features/v2-shell/components/Menubar'

// Menubar อ่าน useRouter() เพื่อไฮไลต์แท็บ — ชุดฟันของ #343 ท้ายไฟล์เรนเดอร์มันตรงๆ ⇒ ต้อง mount router
// ปลอมให้ (ของจริงไม่มีใน jsdom) · pathname ตั้งเป็นหน้ารายละเอียดวันซึ่งเป็นที่ที่ปุ่มนี้อยู่จริง
vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/v2/calendar/[date]', query: {}, push: vi.fn() }) }))

afterEach(cleanup)

const YAMS: YamSlot[] = [{ id: 'y1', window: '09:00-10:59', label: 'ยามมงคล' } as YamSlot]

/** ชีทเป็น presentational (SaveSheet.tsx:12 — ไม่เรียก hook เอง) ⇒ ป้อนสถานะเข้าไปตรงๆ ได้ ไม่ต้องมีเบราว์เซอร์ */
function draftAt(state: SaveFlowState, canCommit = true): UseReminderDraft {
  return {
    state,
    draft: { date: '2026-08-19', selectedYamIds: ['y1'], destinations: [], note: '' },
    canCommit,
    menuState: 4,
    open: () => {}, toggleYam: () => {}, toggleDest: () => {}, setNote: () => {},
    commit: () => {}, cancel: () => {}, dismiss: () => {},
  } as unknown as UseReminderDraft
}

function renderAt(state: SaveFlowState, opts: { notify?: NotifyState; canCommit?: boolean; onSave?: () => void } = {}) {
  const onSave = opts.onSave ?? (() => {})
  render(
    <SaveSheet
      date="2026-08-19"
      yams={YAMS}
      draft={draftAt(state, opts.canCommit ?? true)}
      onSave={onSave}
      notify={opts.notify ?? 'granted'}
      onShowGuide={() => {}}
      statusFor={() => 'addable'}
    />,
  )
  return screen.getByTestId('sheet-save') as HTMLButtonElement
}

// ── DoD ① กดบันทึก → ปุ่มบอกว่ากำลังทำงานอยู่ และกดซ้ำไม่ได้ ─────────────────────────────────

describe('#342 ① · saving — ปุ่มต้องบอกว่ากำลังทำงาน และรับการกดซ้ำไม่ได้', () => {
  it('ป้ายปุ่มตอน saving ต่างจากตอน editing จริง (ไม่ใช่ปุ่มเดิมที่เงียบเหมือนเดิม)', () => {
    const editing = renderAt('editing').textContent
    cleanup()
    const saving = renderAt('saving').textContent
    expect(saving).toBe('กำลังบันทึก…')
    expect(saving).not.toBe(editing)
  })

  it('🔴 saving → disabled จริง (ถอด `|| saving` ออกจาก SaveSheet ⇒ ข้อนี้แดง)', () => {
    expect(renderAt('saving').disabled).toBe(true)
  })

  it('🔴 saving → กดแล้ว onSave ไม่ถูกเรียก = double-submit ปิดที่จอด้วย ไม่ได้พึ่ง latch ใน hook อย่างเดียว', () => {
    const onSave = vi.fn()
    const btn = renderAt('saving', { onSave })
    fireEvent.click(btn)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('editing → กดได้จริง (negative control ของสองข้อบน — ถ้าปุ่มตายทุกสถานะ ข้อนี้แดง)', () => {
    const onSave = vi.fn()
    const btn = renderAt('editing', { onSave })
    expect(btn.disabled).toBe(false)
    fireEvent.click(btn)
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('saving บอกเครื่องช่วยอ่านด้วย ไม่ใช่บอกแต่คนที่มองเห็น (aria-busy)', () => {
    expect(renderAt('saving').getAttribute('aria-busy')).toBe('true')
    cleanup()
    expect(renderAt('editing').getAttribute('aria-busy')).toBe('false')
  })
})

// ── DoD ② ล้ม → มีข้อความบอกในชีท และชีทยังเปิดให้กดใหม่ ────────────────────────────────────

describe('#342 ② · error — จอต้องบอกว่าล้ม และยังกดใหม่ได้', () => {
  it('error → มีข้อความล้มที่อ่านออก (ค่าเท่ากันเป๊ะ ไม่ใช่ "มี element")', () => {
    renderAt('error')
    expect(screen.getByTestId('save-error').textContent).toBe('บันทึกไม่สำเร็จ · ลองอีกครั้งได้เลย')
  })

  it('🔴 editing/saving ต้องไม่มีข้อความล้ม — ไม่งั้นจอบ่นทั้งที่ยังไม่มีอะไรพัง', () => {
    renderAt('editing')
    expect(screen.queryByTestId('save-error')).toBeNull()
    cleanup()
    renderAt('saving')
    expect(screen.queryByTestId('save-error')).toBeNull()
  })

  it('ข้อความล้มประกาศตัวกับ screen reader (role=alert) ไม่ใช่ข้อความเงียบที่ต้องมองเห็นถึงจะรู้', () => {
    renderAt('error')
    expect(screen.getByTestId('save-error').getAttribute('role')).toBe('alert')
  })

  it('🔴 error → ปุ่มยังกดได้ และกดแล้วยิง onSave จริง (retry — useReminderDraft.ts:89 error→saving)', () => {
    const onSave = vi.fn()
    const btn = renderAt('error', { onSave })
    expect(btn.disabled).toBe(false)
    fireEvent.click(btn)
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('error → ป้ายปุ่มชวนให้ลองใหม่ ไม่ใช่ป้ายเดิมที่เพิ่งล้มไป', () => {
    expect(renderAt('error').textContent).toBe('ลองบันทึกอีกครั้ง')
  })

  it('🔴 ข้อความล้ม ❌ ห้ามอ้างว่า "ไม่มีอะไรถูกบันทึก" — response ที่หายระหว่างทาง (reminders-api.ts:50) แถวอาจเกิดแล้ว', () => {
    renderAt('error')
    const copy = screen.getByTestId('save-error').textContent ?? ''
    expect(copy).not.toMatch(/ไม่มีอะไรถูกบันทึก|ยังไม่ได้บันทึก|ไม่มีรายการ/)
  })
})

// ── negative control ข้ามสถานะ ────────────────────────────────────────────────────────────

describe('#342 · สามสถานะต้องพูดคนละอย่างจริง', () => {
  it('🔴 editing · saving · error ให้ป้ายปุ่มไม่ซ้ำกันเลย (ถ้าป้ายไหนหลุดกลับไปเหมือนกัน ข้อนี้แดง)', () => {
    const labels: string[] = []
    for (const s of ['editing', 'saving', 'error'] as SaveFlowState[]) {
      labels.push(renderAt(s).textContent ?? '')
      cleanup()
    }
    expect(new Set(labels).size).toBe(3)
  })

  it('ป้ายของ notify ยังทำงานเหมือนเดิมตอน editing — #342 ไม่ไปทับคำตัดสินของ #298', () => {
    expect(renderAt('editing', { notify: 'default' }).textContent).toBe('บันทึกและเปิดแจ้งเตือน')
    cleanup()
    expect(renderAt('editing', { notify: 'granted' }).textContent).toBe('บันทึก')
  })

  it('🔴 saving/error ทับป้าย notify ได้ แต่ห้ามทับ "เหตุที่เครื่องไม่ดัง" — สองอันนี้คนละความจริง', () => {
    // ถ้าตอนล้มเราซ่อนบรรทัดสิทธิ์ทิ้ง ผู้ใช้ที่ลองใหม่แล้วสำเร็จจะไม่มีวันรู้ว่าเครื่องตัวเองยังไม่ดัง
    renderAt('error', { notify: 'denied' })
    expect(screen.getByTestId('save-error')).toBeTruthy()
    expect(screen.getByTestId('save-notify-reason')).toBeTruthy()
  })
})

// ── DoD ④ สำเร็จ → ชีทปิดเหมือนเดิม · ①② ต้องไม่ไปงัดของเดิม ──────────────────────────────

describe('#342 ④ · ของเดิมต้องไม่ถูกงัด', () => {
  it('ทุกสถานะที่ชีทถูก mount ปุ่มบันทึกยังอยู่ครบ — ①② ไม่ได้ทำปุ่มหายไปในสถานะไหนเลย', () => {
    for (const s of ['editing', 'saving', 'error'] as SaveFlowState[]) {
      renderAt(s)
      expect(screen.getByTestId('sheet-save')).toBeTruthy()
      cleanup()
    }
  })

  it('canCommit=false ยังคุมปุ่มได้เหมือนเดิม และ saving ไม่ได้ไปปลดล็อกมัน', () => {
    expect(renderAt('editing', { canCommit: false }).disabled).toBe(true)
    cleanup()
    expect(renderAt('saving', { canCommit: false }).disabled).toBe(true)
  })
})


// ───────────────────────── #343 · ช่องติ๊กในชีท 3 สถานะ ─────────────────────────
//
// 🔴 นี่คือด่านที่ปิด **อาการหลัก** ของใบร่ม #340 — ของหาย ไม่ใช่แค่ความสวยงาม:
// ชีทเคยวาดทุกยามเป็น checkbox โดยไม่กรอง แต่ server เป็น all-or-nothing (reminder-plan.ts)
// ⇒ ติ๊กยามที่เลยเวลาปนกับยามที่ดี = **ไม่มีอันไหนถูกบันทึกเลย** และยามที่เลือกถูกก็หายไปด้วย

const YAMS3: YamSlot[] = [
  { id: 'y1', window: '09:00-10:59', label: 'ยามหนึ่ง' } as YamSlot,
  { id: 'y2', window: '19:00-20:59', label: 'ยามสอง' } as YamSlot,
]

function renderSheetWithStatus(statusOf: Record<string, YamReminderStatus>, selected: string[] = []) {
  const draft = {
    state: 'editing',
    draft: { date: '2026-08-19', selectedYamIds: selected, destinations: [], note: '' },
    canCommit: true,
    menuState: 4,
    open: () => {}, toggleYam: () => {}, toggleDest: () => {}, setNote: () => {},
    commit: () => {}, cancel: () => {}, dismiss: () => {},
  } as unknown as UseReminderDraft
  render(
    <SaveSheet
      date="2026-08-19"
      yams={YAMS3}
      draft={draft}
      onSave={() => {}}
      notify="granted"
      onShowGuide={() => {}}
      statusFor={(y) => statusOf[y.id] ?? 'addable'}
    />,
  )
}

describe('#343 · ชีท — ยามที่เลยเวลา/เพิ่มแล้ว ติ๊กไม่ได้ แต่ยังเห็น', () => {
  const box = (id: string) => document.querySelector(`[data-testid="sheet-yam-${id}"] input`) as HTMLInputElement

  it('🔴 ยามที่เลยเวลา ติ๊กไม่ได้ (ถอด disabled ⇒ ข้อนี้แดง) และบอกเหตุว่าทำไม', () => {
    renderSheetWithStatus({ y1: 'past' })
    expect(box('y1').disabled).toBe(true)
    expect(box('y1').checked).toBe(false)
    expect(screen.getByTestId('sheet-yam-note-y1').textContent).toBe(SHEET_YAM_PAST_NOTE)
  })

  it('🔴 ยามที่เพิ่มแล้ว ติ๊กค้างไว้ให้เห็น + กดไม่ได้ + บอกว่าเพิ่มแล้ว', () => {
    renderSheetWithStatus({ y1: 'added' })
    expect(box('y1').checked).toBe(true)
    expect(box('y1').disabled).toBe(true)
    expect(screen.getByTestId('sheet-yam-note-y1').textContent).toBe(SHEET_YAM_ADDED_NOTE)
  })

  it('🔴 ทั้งสองแบบ **ยังอยู่ในรายการ ไม่ถูกซ่อน** — ผู้ใช้ต้องเห็นว่าวันนี้มีกี่ยามและตัวเองอยู่ตรงไหน', () => {
    renderSheetWithStatus({ y1: 'past', y2: 'added' })
    expect(screen.getByTestId('sheet-yam-y1')).toBeTruthy()
    expect(screen.getByTestId('sheet-yam-y2')).toBeTruthy()
    expect(screen.getByText('09:00-10:59')).toBeTruthy()
    expect(screen.getByText('19:00-20:59')).toBeTruthy()
  })

  it('NEGATIVE CONTROL · ยามปกติยังติ๊กได้เหมือนเดิม และไม่มีป้ายเหตุ', () => {
    renderSheetWithStatus({ y1: 'addable' })
    expect(box('y1').disabled).toBe(false)
    expect(screen.queryByTestId('sheet-yam-note-y1')).toBeNull()
  })

  it('🔴 ยามที่ล็อกอยู่ปนกับยามปกติในชีทเดียวกัน — ตัวที่ล็อกต้องไม่ลามไปปิดตัวปกติ', () => {
    renderSheetWithStatus({ y1: 'past', y2: 'addable' }, ['y2'])
    expect(box('y1').disabled).toBe(true)
    expect(box('y2').disabled).toBe(false)
    expect(box('y2').checked).toBe(true)
  })
})

// ───────────────────────── #343 · ปุ่มแถบล่าง — ✓ กับ กดไม่ได้ ─────────────────────────

describe('#343 · Menubar — ✓ เป็นของป้าย default เท่านั้น และปุ่มปิดได้ด้วยเหตุของหน้าเพจ', () => {
  it('🔴 state=saved + ส่ง label เอง → **ไม่มี ✓ นำหน้า** (ไม่งั้นจอวาด "✓ เพิ่มยาม")', () => {
    render(<Menubar state="saved" ctaLabel="เพิ่มยาม" onCta={() => {}} />)
    const btn = screen.getByTestId('menubar-cta')
    expect(btn.textContent).toBe('เพิ่มยาม')
    expect(btn.textContent).not.toContain('✓')
  })

  it('NEGATIVE CONTROL · state=saved + ไม่ส่ง label → ป้าย default พร้อม ✓ เหมือนเดิม (หน้ารายการใช้ทางนี้)', () => {
    render(<Menubar state="saved" onCta={() => {}} />)
    expect(screen.getByTestId('menubar-cta').textContent).toBe('✓ คุณบันทึกลงปฏิทินแล้ว')
  })

  it('🔴 ctaDisabled → ปุ่มกดไม่ได้จริง และกดแล้ว onCta ไม่ถูกเรียก', () => {
    const onCta = vi.fn()
    render(<Menubar state="primary-cta" ctaLabel="เลยเวลาบันทึกแล้ว" ctaDisabled onCta={onCta} />)
    const btn = screen.getByTestId('menubar-cta') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(onCta).not.toHaveBeenCalled()
  })

  it('NEGATIVE CONTROL · ไม่ส่ง ctaDisabled → กดได้เหมือนเดิม', () => {
    const onCta = vi.fn()
    render(<Menubar state="primary-cta" ctaLabel="เพิ่มลงปฏิทิน เพื่อแจ้งเตือน" onCta={onCta} />)
    const btn = screen.getByTestId('menubar-cta') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    fireEvent.click(btn)
    expect(onCta).toHaveBeenCalledTimes(1)
  })

  it("ป้าย '' (กำลังโหลด) ยังทำงานแยกจาก ctaDisabled — สอง sentinel คนละความหมาย", () => {
    render(<Menubar state="primary-cta" ctaLabel="" onCta={() => {}} />)
    const btn = screen.getByTestId('menubar-cta') as HTMLButtonElement
    expect(btn.textContent).toBe('กำลังโหลด…')
    expect(btn.disabled).toBe(true)
    expect(btn.getAttribute('aria-busy')).toBe('true')
  })
})
