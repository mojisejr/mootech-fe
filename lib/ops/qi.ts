// /ops QI adjust — validator (PURE). การเขียนจริงไปที่ engine /api/qi/admin-adjust (คนละ DB) ผ่าน lib/ops/engine
export type QiEdit = { userId: string; qiDelta: number; note?: string }
export type QiRefusal = { ok: false; reason: 'BAD_USER' | 'BAD_DELTA' }

export const MAX_QI_ADJUST = 100_000

export function validateQiEdit(raw: { userId: unknown; qiDelta: unknown; note?: unknown }):
  | { ok: true; edit: QiEdit }
  | QiRefusal {
  const userId = typeof raw.userId === 'string' ? raw.userId.trim() : ''
  if (!userId) return { ok: false, reason: 'BAD_USER' }

  const qiDelta = typeof raw.qiDelta === 'number' ? raw.qiDelta : Number(raw.qiDelta)
  if (!Number.isFinite(qiDelta) || !Number.isInteger(qiDelta)) return { ok: false, reason: 'BAD_DELTA' }
  if (qiDelta === 0 || Math.abs(qiDelta) > MAX_QI_ADJUST) return { ok: false, reason: 'BAD_DELTA' }

  const note = typeof raw.note === 'string' ? raw.note.trim().slice(0, 200) : undefined
  return { ok: true, edit: { userId, qiDelta, note } }
}
