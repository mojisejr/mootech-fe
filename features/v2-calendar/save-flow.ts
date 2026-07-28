// MuMate v2 — ปฏิทินดวง · SAVE-FLOW state machine (goo · client side-effect, the PR#97-class trap).
//
// The save sheet is a client SIDE-EFFECT surface: a draft becomes a "saved" reminder that flips the
// menu (state 2→3) and grows the reminder list. Mapping only the happy path (fill→save→navigate) is
// exactly what looped PR#97 six times. So the transition TABLE below is the contract — every outcome ×
// every resource-state × the lost/reload/replay cases — BEFORE any UI is composed.
//
// At API-time the `saving → saved | error` edge becomes a real request; today it's a synchronous mock.
// The STATES and EDGES do not change — only what fires on the `commit` action. That is the whole point
// of freezing the machine now.

import type { ReminderDestination } from './types'

/** Phases of one save attempt. */
export type SaveFlowState =
  | 'idle' //        sheet closed / no draft in flight
  | 'editing' //     sheet open, user picking ยาม + ปลายทาง (draft dirty-able)
  | 'saving' //      commit fired — mock resolves synchronously; at API-time this is the in-flight window
  | 'saved' //       committed → menu flips to state 3, list gains a row
  | 'error' //       commit failed (API-time only; mock never enters this, but the edge MUST exist)

/** The draft the sheet binds to (screen 5). Pure client-truth until committed. */
export interface ReminderDraft {
  date: string
  /** ยาม ที่ติ๊ก (checkbox 5 ช่วง) — at least 1 required to commit. */
  selectedYamIds: string[]
  destinations: ReminderDestination[]
  note?: string
}

/** Actions that drive the machine. */
export type SaveFlowAction =
  | { type: 'open'; date: string } //          idle → editing
  | { type: 'toggleYam'; yamId: string } //    editing → editing (draft change)
  | { type: 'toggleDest'; dest: ReminderDestination }
  | { type: 'setNote'; note: string }
  | { type: 'commit' } //                      editing → saving (guard: ≥1 ยาม)
  | { type: 'resolve' } //                     saving → saved (mock: immediate; API: on 2xx)
  | { type: 'reject' } //                      saving → error (API-time only)
  | { type: 'retry' } //                       error → saving
  | { type: 'cancel' } //                      editing → idle (draft discarded, menu stays 2)
  | { type: 'dismiss' } //                     saved → idle (sheet closed, menu is 3, list has the row)

// ─────────────────────────────────────────────────────────────────────────────
// TRANSITION TABLE — the source of truth. `undefined` target = action is a NO-OP in that state
// (an illegal edge, e.g. commit while already saving = ignored, NOT a second write → this is the
// replay/double-submit guard that PR#97 missed).
// ─────────────────────────────────────────────────────────────────────────────
export const SAVE_FLOW_TRANSITIONS: Record<
  SaveFlowState,
  Partial<Record<SaveFlowAction['type'], SaveFlowState>>
> = {
  idle: { open: 'editing' },
  editing: {
    toggleYam: 'editing',
    toggleDest: 'editing',
    setNote: 'editing',
    commit: 'saving', // guarded by hasCommittableDraft() — see useReminderDraft
    cancel: 'idle',
  },
  // saving is a LATCH: a second `commit` here is a NO-OP (double-submit / replay guard). Only
  // resolve/reject leave it.
  saving: { resolve: 'saved', reject: 'error' },
  saved: { dismiss: 'idle' },
  error: { retry: 'saving', cancel: 'idle' },
}

/** Pure reducer — returns the next state, or the same state if the edge is illegal (NO-OP). */
export function saveFlowNext(state: SaveFlowState, action: SaveFlowAction['type']): SaveFlowState {
  return SAVE_FLOW_TRANSITIONS[state][action] ?? state
}

/** Commit guard: cannot save an empty ยาม selection (input-boundary case). */
export function hasCommittableDraft(draft: ReminderDraft): boolean {
  return draft.selectedYamIds.length > 0
}

// ─────────────────────────────────────────────────────────────────────────────
// LOST-RESPONSE / RELOAD / REPLAY — the cases the machine must survive (documented so Lamun composes
// the sheet against them, not around them):
//
//  • reload while `editing`      → draft is client-only + NOT persisted this phase → returns to `idle`
//                                  (menu back to state 2). No half-saved ghost. Acceptable for a mock;
//                                  when persistence is added it is a mount-fenced storage read (never a
//                                  server default) to avoid a hydration mismatch.
//  • reload while `saved`        → the reminder is the committed source of truth; the sheet is `idle`
//                                  on reload, menu resolves to 3 from the reminder existing, NOT from a
//                                  lingering save-flow state. (state is DERIVED from data, not remembered)
//  • lost response (API-time)    → `saving` with no resolve/reject = still `saving` (spinner), never a
//                                  silent success. reject→error→retry is the recovery edge, already mapped.
//  • double `commit` / replay    → NO-OP in `saving` (latch above) → exactly one reminder, never two.
// ─────────────────────────────────────────────────────────────────────────────
