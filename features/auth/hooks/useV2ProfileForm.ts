// MuMate v2 — profile-form wiring hook. REUSES the existing profile-save endpoint
// (ChineseHoroscopeCalculate = the /chinese-horoscope backend write + chart compute) and the same
// userId source (MEMBER_ID cookie) as pages/register — it does NOT introduce a new save path. The
// time-building logic is copied verbatim from pages/register onSubmit so behaviour matches exactly.
// The page composes the fields (BirthDayInput + name/gender/time/checkbox) into Lamun's RegisterView.
import { useEffect, useMemo, useState } from 'react'
import { useCookies } from 'react-cookie'
import { CookieKey } from '@/constants/cookie-key'
import { ChineseHoroscopeCalculate } from '@/constants/api/api-chinese-horoscope'
import { profileCanSubmit } from './profile-can-submit'
import { prefetchSummary } from '@/features/v2-first-run/hooks/summary-cache'
import { toBaziGender } from '@/features/v2-first-run/hooks/first-run-source-map'

export type Gender = 'MALE' | 'FEMALE'

// === Register field-contract (the seam) ===
// Lamun's RegisterView / field components bind to this exact shape. goo owns the state + validation
// + save; the UI owns how each field is composed and styled.
export type V2ProfileFields = {
  name: string; setName: (v: string) => void
  surname: string; setSurname: (v: string) => void
  gender: Gender | null; setGender: (v: Gender) => void // null = not chosen yet (required, no default)
  birthDay: string; setBirthDay: (v: string) => void // "YYYY-MM-DD" (BirthDayInput onChangeDate)
  timeHourBirth: string; setTimeHourBirth: (v: string) => void
  timeMinuteBirth: string; setTimeMinuteBirth: (v: string) => void
  isRememberTimeBirth: boolean; setIsRememberTimeBirth: (v: boolean) => void
}

export type V2ProfileFormApi = {
  userId: string
  fields: V2ProfileFields
  canSubmit: boolean // userId && name && birthDay && valid time
  isTimeValid: boolean
  submitting: boolean
  error: string | null
  onSubmit: () => void // → ChineseHoroscopeCalculate (profile save + chart compute) → onSaved(code)
}

export function useV2ProfileForm(onSaved: (code: string) => void): V2ProfileFormApi {
  const [cookies] = useCookies([CookieKey.MEMBER_ID, CookieKey.MEMBER_NAME, CookieKey.MEMBER_IMAGE])
  const userId: string = cookies[CookieKey.MEMBER_ID] ?? ''
  const displayImage: string = cookies[CookieKey.MEMBER_IMAGE] ?? ''

  // Prefill the account name from the OAuth profile (set by the self-heal / register-login).
  const [name, setName] = useState<string>(cookies[CookieKey.MEMBER_NAME] ?? '')
  const [surname, setSurname] = useState<string>('')
  // No default: gender must be actively chosen (Phase B). A defaulted 'MALE' would submit silently.
  const [gender, setGender] = useState<Gender | null>(null)
  const [birthDay, setBirthDay] = useState<string>('')
  const [timeHourBirth, setTimeHourBirth] = useState<string>('')
  const [timeMinuteBirth, setTimeMinuteBirth] = useState<string>('')
  const [isRememberTimeBirth, setIsRememberTimeBirth] = useState<boolean>(true)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // #4: the useState initializer for `name` runs during the 'loading' render, BEFORE the self-heal
  // writes MEMBER_NAME — so it captures an empty cookie. Sync it in once the cookie lands (only if
  // the user hasn't typed their own name yet). useCookies re-renders on MEMBER_NAME change.
  useEffect(() => {
    const cookieName = cookies[CookieKey.MEMBER_NAME]
    setName((prev) => (prev === '' && cookieName ? cookieName : prev))
  }, [cookies])

  // #3: when the birth time is provided, validate it's numeric and in-range, so buildTime() can
  // never POST '99:00' / 'NaN:NaN' to the profile-save. Empty is allowed (buildTime → '00').
  const isTimeValid = useMemo(() => {
    if (!isRememberTimeBirth) return true
    const hourOk = timeHourBirth === '' || (/^\d+$/.test(timeHourBirth) && Number(timeHourBirth) <= 23)
    const minOk = timeMinuteBirth === '' || (/^\d+$/.test(timeMinuteBirth) && Number(timeMinuteBirth) <= 59)
    return hourOk && minOk
  }, [isRememberTimeBirth, timeHourBirth, timeMinuteBirth])

  const canSubmit = useMemo(
    () => profileCanSubmit({ userId, name, birthDay, gender, isTimeValid }),
    [userId, name, birthDay, gender, isTimeValid],
  )

  // Copied verbatim from pages/register onSubmit — zero-pad hour/min, blank when time unknown.
  const buildTime = (): string => {
    if (!isRememberTimeBirth) return ''
    let min = timeMinuteBirth
    let hr = timeHourBirth
    min = min === '' ? '00' : parseInt(timeMinuteBirth) < 10 ? `0${parseInt(timeMinuteBirth)}` : `${parseInt(timeMinuteBirth)}`
    hr = hr === '' ? '00' : parseInt(timeHourBirth) < 10 ? `0${parseInt(timeHourBirth)}` : `${parseInt(timeHourBirth)}`
    return `${hr}:${min}`
  }

  const onSubmit = async () => {
    if (!canSubmit || submitting || !gender) return // !gender is guaranteed by canSubmit; also narrows the type
    setSubmitting(true)
    setError(null)
    try {
      const time = buildTime()
      // Same param order as pages/register callApiCalculate → ChineseHoroscopeCalculate.
      const result: any = await ChineseHoroscopeCalculate(
        userId,
        name,
        birthDay,
        time,
        gender,
        displayImage,
        surname,
        name, // account_name (register uses accountName; prefilled == name here)
        '', // family_code — not collected in slice 1
      )
      if (result?.code) {
        // C3: kick the slow (~10s) first-run reading off NOW, while the user walks intent + pdpa, so the
        // element screen's reading block is usually ready by the time they arrive (memory-only cache).
        prefetchSummary(userId, { birthDate: birthDay, birthTime: time, gender: toBaziGender(gender) })
        onSaved(result.code)
      } else {
        setError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
      }
    } catch {
      setError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  return {
    userId,
    fields: {
      name, setName,
      surname, setSurname,
      gender, setGender,
      birthDay, setBirthDay,
      timeHourBirth, setTimeHourBirth,
      timeMinuteBirth, setTimeMinuteBirth,
      isRememberTimeBirth, setIsRememberTimeBirth,
    },
    canSubmit,
    isTimeValid,
    submitting,
    error,
    onSubmit,
  }
}
