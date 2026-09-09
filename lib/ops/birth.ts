// /ops birth edit — validator (PURE). เขียนจริง: engine /api/profile/admin (ไม่หัก QI) + sync legacy `user`
export type BirthEdit = {
  userId: string
  birth: string
  birthTime: string | null
  timeUnknown: boolean
  gender?: 'MALE' | 'FEMALE' | 'OTHER'
  birthProvince?: string
}
export type BirthRefusal = { ok: false; reason: 'BAD_USER' | 'BAD_DATE' | 'BAD_TIME' | 'BAD_GENDER' }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

export function validateBirthEdit(raw: {
  userId: unknown
  birth: unknown
  birthTime?: unknown
  timeUnknown?: unknown
  gender?: unknown
  birthProvince?: unknown
}): { ok: true; edit: BirthEdit } | BirthRefusal {
  const userId = typeof raw.userId === 'string' ? raw.userId.trim() : ''
  if (!userId) return { ok: false, reason: 'BAD_USER' }

  const birth = typeof raw.birth === 'string' ? raw.birth.trim() : ''
  if (!DATE_RE.test(birth) || Number.isNaN(Date.parse(birth))) return { ok: false, reason: 'BAD_DATE' }

  const timeUnknown = raw.timeUnknown === true || raw.timeUnknown === 'true'
  let birthTime: string | null = null
  if (!timeUnknown) {
    const t = typeof raw.birthTime === 'string' ? raw.birthTime.trim() : ''
    if (t) {
      if (!TIME_RE.test(t)) return { ok: false, reason: 'BAD_TIME' }
      birthTime = t
    }
  }

  let gender: BirthEdit['gender']
  if (raw.gender !== undefined && raw.gender !== null && raw.gender !== '') {
    if (raw.gender !== 'MALE' && raw.gender !== 'FEMALE' && raw.gender !== 'OTHER') return { ok: false, reason: 'BAD_GENDER' }
    gender = raw.gender
  }
  const birthProvince = typeof raw.birthProvince === 'string' ? raw.birthProvince.trim().slice(0, 100) || undefined : undefined

  return { ok: true, edit: { userId, birth, birthTime, timeUnknown, gender, birthProvince } }
}
