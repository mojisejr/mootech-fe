// MuMate v2 — ปฏิทินดวง · useReminderDraft (goo · SAVE-FLOW state machine — the Phase-5 seam).
//
// This is the client side-effect surface (PR#97-class). It owns the draft + the save-flow state; Lamun
// composes the sheet UI against `state` and calls the actions — she never re-derives the transitions.
// Every edge (incl. cancel/double-commit/error) comes from save-flow.ts's TABLE, so the sheet can't
// invent an illegal transition.
//
// Phase 0 = mock: `commit` resolves synchronously (no network). At API-time only the resolve/reject
// wiring changes to a real request — the states, guards and the menu mapping below stay identical.
import { useCallback, useMemo, useState } from 'react'
import type { ReminderDestination } from '../types'
import {
  saveFlowNext,
  hasCommittableDraft,
  type SaveFlowState,
  type ReminderDraft,
} from '../save-flow'
import { CalendarMenuState } from '../menu-state'

export interface UseReminderDraft {
  state: SaveFlowState
  draft: ReminderDraft
  /** true when the draft can be committed (≥1 ยาม selected) — the sheet's save button enable. */
  canCommit: boolean
  /** The menu state THIS surface implies (goo drives it): the open sheet is always FormMode (no Mate AI). */
  menuState: CalendarMenuState
  /** #341 — เปิดชีท; ส่ง `yamIds` เพื่อติ๊กยามไว้ล่วงหน้า (ทางเข้าจากปุ่มรายยาม) · ไม่ส่ง = ว่างเหมือนเดิม */
  open: (date: string, yamIds?: string[]) => void
  toggleYam: (yamId: string) => void
  toggleDest: (dest: ReminderDestination) => void
  setNote: (note: string) => void
  /** Commit the draft: editing→saving, run `save`, then saving→saved (true) / saving→error (false).
   *  NO-OP unless editing + committable; the `saving` latch makes a 2nd commit a no-op (double-submit).
   *  #287: `save` is the real network call (POST) injected by the page — the STATES/guards are unchanged
   *  from the Phase-0 mock, only what resolves/rejects them moved from a sync mock to an awaited request. */
  commit: (save: () => Promise<boolean>) => Promise<void>
  cancel: () => void
  dismiss: () => void
}

// #286: destinations เริ่มต้นเป็น [] ❌ ไม่ใช่ ['mumate'] — ค่าเดิมทำให้ผู้ใช้ 'เลือก' ปลายทางที่เขา
// ไม่ได้เลือก และเป็นปลายทางที่ระบบยังส่งไม่ได้ด้วย (ไม่มี PWA จนถึง #285) ⇒ บันทึกแล้วขึ้นชิป
// 'มู่เมท' ในรายการโดยไม่มีอะไรจะดัง. แตะบรรทัดนี้บรรทัดเดียวตามที่ใบระบุ — ที่เหลือเป็นของ goo
const EMPTY_DRAFT: ReminderDraft = { date: '', selectedYamIds: [], destinations: [], note: '' }

export function useReminderDraft(): UseReminderDraft {
  const [state, setState] = useState<SaveFlowState>('idle')
  const [draft, setDraft] = useState<ReminderDraft>(EMPTY_DRAFT)

  const canCommit = hasCommittableDraft(draft)

  const open = useCallback((date: string, yamIds?: string[]) => {
    // #341 — ติ๊กยามล่วงหน้าได้ (de-dupe กันยามซ้ำจากผู้เรียก); ไม่ส่ง = ว่างเหมือน Phase 0
    setDraft({ ...EMPTY_DRAFT, date, selectedYamIds: yamIds ? Array.from(new Set(yamIds)) : [] })
    setState((s) => saveFlowNext(s, 'open'))
  }, [])

  const toggleYam = useCallback((yamId: string) => {
    setDraft((d) => ({
      ...d,
      selectedYamIds: d.selectedYamIds.includes(yamId)
        ? d.selectedYamIds.filter((y) => y !== yamId)
        : [...d.selectedYamIds, yamId],
    }))
    setState((s) => saveFlowNext(s, 'toggleYam'))
  }, [])

  const toggleDest = useCallback((dest: ReminderDestination) => {
    setDraft((d) => ({
      ...d,
      destinations: d.destinations.includes(dest)
        ? d.destinations.filter((x) => x !== dest)
        : [...d.destinations, dest],
    }))
    setState((s) => saveFlowNext(s, 'toggleDest'))
  }, [])

  const setNote = useCallback((note: string) => {
    setDraft((d) => ({ ...d, note }))
    setState((s) => saveFlowNext(s, 'setNote'))
  }, [])

  const commit = useCallback(
    async (save: () => Promise<boolean>) => {
      // Start allowed from `editing` (first attempt) or `error` (retry — same button re-clicked). The
      // setState updater re-checks, so a 2nd commit fired while already `saving` is a NO-OP (the latch)
      // — exactly one in-flight request, one row.
      if ((state !== 'editing' && state !== 'error') || !hasCommittableDraft(draft)) return
      setState((s) => {
        if (s === 'editing') return saveFlowNext(s, 'commit') // → saving
        if (s === 'error') return saveFlowNext(s, 'retry') //    → saving
        return s // already saving = latch
      })
      let ok = false
      try {
        ok = await save()
      } catch {
        ok = false // a thrown saver is a failed save, never a silent success
      }
      // saving → saved (ok) / error (fail). Guarded on `saving` so a cancel mid-flight isn't overwritten.
      setState((s) => (s === 'saving' ? saveFlowNext(s, ok ? 'resolve' : 'reject') : s))
    },
    [state, draft],
  )

  const cancel = useCallback(() => setState((s) => saveFlowNext(s, 'cancel')), [])
  const dismiss = useCallback(() => setState((s) => saveFlowNext(s, 'dismiss')), [])

  // The open sheet is FormMode (no Mate AI) whenever a draft is in flight — including `error`, where the
  // sheet stays open so the user can retry (the page keeps it mounted on error for the same reason).
  const menuState = useMemo<CalendarMenuState>(
    () =>
      state === 'editing' || state === 'saving' || state === 'error'
        ? CalendarMenuState.FormMode
        : CalendarMenuState.Normal,
    [state],
  )

  return { state, draft, canCommit, menuState, open, toggleYam, toggleDest, setNote, commit, cancel, dismiss }
}
