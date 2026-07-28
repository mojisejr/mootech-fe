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
  open: (date: string) => void
  toggleYam: (yamId: string) => void
  toggleDest: (dest: ReminderDestination) => void
  setNote: (note: string) => void
  /** Commit the draft. NO-OP unless editing + committable (double-submit guard lives in the table). */
  commit: () => void
  cancel: () => void
  dismiss: () => void
}

const EMPTY_DRAFT: ReminderDraft = { date: '', selectedYamIds: [], destinations: ['mumate'], note: '' }

export function useReminderDraft(): UseReminderDraft {
  const [state, setState] = useState<SaveFlowState>('idle')
  const [draft, setDraft] = useState<ReminderDraft>(EMPTY_DRAFT)

  const canCommit = hasCommittableDraft(draft)

  const open = useCallback((date: string) => {
    setDraft({ ...EMPTY_DRAFT, date })
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

  const commit = useCallback(() => {
    setState((s) => {
      // guard: only editing + committable may enter saving (the table also blocks illegal states)
      if (s !== 'editing' || !hasCommittableDraft(draft)) return s
      const saving = saveFlowNext(s, 'commit')
      // Phase 0 mock: resolve immediately (no network). At API-time this becomes a request whose
      // .then→resolve / .catch→reject. The synchronous resolve keeps the mock a pure state machine.
      return saveFlowNext(saving, 'resolve')
    })
  }, [draft])

  const cancel = useCallback(() => setState((s) => saveFlowNext(s, 'cancel')), [])
  const dismiss = useCallback(() => setState((s) => saveFlowNext(s, 'dismiss')), [])

  // The open sheet is FormMode (no Mate AI) whenever a draft is in flight; closed → not this surface's call.
  const menuState = useMemo<CalendarMenuState>(
    () => (state === 'editing' || state === 'saving' ? CalendarMenuState.FormMode : CalendarMenuState.Normal),
    [state],
  )

  return { state, draft, canCommit, menuState, open, toggleYam, toggleDest, setNote, commit, cancel, dismiss }
}
