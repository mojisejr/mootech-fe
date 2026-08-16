// MuMate v2 · reminders transport (goo · #287) — thin fetch wrappers over /api/v2/reminders. Isolated
// so the hooks' state logic can be unit-tested with a mocked fetch (the transport is the ONLY thing
// stubbed; the hook's own mapping/branching is exercised for real — [[thin-wrapper-mocked-both-sides]]).
import type { ReminderDTO } from './reminder-adapter'

export interface SaveReminderInput {
  date: string
  yams: { yamId: string; yamLabel: string; window: string }[]
  destinations: string[]
}

/** Outcomes the caller (draft machine + UI) must distinguish — maps the server's status codes. */
export type SaveOutcome =
  | { ok: true; reminders: ReminderDTO[] }
  | { ok: false; kind: 'past'; pastYamIds: string[] } //   422 — ตั้งย้อนหลัง
  | { ok: false; kind: 'forbidden' } //                     403 — free / not member
  | { ok: false; kind: 'unauthorized' } //                  401 — no session
  | { ok: false; kind: 'invalid'; error: string } //        400 — bad input
  | { ok: false; kind: 'error' } //                         5xx / network — retryable

const REMINDERS_URL = '/api/v2/reminders'

/** GET the caller's reminders. Throws on non-2xx so the hook can surface a load error. */
export async function fetchReminders(signal?: AbortSignal): Promise<ReminderDTO[]> {
  const res = await fetch(REMINDERS_URL, { signal, credentials: 'same-origin' })
  if (!res.ok) throw new Error(`fetchReminders ${res.status}`)
  const body = (await res.json()) as { reminders?: ReminderDTO[] }
  return body.reminders ?? []
}

/** POST a save. Never throws — every outcome (incl. network fail) is a typed SaveOutcome. */
export async function saveReminders(input: SaveReminderInput): Promise<SaveOutcome> {
  let res: Response
  try {
    res = await fetch(REMINDERS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(input),
    })
  } catch {
    return { ok: false, kind: 'error' } // network down — retryable
  }

  if (res.status === 201 || res.ok) {
    const body = (await res.json().catch(() => ({}))) as { reminders?: ReminderDTO[] }
    return { ok: true, reminders: body.reminders ?? [] }
  }
  if (res.status === 422) {
    const body = (await res.json().catch(() => ({}))) as { pastYamIds?: string[] }
    return { ok: false, kind: 'past', pastYamIds: body.pastYamIds ?? [] }
  }
  if (res.status === 403) return { ok: false, kind: 'forbidden' }
  if (res.status === 401) return { ok: false, kind: 'unauthorized' }
  if (res.status === 400) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, kind: 'invalid', error: body.error ?? 'ข้อมูลไม่ถูกต้อง' }
  }
  return { ok: false, kind: 'error' } // 5xx etc — retryable
}

/** DELETE one reminder (server scopes by session user_id). Returns whether it succeeded. */
export async function cancelReminder(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${REMINDERS_URL}?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    })
    return res.ok
  } catch {
    return false
  }
}
